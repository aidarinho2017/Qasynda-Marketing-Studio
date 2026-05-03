"""Lead Search background pipeline.

Full flow (PR #3):
  selecting_channels → discovering → enriching → completed.

Refund rules:
  - Refused (selector says no) → refund full, status=refused
  - Hard failure (selector errored) → refund full, status=failed
  - Zero leads found after collectors+enricher → refund full, status=failed
  - Otherwise → keep credits charged, status=completed (even if leads_found < target)

Top-up support (PR #4): pass `round_number > 1` and `existing_post_urls` to
dedup against prior rounds and append leads to the same campaign.
"""

from __future__ import annotations

import logging
from decimal import Decimal
from uuid import UUID, uuid4

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.pricing import LEAD_RECENCY_DAYS
from app.db.session import AsyncSessionLocal
from app.models.lead import Lead, LeadCampaign, LeadCampaignStatus
from app.models.user import User
from app.services.lead_search import classifier, enricher
from app.services.lead_search.channel_selector import (
    ChannelSelectorResult,
    select_channels,
)
from app.services.lead_search.collectors import hackernews, reddit, youtube
from app.services.lead_search.collectors.base import Candidate

import asyncio

logger = logging.getLogger(__name__)

# Hard cap on candidates fed to the enricher — keeps cost bounded even if
# collectors flood us. Classifier output already ranked by match quality.
_MAX_CANDIDATES_FOR_ENRICHER = 60


async def _refund(db: AsyncSession, user_id: UUID, amount: int) -> None:
    if amount <= 0:
        return
    user = (
        await db.execute(
            select(User).where(User.id == user_id).with_for_update()
        )
    ).scalar_one_or_none()
    if user is None:
        logger.warning("_refund: user %s not found", user_id)
        return
    user.credits_balance = (user.credits_balance or Decimal("0")) + amount


async def _set_progress(
    db: AsyncSession,
    campaign: LeadCampaign,
    status: LeadCampaignStatus,
    progress: int,
    label: str,
) -> None:
    campaign.status = status
    campaign.progress = progress
    campaign.progress_label = label
    await db.commit()


async def _collect_all(
    selector: ChannelSelectorResult, recency_days: int
) -> list[Candidate]:
    """Run picked collectors in parallel; dedup by post_url across channels."""
    picked = {c["channel"] for c in selector.channels}
    tasks = []
    if "reddit" in picked and selector.subreddits:
        tasks.append(
            reddit.collect(
                subreddits=selector.subreddits,
                queries=None,  # use sensible defaults
                recency_days=recency_days,
            )
        )
    if "youtube" in picked and selector.youtube_queries:
        tasks.append(
            youtube.collect(
                queries=selector.youtube_queries,
                recency_days=recency_days,
            )
        )
    if "hackernews" in picked and selector.hn_queries:
        tasks.append(
            hackernews.collect(
                queries=selector.hn_queries,
                recency_days=recency_days,
            )
        )
    if not tasks:
        return []

    batches = await asyncio.gather(*tasks, return_exceptions=True)
    by_url: dict[str, Candidate] = {}
    for batch in batches:
        if isinstance(batch, BaseException):
            logger.warning("Collector raised: %s", batch)
            continue
        for cand in batch:
            by_url.setdefault(cand.post_url, cand)
    return list(by_url.values())


async def run_campaign(
    campaign_id: UUID,
    user_id: UUID,
    refund_amount: int,
    round_number: int = 1,
    existing_post_urls: set[str] | None = None,
) -> None:
    """Run the lead-search pipeline for one campaign round."""
    existing_post_urls = existing_post_urls or set()

    async with AsyncSessionLocal() as db:
        campaign = (
            await db.execute(
                select(LeadCampaign).where(LeadCampaign.id == campaign_id)
            )
        ).scalar_one_or_none()
        if campaign is None:
            logger.warning("run_campaign: campaign %s not found", campaign_id)
            return

        # Phase 1 — channel selection.
        await _set_progress(
            db,
            campaign,
            LeadCampaignStatus.selecting_channels,
            10,
            "Picking channels",
        )

        try:
            result: ChannelSelectorResult = await select_channels(campaign.icp)
        except Exception as exc:
            logger.exception("Channel selector failed for campaign %s", campaign_id)
            await _refund(db, user_id, refund_amount)
            campaign.status = LeadCampaignStatus.failed
            campaign.error_message = (
                "We couldn't analyze your ICP right now. Credits refunded — "
                "please try again in a moment."
            )
            campaign.credits_charged = max(0, campaign.credits_charged - refund_amount)
            campaign.progress = 0
            campaign.progress_label = ""
            await db.commit()
            return

        if result.decision == "refuse":
            await _refund(db, user_id, refund_amount)
            campaign.status = LeadCampaignStatus.refused
            campaign.refused_reason = result.refused_reason or (
                "Your ICP doesn't have strong signal on the free channels we "
                "currently support. Credits refunded."
            )
            campaign.credits_charged = max(0, campaign.credits_charged - refund_amount)
            campaign.progress = 0
            campaign.progress_label = "Refused — refunded"
            await db.commit()
            logger.info("Lead campaign %s refused: %s", campaign_id, campaign.refused_reason)
            return

        # Persist channel picks for the UI as soon as we have them.
        campaign.selected_channels = [
            {
                **pick,
                "subreddits": result.subreddits if pick["channel"] == "reddit" else [],
                "youtube_queries": (
                    result.youtube_queries if pick["channel"] == "youtube" else []
                ),
                "hn_queries": (
                    result.hn_queries if pick["channel"] == "hackernews" else []
                ),
            }
            for pick in result.channels
        ]

        # Phase 2 — discovery.
        await _set_progress(
            db,
            campaign,
            LeadCampaignStatus.discovering,
            30,
            "Scanning channels for buying signals",
        )

        candidates = await _collect_all(result, recency_days=LEAD_RECENCY_DAYS)
        # Drop anything we've already saved as a lead in a prior round.
        if existing_post_urls:
            candidates = [c for c in candidates if c.post_url not in existing_post_urls]

        if not candidates:
            await _refund(db, user_id, refund_amount)
            campaign.status = LeadCampaignStatus.failed
            campaign.error_message = (
                "No fresh posts matched your ICP on the picked channels in the last "
                f"{LEAD_RECENCY_DAYS} days. Credits refunded."
            )
            campaign.credits_charged = max(0, campaign.credits_charged - refund_amount)
            campaign.progress = 0
            campaign.progress_label = ""
            await db.commit()
            logger.info("Lead campaign %s: zero candidates, refunded", campaign_id)
            return

        # Phase 3 — classification.
        await _set_progress(
            db,
            campaign,
            LeadCampaignStatus.enriching,
            55,
            f"Scoring intent across {len(candidates)} posts",
        )

        classified = await classifier.classify(campaign.icp, candidates)
        # Cap so the enricher cost stays bounded.
        if len(classified) > _MAX_CANDIDATES_FOR_ENRICHER:
            classified = classified[:_MAX_CANDIDATES_FOR_ENRICHER]

        if not classified:
            await _refund(db, user_id, refund_amount)
            campaign.status = LeadCampaignStatus.failed
            campaign.error_message = (
                "We scanned the channels but couldn't find clear buying signals "
                "for your ICP. Credits refunded — try refining the description."
            )
            campaign.credits_charged = max(0, campaign.credits_charged - refund_amount)
            campaign.progress = 0
            campaign.progress_label = ""
            await db.commit()
            logger.info("Lead campaign %s: zero matches after classifier", campaign_id)
            return

        # Phase 4 — enrichment + scoring.
        await _set_progress(
            db,
            campaign,
            LeadCampaignStatus.enriching,
            80,
            f"Enriching {len(classified)} matched leads",
        )

        enriched = await enricher.enrich(campaign.icp, classified)
        # Trim to this round's lead target.
        enriched = enriched[: campaign.leads_target]

        if not enriched:
            await _refund(db, user_id, refund_amount)
            campaign.status = LeadCampaignStatus.failed
            campaign.error_message = (
                "We classified some posts but none scored high enough on intent. "
                "Credits refunded — try refining your ICP."
            )
            campaign.credits_charged = max(0, campaign.credits_charged - refund_amount)
            campaign.progress = 0
            campaign.progress_label = ""
            await db.commit()
            logger.info("Lead campaign %s: zero leads after enricher", campaign_id)
            return

        # Phase 5 — persist leads + complete.
        for e in enriched:
            cand = e.classified.candidate
            db.add(
                Lead(
                    id=uuid4(),
                    campaign_id=campaign.id,
                    round=round_number,
                    platform=cand.platform,
                    author_handle=cand.author_handle,
                    author_url=cand.author_url,
                    post_url=cand.post_url,
                    post_text=cand.post_text,
                    post_created_at=cand.post_created_at,
                    signal_type=e.classified.signal_type,
                    signal_quote=e.classified.signal_quote,
                    intent_score=e.intent_score,
                    enriched_role=e.role or None,
                    enriched_company=e.company or None,
                    enriched_niche=e.niche or None,
                    suggested_angle=e.suggested_angle or None,
                )
            )

        campaign.status = LeadCampaignStatus.completed
        campaign.progress = 100
        campaign.progress_label = "Done"
        campaign.leads_found = (campaign.leads_found or 0) + len(enriched)
        await db.commit()
        logger.info(
            "Lead campaign %s: completed round %s with %s leads",
            campaign_id,
            round_number,
            len(enriched),
        )
