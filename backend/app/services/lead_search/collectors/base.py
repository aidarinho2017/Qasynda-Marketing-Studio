"""Shared types for the Lead Search collectors.

Each collector returns a list of `Candidate`s — raw posts/comments matched
against the user's queries. The classifier later decides which candidates
qualify as actual leads.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timezone


@dataclass
class Candidate:
    platform: str  # "reddit" | "youtube" | "hackernews"
    author_handle: str
    author_url: str | None
    post_url: str
    post_text: str
    post_created_at: datetime | None = None
    # Free-form metadata about why this candidate was picked (e.g. matched query).
    meta: dict[str, str] = field(default_factory=dict)


def truncate(text: str, max_chars: int = 1200) -> str:
    """Hard cap text length to keep classifier prompts cheap."""
    if not text:
        return ""
    text = text.strip()
    if len(text) <= max_chars:
        return text
    return text[: max_chars - 1].rstrip() + "…"


def normalize_dt(value: float | int | str | None) -> datetime | None:
    """Best-effort UTC datetime from epoch seconds, ISO string, or None."""
    if value is None:
        return None
    try:
        if isinstance(value, (int, float)):
            return datetime.fromtimestamp(float(value), tz=timezone.utc)
        if isinstance(value, str):
            return datetime.fromisoformat(value.replace("Z", "+00:00"))
    except (ValueError, OSError, OverflowError):
        return None
    return None
