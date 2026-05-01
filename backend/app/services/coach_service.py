"""AI Growth Manager — chat turn pipeline.

Single async entry point: `send_turn`. Loads conversation + recent messages
under a row lock, calls OpenAI with a strict JSON schema, validates with one
retry, persists the assistant message, merges context, and debits credits.
"""

from __future__ import annotations

import asyncio
import json
import logging
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any
from uuid import UUID

from fastapi import HTTPException, status
from openai import APIError, APITimeoutError, AsyncOpenAI
from pydantic import ValidationError
from sqlalchemy import desc, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.pricing import GROWTH_TURN_CREDITS
from app.models.coach import CoachConversation, CoachMessage, CoachModule
from app.models.user import User
from app.schemas.coach import AcquisitionStructured, FoundationStructured
from app.services.coach_prompts import is_v1_module, render_system_prompt

logger = logging.getLogger(__name__)

_HISTORY_WINDOW = 8
_VALID_CONTEXT_KEYS = {
    "product",
    "icp",
    "offer",
    "brand_voice",
    "target_market",
    "pricing",
    "problem",
    "channel",
}

_openai_client: AsyncOpenAI | None = None


def _get_openai() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


def _merge_context(existing: dict, updates: dict) -> dict:
    """Whitelist keys + only overwrite if new value is non-empty."""
    merged = dict(existing or {})
    for key, value in (updates or {}).items():
        if key not in _VALID_CONTEXT_KEYS:
            continue
        if value in (None, "", [], {}):
            continue
        merged[key] = value
    return merged


def _validate_structured(module: CoachModule, structured: Any) -> dict:
    """Validate v1 module outputs; deferred modules pass through as dicts."""
    if not isinstance(structured, dict):
        raise ValueError("`structured` must be an object")
    if module is CoachModule.foundation:
        return FoundationStructured.model_validate(structured).model_dump()
    if module is CoachModule.acquisition:
        return AcquisitionStructured.model_validate(structured).model_dump()
    return structured


def _validate_envelope(module: CoachModule, raw: str) -> dict:
    """Parse + validate the full assistant envelope. Raises ValueError on failure."""
    try:
        obj = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"invalid JSON: {exc}") from exc
    if not isinstance(obj, dict):
        raise ValueError("response is not a JSON object")

    reply = obj.get("reply")
    if not isinstance(reply, str) or not reply.strip():
        raise ValueError("`reply` must be a non-empty string")

    structured = _validate_structured(module, obj.get("structured", {}))

    context_updates = obj.get("context_updates", {})
    if not isinstance(context_updates, dict):
        raise ValueError("`context_updates` must be an object")

    next_actions = obj.get("next_actions", [])
    if not isinstance(next_actions, list):
        raise ValueError("`next_actions` must be a list")
    cleaned_actions: list[dict] = []
    for item in next_actions[:4]:
        if not isinstance(item, dict):
            continue
        label = str(item.get("label", "")).strip()
        prompt = str(item.get("prompt", "")).strip()
        mod = item.get("module", module.value)
        if not label or not prompt:
            continue
        try:
            CoachModule(mod)
        except ValueError:
            mod = module.value
        cleaned_actions.append({"label": label[:48], "module": mod, "prompt": prompt[:1000]})

    return {
        "reply": reply.strip(),
        "structured": structured,
        "context_updates": context_updates,
        "next_actions": cleaned_actions,
    }


async def _build_history(
    db: AsyncSession, conversation_id: UUID
) -> list[dict[str, str]]:
    """Pull the last K=8 messages, oldest-first, for OpenAI context."""
    rows = (
        await db.execute(
            select(CoachMessage)
            .where(CoachMessage.conversation_id == conversation_id)
            .order_by(desc(CoachMessage.created_at))
            .limit(_HISTORY_WINDOW)
        )
    ).scalars().all()
    rows = list(reversed(rows))

    history: list[dict[str, str]] = []
    for m in rows:
        if m.role == "assistant":
            # Only the chat-bubble `reply`, not the full structured JSON.
            history.append({"role": "assistant", "content": m.content})
        else:
            history.append({"role": "user", "content": m.content})
    return history


async def _call_openai(messages: list[dict[str, str]]) -> str:
    """One OpenAI call returning the raw JSON string content."""
    client = _get_openai()
    try:
        response = await asyncio.wait_for(
            client.chat.completions.create(
                model=settings.OPENAI_MODEL,
                messages=messages,
                response_format={"type": "json_object"},
                temperature=0.6,
            ),
            timeout=settings.OPENAI_TIMEOUT,
        )
    except (asyncio.TimeoutError, APITimeoutError) as exc:
        raise HTTPException(
            status_code=status.HTTP_504_GATEWAY_TIMEOUT,
            detail="The coach took too long to respond. Try again.",
        ) from exc
    except APIError as exc:
        logger.exception("OpenAI API error during coach turn")
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="The coach is unavailable right now. Try again in a moment.",
        ) from exc
    return response.choices[0].message.content or "{}"


async def send_turn(
    db: AsyncSession,
    user: User,
    conversation_id: UUID,
    user_message: str,
    module: CoachModule,
) -> dict[str, Any]:
    """Run one full assistant turn. Returns the response dict (envelope + persisted message)."""
    # Sub-credit balance check — Decimal-aware.
    if user.credits_balance < GROWTH_TURN_CREDITS:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: need {GROWTH_TURN_CREDITS}, "
                f"have {user.credits_balance}. Top up to continue."
            ),
        )

    if not is_v1_module(module):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Module '{module.value}' is coming soon. "
                "Available: foundation, acquisition."
            ),
        )

    # Lock the conversation row so concurrent turns serialize cleanly.
    convo: CoachConversation | None = (
        await db.execute(
            select(CoachConversation)
            .where(
                CoachConversation.id == conversation_id,
                CoachConversation.user_id == user.id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if convo is None:
        raise HTTPException(status_code=404, detail="Conversation not found")

    # Persist the user message immediately so concurrent reads see it,
    # but flush only — commit happens at the end of the turn.
    user_msg = CoachMessage(
        conversation_id=convo.id,
        role="user",
        content=user_message,
        module=module,
    )
    db.add(user_msg)
    await db.flush()

    history = await _build_history(db, convo.id)
    system_prompt = render_system_prompt(module, convo.context or {})

    messages = [{"role": "system", "content": system_prompt}, *history]

    # First attempt.
    raw = await _call_openai(messages)
    try:
        envelope = _validate_envelope(module, raw)
    except (ValueError, ValidationError) as first_err:
        logger.warning(
            "Coach turn %s: first parse failed (%s); retrying", convo.id, first_err
        )
        retry_messages = messages + [
            {"role": "assistant", "content": raw},
            {
                "role": "user",
                "content": (
                    "Your previous response did not match the schema: "
                    f"{first_err}. Reply again with a single valid JSON object "
                    "exactly matching the schema. No commentary."
                ),
            },
        ]
        raw = await _call_openai(retry_messages)
        try:
            envelope = _validate_envelope(module, raw)
        except (ValueError, ValidationError) as second_err:
            logger.error(
                "Coach turn %s: second parse failed (%s) — bailing without charging",
                convo.id,
                second_err,
            )
            await db.rollback()
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="The coach had trouble formatting its reply. Try rephrasing.",
            ) from second_err

    # Persist assistant message + merge context + debit credits in one commit.
    assistant_msg = CoachMessage(
        conversation_id=convo.id,
        role="assistant",
        content=envelope["reply"],
        structured_output={
            "structured": envelope["structured"],
            "next_actions": envelope["next_actions"],
        },
        module=module,
    )
    db.add(assistant_msg)

    new_context = _merge_context(convo.context or {}, envelope["context_updates"])
    convo.context = new_context
    convo.current_module = module
    convo.last_message_at = datetime.now(timezone.utc)

    # Auto-title from the first user message if the title is still default.
    if convo.title in ("", "New conversation"):
        convo.title = user_message[:60].strip() or "New conversation"

    user.credits_balance = (user.credits_balance or Decimal("0")) - GROWTH_TURN_CREDITS

    await db.commit()
    await db.refresh(assistant_msg)

    logger.info(
        "Coach turn ok: user=%s conv=%s module=%s charged=%s balance=%s",
        user.id,
        convo.id,
        module.value,
        GROWTH_TURN_CREDITS,
        user.credits_balance,
    )

    return {
        "message": assistant_msg,
        "reply": envelope["reply"],
        "structured": envelope["structured"],
        "context_updates": envelope["context_updates"],
        "next_actions": envelope["next_actions"],
        "conversation_context": new_context,
        "credits_balance": float(user.credits_balance),
    }
