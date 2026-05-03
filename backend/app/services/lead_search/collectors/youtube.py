"""YouTube collector — searches recent videos by query, then top comments.

Comments are where buying-signal questions surface ("anyone tried…", "looking
for an alternative to…"). Skips silently if YOUTUBE_API_KEY is unset.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.core.config import settings
from app.services.lead_search.collectors.base import (
    Candidate,
    normalize_dt,
    truncate,
)

logger = logging.getLogger(__name__)

_SEARCH_URL = "https://www.googleapis.com/youtube/v3/search"
_COMMENTS_URL = "https://www.googleapis.com/youtube/v3/commentThreads"


async def _search_videos(
    client: httpx.AsyncClient,
    query: str,
    published_after: str,
    max_results: int,
) -> list[str]:
    """Return video IDs matching the query, newest-first."""
    params = {
        "key": settings.YOUTUBE_API_KEY,
        "part": "id",
        "type": "video",
        "q": query,
        "order": "relevance",
        "publishedAfter": published_after,
        "maxResults": str(min(max_results, 25)),
    }
    try:
        resp = await client.get(_SEARCH_URL, params=params, timeout=15.0)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.info("YouTube search failed (%r): %s", query, exc)
        return []
    return [
        item["id"]["videoId"]
        for item in resp.json().get("items", [])
        if item.get("id", {}).get("videoId")
    ]


async def _video_comments(
    client: httpx.AsyncClient,
    video_id: str,
    since: datetime,
    max_comments: int,
) -> list[Candidate]:
    params = {
        "key": settings.YOUTUBE_API_KEY,
        "part": "snippet",
        "videoId": video_id,
        "order": "relevance",
        "textFormat": "plainText",
        "maxResults": str(min(max_comments, 50)),
    }
    try:
        resp = await client.get(_COMMENTS_URL, params=params, timeout=15.0)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        # Comments may be disabled — skip quietly.
        logger.debug("YouTube comments fetch failed for %s: %s", video_id, exc)
        return []

    out: list[Candidate] = []
    for item in resp.json().get("items", []):
        top = item.get("snippet", {}).get("topLevelComment", {}).get("snippet", {}) or {}
        text = (top.get("textDisplay") or "").strip()
        if not text:
            continue
        published = normalize_dt(top.get("publishedAt"))
        if published is None or published < since:
            continue
        author = (top.get("authorDisplayName") or "").strip() or "anonymous"
        author_channel = top.get("authorChannelUrl")
        comment_id = item.get("id")
        post_url = (
            f"https://www.youtube.com/watch?v={video_id}&lc={comment_id}"
            if comment_id
            else f"https://www.youtube.com/watch?v={video_id}"
        )
        out.append(
            Candidate(
                platform="youtube",
                author_handle=author,
                author_url=author_channel,
                post_url=post_url,
                post_text=truncate(text),
                post_created_at=published,
                meta={"video_id": video_id},
            )
        )
    return out


async def collect(
    queries: list[str],
    recency_days: int = 30,
    videos_per_query: int = 5,
    comments_per_video: int = 20,
) -> list[Candidate]:
    if not settings.YOUTUBE_API_KEY:
        logger.info("YouTube collector skipped: API key not configured")
        return []
    if not queries:
        return []

    since = datetime.now(timezone.utc) - timedelta(days=recency_days)
    published_after = since.strftime("%Y-%m-%dT%H:%M:%SZ")

    async with httpx.AsyncClient() as client:
        # Search videos for each query.
        search_tasks = [
            _search_videos(client, q, published_after, videos_per_query)
            for q in queries
            if q.strip()
        ]
        video_id_lists = await asyncio.gather(*search_tasks, return_exceptions=True)

        video_ids: list[str] = []
        for batch in video_id_lists:
            if isinstance(batch, BaseException):
                continue
            for vid in batch:
                if vid not in video_ids:
                    video_ids.append(vid)

        if not video_ids:
            return []

        # Fetch comment threads in parallel.
        comment_tasks = [
            _video_comments(client, vid, since, comments_per_video)
            for vid in video_ids
        ]
        comment_lists = await asyncio.gather(*comment_tasks, return_exceptions=True)

    by_url: dict[str, Candidate] = {}
    for batch in comment_lists:
        if isinstance(batch, BaseException):
            continue
        for cand in batch:
            by_url.setdefault(cand.post_url, cand)
    return list(by_url.values())
