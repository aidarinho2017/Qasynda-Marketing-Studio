"""Channel selector — first step of the Lead Search pipeline.

Given an ICP, asks OpenAI to either:
  - return 1-3 free-channel picks with subreddits / queries we can search, OR
  - refuse with an honest reason (so the campaign refunds without scraping).
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass, field
from typing import Any, Literal

from openai import APIError, APITimeoutError, AsyncOpenAI
from pydantic import BaseModel, Field, ValidationError, field_validator

from app.core.config import settings
from app.services.lead_search.prompts import (
    CHANNEL_SELECTOR_SYSTEM_PROMPT,
    render_channel_selector_user_message,
)

logger = logging.getLogger(__name__)

_VALID_CHANNELS = {"reddit", "youtube", "hackernews"}

_openai_client: AsyncOpenAI | None = None


def _get_openai() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


class _ChannelPick(BaseModel):
    channel: Literal["reddit", "youtube", "hackernews"]
    reason: str = Field(..., min_length=4, max_length=400)
    confidence: int = Field(..., ge=0, le=100)


class _SelectorEnvelope(BaseModel):
    decision: Literal["run", "refuse"]
    channels: list[_ChannelPick] = Field(default_factory=list)
    subreddits: list[str] = Field(default_factory=list)
    youtube_queries: list[str] = Field(default_factory=list)
    hn_queries: list[str] = Field(default_factory=list)
    refused_reason: str | None = None

    @field_validator("subreddits", "youtube_queries", "hn_queries")
    @classmethod
    def _strip_strings(cls, v: list[str]) -> list[str]:
        return [s.strip() for s in v if s and s.strip()]


@dataclass
class ChannelSelectorResult:
    """Domain object the pipeline consumes."""

    decision: Literal["run", "refuse"]
    channels: list[dict[str, Any]] = field(default_factory=list)
    subreddits: list[str] = field(default_factory=list)
    youtube_queries: list[str] = field(default_factory=list)
    hn_queries: list[str] = field(default_factory=list)
    refused_reason: str | None = None


async def _call_openai(messages: list[dict[str, str]]) -> str:
    client = _get_openai()
    response = await asyncio.wait_for(
        client.chat.completions.create(
            model=settings.OPENAI_MODEL,
            messages=messages,
            response_format={"type": "json_object"},
            temperature=0.3,
        ),
        timeout=settings.OPENAI_TIMEOUT,
    )
    return response.choices[0].message.content or "{}"


def _validate(raw: str) -> _SelectorEnvelope:
    obj = json.loads(raw)
    envelope = _SelectorEnvelope.model_validate(obj)

    picks = [p for p in envelope.channels if p.channel in _VALID_CHANNELS]
    envelope.channels = picks

    if envelope.decision == "refuse":
        if not envelope.refused_reason or not envelope.refused_reason.strip():
            raise ValueError("refused_reason required when decision='refuse'")
        envelope.channels = []
        envelope.subreddits = []
        envelope.youtube_queries = []
        envelope.hn_queries = []
    else:
        if not envelope.channels:
            raise ValueError("decision='run' requires at least one channel")
        envelope.refused_reason = None
        # Drop query lists for channels that weren't picked.
        picked = {c.channel for c in envelope.channels}
        if "reddit" not in picked:
            envelope.subreddits = []
        if "youtube" not in picked:
            envelope.youtube_queries = []
        if "hackernews" not in picked:
            envelope.hn_queries = []

    return envelope


async def select_channels(icp: dict[str, Any]) -> ChannelSelectorResult:
    """Run the channel selector. Raises on OpenAI / parse failure (after one retry)."""
    messages: list[dict[str, str]] = [
        {"role": "system", "content": CHANNEL_SELECTOR_SYSTEM_PROMPT},
        {"role": "user", "content": render_channel_selector_user_message(icp)},
    ]

    try:
        raw = await _call_openai(messages)
    except (asyncio.TimeoutError, APITimeoutError) as exc:
        raise RuntimeError("Channel selector timed out") from exc
    except APIError as exc:
        logger.exception("OpenAI API error in channel selector")
        raise RuntimeError("Channel selector OpenAI error") from exc

    try:
        envelope = _validate(raw)
    except (ValueError, ValidationError, json.JSONDecodeError) as first_err:
        logger.warning("Channel selector: first parse failed (%s); retrying", first_err)
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
        envelope = _validate(raw)

    return ChannelSelectorResult(
        decision=envelope.decision,
        channels=[c.model_dump() for c in envelope.channels],
        subreddits=envelope.subreddits,
        youtube_queries=envelope.youtube_queries,
        hn_queries=envelope.hn_queries,
        refused_reason=envelope.refused_reason,
    )
