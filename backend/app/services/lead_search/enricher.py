"""Lead enricher — turns matched candidates into rich, scored leads.

One OpenAI call per ~25 leads. Drops anything with intent_score < 50, since
those aren't worth showing the user.
"""

from __future__ import annotations

import asyncio
import json
import logging
from dataclasses import dataclass
from typing import Any

from openai import APIError, APITimeoutError, AsyncOpenAI

from app.core.config import settings
from app.services.lead_search.classifier import ClassifiedLead
from app.services.lead_search.prompts import (
    ENRICHER_SYSTEM_PROMPT,
    render_enricher_user_message,
)

logger = logging.getLogger(__name__)

_BATCH_SIZE = 25
_MIN_SCORE = 50
_MAX_CONCURRENT_CALLS = 3

_openai_client: AsyncOpenAI | None = None
_concurrency = asyncio.Semaphore(_MAX_CONCURRENT_CALLS)


def _get_openai() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


@dataclass
class EnrichedLead:
    classified: ClassifiedLead
    role: str
    company: str
    niche: str
    intent_score: int
    suggested_angle: str


def _payload(leads: list[ClassifiedLead]) -> list[dict[str, Any]]:
    return [
        {
            "id": str(idx),
            "platform": l.candidate.platform,
            "author": l.candidate.author_handle,
            "post_text": l.candidate.post_text,
            "signal_type": l.signal_type,
            "signal_quote": l.signal_quote,
        }
        for idx, l in enumerate(leads)
    ]


async def _enrich_batch(
    icp: dict[str, Any], batch: list[ClassifiedLead], offset: int
) -> list[EnrichedLead]:
    payload = _payload(batch)
    for i, item in enumerate(payload):
        item["id"] = str(offset + i)

    messages = [
        {"role": "system", "content": ENRICHER_SYSTEM_PROMPT},
        {"role": "user", "content": render_enricher_user_message(icp, payload)},
    ]

    async with _concurrency:
        try:
            response = await asyncio.wait_for(
                _get_openai().chat.completions.create(
                    model=settings.LEAD_ENRICHER_MODEL,
                    messages=messages,
                    response_format={"type": "json_object"},
                    temperature=0.4,
                ),
                timeout=settings.OPENAI_TIMEOUT,
            )
        except (asyncio.TimeoutError, APITimeoutError):
            logger.warning("Enricher batch timed out")
            return []
        except APIError:
            logger.exception("Enricher OpenAI error")
            return []

    raw = response.choices[0].message.content or "{}"
    try:
        data = json.loads(raw)
    except json.JSONDecodeError:
        logger.warning("Enricher returned non-JSON")
        return []

    out: list[EnrichedLead] = []
    for entry in data.get("results", []) or []:
        try:
            cid = int(entry["id"])
            local_idx = cid - offset
        except (KeyError, ValueError, TypeError):
            continue
        if local_idx < 0 or local_idx >= len(batch):
            continue
        try:
            score = int(entry.get("intent_score", 0))
        except (TypeError, ValueError):
            continue
        if score < _MIN_SCORE:
            continue
        out.append(
            EnrichedLead(
                classified=batch[local_idx],
                role=str(entry.get("role") or "").strip()[:255],
                company=str(entry.get("company") or "").strip()[:255],
                niche=str(entry.get("niche") or "").strip()[:255],
                intent_score=max(0, min(100, score)),
                suggested_angle=str(entry.get("suggested_angle") or "").strip()[:400],
            )
        )
    return out


async def enrich(
    icp: dict[str, Any], leads: list[ClassifiedLead]
) -> list[EnrichedLead]:
    """Enrich + score in parallel batches; sorts by intent_score desc."""
    if not leads:
        return []

    tasks = []
    for start in range(0, len(leads), _BATCH_SIZE):
        batch = leads[start : start + _BATCH_SIZE]
        tasks.append(_enrich_batch(icp, batch, start))

    results = await asyncio.gather(*tasks, return_exceptions=True)

    out: list[EnrichedLead] = []
    for r in results:
        if isinstance(r, BaseException):
            logger.warning("Enricher batch raised: %s", r)
            continue
        out.extend(r)

    out.sort(key=lambda e: e.intent_score, reverse=True)
    return out
