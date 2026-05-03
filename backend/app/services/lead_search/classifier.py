"""Signal classifier — runs candidates through OpenAI in batches and returns
matched candidates annotated with `signal_type` and `signal_quote`.

Costs are kept low by:
- Truncating each candidate's `post_text` upstream (collectors).
- Batching ~30 candidates per call.
- Running batches in parallel via asyncio.gather.
- Using settings.LEAD_CLASSIFIER_MODEL (defaults to gpt-4o-mini).
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any

from openai import APIError, APITimeoutError, AsyncOpenAI

from app.core.config import settings
from app.services.lead_search.collectors.base import Candidate
from app.services.lead_search.prompts import (
    CLASSIFIER_SYSTEM_PROMPT,
    render_classifier_user_message,
)

logger = logging.getLogger(__name__)

_BATCH_SIZE = 30
_VALID_SIGNAL_TYPES = {"looking_for", "complaint", "hiring", "engagement"}
_MAX_CONCURRENT_CALLS = 4

_openai_client: AsyncOpenAI | None = None
_concurrency = asyncio.Semaphore(_MAX_CONCURRENT_CALLS)


def _get_openai() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


@dataclass
class ClassifiedLead:
    candidate: Candidate
    signal_type: str
    signal_quote: str


def _candidate_payload(candidates: list[Candidate]) -> list[dict[str, Any]]:
    return [
        {
            "id": str(idx),
            "platform": cand.platform,
            "author": cand.author_handle,
            "post_text": cand.post_text,
        }
        for idx, cand in enumerate(candidates)
    ]


async def _classify_batch(
    icp: dict[str, Any], batch: list[Candidate], offset: int
) -> list[ClassifiedLead]:
    payload = _candidate_payload(batch)
    # Re-key ids with the offset so dedup across batches is impossible.
    for i, item in enumerate(payload):
        item["id"] = str(offset + i)

    messages = [
        {"role": "system", "content": CLASSIFIER_SYSTEM_PROMPT},
        {"role": "user", "content": render_classifier_user_message(icp, payload)},
    ]

    async with _concurrency:
        try:
            response = await asyncio.wait_for(
                _get_openai().chat.completions.create(
                    model=settings.LEAD_CLASSIFIER_MODEL,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.2,
                ),
                timeout=settings.OPENAI_TIMEOUT,
            )
        except (asyncio.TimeoutError, APITimeoutError):
            logger.warning("Classifier batch timed out — dropping batch")
            return []
        except APIError:
            logger.exception("Classifier OpenAI error — dropping batch")
            return []

    raw = response.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Classifier returned non-JSON — dropping batch")
        return []

    out: list[ClassifiedLead] = []
    for entry in data.get("results", []) or []:
        try:
            cid = int(entry["id"])
            local_idx = cid - offset
        except (KeyError, ValueError, TypeError):
            continue
        if local_idx < 0 or local_idx >= len(batch):
            continue
        if not entry.get("match"):
            continue
        signal_type = str(entry.get("signal_type") or "").strip()
        if signal_type not in _VALID_SIGNAL_TYPES:
            continue
        quote = str(entry.get("signal_quote") or "").strip()
        if not quote:
            continue
        out.append(
            ClassifiedLead(
                candidate=batch[local_idx],
                signal_type=signal_type,
                signal_quote=quote,
            )
        )
    return out


async def classify(
    icp: dict[str, Any], candidates: list[Candidate]
) -> list[ClassifiedLead]:
    """Classify all candidates in parallel batches. Returns only matched ones."""
    if not candidates:
        return []

    tasks = []
    for start in range(0, len(candidates), _BATCH_SIZE):
        batch = candidates[start : start + _BATCH_SIZE]
        tasks.append(_classify_batch(icp, batch, start))

    batch_results = await asyncio.gather(*tasks, return_exceptions=True)

    out: list[ClassifiedLead] = []
    for r in batch_results:
        if isinstance(r, BaseException):
            logger.warning("Classifier batch raised: %s", r)
            continue
        out.extend(r)
    return out
