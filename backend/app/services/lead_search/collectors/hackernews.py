"""Hacker News collector — searches recent stories and comments via Algolia.

No API key required. Queries are concatenated with `OR` to keep total request
count low; results filtered by recency on the client side.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timedelta, timezone

import httpx

from app.services.lead_search.collectors.base import (
    Candidate,
    normalize_dt,
    truncate,
)

logger = logging.getLogger(__name__)

_API = "https://hn.algolia.com/api/v1/search_by_date"


async def _search(
    client: httpx.AsyncClient,
    query: str,
    tag: str,
    since_unix: int,
    hits_per_page: int,
) -> list[dict]:
    params = {
        "query": query,
        "tags": tag,
        "hitsPerPage": str(hits_per_page),
        "numericFilters": f"created_at_i>{since_unix}",
    }
    try:
        resp = await client.get(_API, params=params, timeout=15.0)
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.info("HN search failed (%r, %s): %s", query, tag, exc)
        return []
    return resp.json().get("hits", []) or []


def _to_candidate(hit: dict, query: str) -> Candidate | None:
    object_id = hit.get("objectID")
    if not object_id:
        return None
    is_comment = hit.get("comment_text") is not None
    if is_comment:
        text = (hit.get("comment_text") or "").strip()
    else:
        title = (hit.get("title") or "").strip()
        story = (hit.get("story_text") or "").strip()
        text = f"{title}\n\n{story}".strip() if story else title
    if not text:
        return None
    author = hit.get("author") or "anonymous"
    created = normalize_dt(hit.get("created_at_i"))
    return Candidate(
        platform="hackernews",
        author_handle=author,
        author_url=f"https://news.ycombinator.com/user?id={author}",
        post_url=f"https://news.ycombinator.com/item?id={object_id}",
        post_text=truncate(text),
        post_created_at=created,
        meta={"matched_query": query, "kind": "comment" if is_comment else "story"},
    )


async def collect(
    queries: list[str],
    recency_days: int = 30,
    hits_per_search: int = 25,
) -> list[Candidate]:
    queries = [q.strip() for q in queries if q and q.strip()]
    if not queries:
        return []

    since = datetime.now(timezone.utc) - timedelta(days=recency_days)
    since_unix = int(since.timestamp())

    async with httpx.AsyncClient() as client:
        # Search comments AND stories for each query — comments tend to carry
        # the strongest "looking-for-a-tool" signal, stories are still useful
        # for "what do you use for X" Show-HN-style discussions.
        tasks = []
        for q in queries:
            tasks.append(_search(client, q, "comment", since_unix, hits_per_search))
            tasks.append(_search(client, q, "story", since_unix, hits_per_search))
        all_hits = await asyncio.gather(*tasks, return_exceptions=True)

    by_url: dict[str, Candidate] = {}
    for idx, batch in enumerate(all_hits):
        if isinstance(batch, BaseException):
            continue
        # Recover the originating query from the order we built tasks in.
        query = queries[idx // 2]
        for hit in batch:
            cand = _to_candidate(hit, query)
            if cand is None:
                continue
            by_url.setdefault(cand.post_url, cand)
    return list(by_url.values())
