"""Reddit collector — searches selected subreddits for buying-signal posts.

Uses Reddit's OAuth2 client_credentials flow (script-app). If credentials are
missing the collector logs once and returns no candidates so other channels
continue running.
"""

from __future__ import annotations

import asyncio
import logging
import time
from datetime import datetime, timedelta, timezone

import httpx

from app.core.config import settings
from app.services.lead_search.collectors.base import (
    Candidate,
    normalize_dt,
    truncate,
)

logger = logging.getLogger(__name__)

_OAUTH_URL = "https://www.reddit.com/api/v1/access_token"
_API_BASE = "https://oauth.reddit.com"

_DEFAULT_QUERIES = [
    "looking for",
    "any recommendations",
    "anyone using",
    "alternatives to",
    "best tool",
    "struggling with",
]

_token_cache: dict[str, float | str] = {"token": "", "expires_at": 0.0}


async def _get_token(client: httpx.AsyncClient) -> str | None:
    if not settings.REDDIT_CLIENT_ID or not settings.REDDIT_CLIENT_SECRET:
        return None
    now = time.time()
    cached_token = _token_cache.get("token") or ""
    cached_expiry = float(_token_cache.get("expires_at") or 0.0)
    if isinstance(cached_token, str) and cached_token and cached_expiry > now + 30:
        return cached_token
    try:
        resp = await client.post(
            _OAUTH_URL,
            data={"grant_type": "client_credentials"},
            auth=(settings.REDDIT_CLIENT_ID, settings.REDDIT_CLIENT_SECRET),
            headers={"User-Agent": settings.REDDIT_USER_AGENT},
            timeout=15.0,
        )
        resp.raise_for_status()
        data = resp.json()
        token = data["access_token"]
        expires_in = int(data.get("expires_in", 3600))
        _token_cache["token"] = token
        _token_cache["expires_at"] = now + expires_in
        return token
    except (httpx.HTTPError, KeyError, ValueError) as exc:
        logger.warning("Reddit token fetch failed: %s", exc)
        return None


async def _search_subreddit(
    client: httpx.AsyncClient,
    token: str,
    subreddit: str,
    query: str,
    since: datetime,
    limit: int,
) -> list[Candidate]:
    url = f"{_API_BASE}/r/{subreddit}/search"
    params = {
        "q": query,
        "restrict_sr": "1",
        "sort": "new",
        "t": "month",
        "limit": str(limit),
    }
    try:
        resp = await client.get(
            url,
            params=params,
            headers={
                "Authorization": f"bearer {token}",
                "User-Agent": settings.REDDIT_USER_AGENT,
            },
            timeout=15.0,
        )
        resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.info("Reddit search failed (r/%s, %r): %s", subreddit, query, exc)
        return []

    items: list[Candidate] = []
    for child in resp.json().get("data", {}).get("children", []):
        post = child.get("data", {})
        created_at = normalize_dt(post.get("created_utc"))
        if created_at is None or created_at < since:
            continue
        title = (post.get("title") or "").strip()
        body = (post.get("selftext") or "").strip()
        text = f"{title}\n\n{body}".strip() if body else title
        if not text:
            continue
        author = post.get("author") or "[deleted]"
        permalink = post.get("permalink") or ""
        items.append(
            Candidate(
                platform="reddit",
                author_handle=f"u/{author}",
                author_url=f"https://www.reddit.com/user/{author}"
                if author != "[deleted]"
                else None,
                post_url=f"https://www.reddit.com{permalink}",
                post_text=truncate(text),
                post_created_at=created_at,
                meta={"subreddit": subreddit, "matched_query": query},
            )
        )
    return items


async def collect(
    subreddits: list[str],
    queries: list[str] | None = None,
    recency_days: int = 30,
    per_search_limit: int = 10,
) -> list[Candidate]:
    """Search each (subreddit, query) pair in parallel; dedup by post_url."""
    if not settings.REDDIT_CLIENT_ID or not settings.REDDIT_CLIENT_SECRET:
        logger.info("Reddit collector skipped: credentials not configured")
        return []
    if not subreddits:
        return []

    queries = [q.strip() for q in (queries or _DEFAULT_QUERIES) if q and q.strip()]
    if not queries:
        queries = list(_DEFAULT_QUERIES)

    since = datetime.now(timezone.utc) - timedelta(days=recency_days)

    async with httpx.AsyncClient() as client:
        token = await _get_token(client)
        if not token:
            return []

        tasks = [
            _search_subreddit(client, token, sub.lstrip("r/"), q, since, per_search_limit)
            for sub in subreddits
            for q in queries
        ]
        results = await asyncio.gather(*tasks, return_exceptions=True)

    by_url: dict[str, Candidate] = {}
    for batch in results:
        if isinstance(batch, BaseException):
            logger.info("Reddit subreddit search task error: %s", batch)
            continue
        for cand in batch:
            by_url.setdefault(cand.post_url, cand)
    return list(by_url.values())
