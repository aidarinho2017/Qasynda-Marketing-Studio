import csv
import io
import logging
import uuid

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    HTTPException,
    Query,
    status,
)
from fastapi.responses import StreamingResponse
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.pricing import (
    LEAD_CAMPAIGN_BASE_CREDITS,
    LEAD_CAMPAIGN_BASE_SIZE,
    LEAD_CAMPAIGN_MAX_ROUNDS,
    LEAD_CAMPAIGN_TOPUP_CREDITS,
    LEAD_CAMPAIGN_TOPUP_SIZE,
)
from app.models.lead import Lead, LeadCampaign, LeadCampaignStatus
from app.models.user import User
from app.schemas.lead import (
    LeadCampaignCreateRequest,
    LeadCampaignDetail,
    LeadCampaignStartResponse,
    LeadCampaignSummary,
    LeadCampaignsListResponse,
    LeadOut,
)
from app.services.lead_search import pipeline as lead_pipeline

logger = logging.getLogger(__name__)

leads_router = APIRouter()


# ---------------------------------------------------------------------------
# POST /leads/campaigns
# ---------------------------------------------------------------------------


@leads_router.post(
    "/campaigns",
    response_model=LeadCampaignStartResponse,
    status_code=202,
)
async def start_campaign(
    payload: LeadCampaignCreateRequest,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeadCampaignStartResponse:
    """Start a new lead-search campaign.

    Charges base credits, creates a `pending` campaign row, and schedules the
    background pipeline. PR #1 stub: pipeline immediately refunds and marks
    failed; PR #2 will run the real channel selector + collectors.
    """
    cost = LEAD_CAMPAIGN_BASE_CREDITS
    if current_user.credits_balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: need {cost}, have {current_user.credits_balance}. "
                "Top up to continue."
            ),
        )

    campaign_id = uuid.uuid4()
    campaign = LeadCampaign(
        id=campaign_id,
        user_id=current_user.id,
        status=LeadCampaignStatus.pending,
        progress=0,
        progress_label="Queued",
        icp=payload.icp.model_dump(),
        leads_target=LEAD_CAMPAIGN_BASE_SIZE,
        leads_found=0,
        rounds=1,
        credits_charged=cost,
    )
    current_user.credits_balance -= cost
    db.add(campaign)
    await db.commit()

    background_tasks.add_task(
        lead_pipeline.run_campaign,
        campaign_id=campaign_id,
        user_id=current_user.id,
        refund_amount=cost,
    )

    logger.info(
        "Queued lead campaign %s for user %s (charged %s credits)",
        campaign_id,
        current_user.id,
        cost,
    )
    return LeadCampaignStartResponse(
        campaign_id=campaign_id,
        status=LeadCampaignStatus.pending,
    )


# ---------------------------------------------------------------------------
# GET /leads/campaigns
# ---------------------------------------------------------------------------


@leads_router.get("/campaigns", response_model=LeadCampaignsListResponse)
async def list_campaigns(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeadCampaignsListResponse:
    """Return the current user's lead campaigns, newest first."""
    total = (
        await db.execute(
            select(func.count(LeadCampaign.id)).where(
                LeadCampaign.user_id == current_user.id
            )
        )
    ).scalar_one()

    rows = (
        await db.execute(
            select(LeadCampaign)
            .where(LeadCampaign.user_id == current_user.id)
            .order_by(LeadCampaign.created_at.desc())
            .limit(limit)
            .offset(offset)
        )
    ).scalars().all()

    return LeadCampaignsListResponse(
        items=[LeadCampaignSummary.model_validate(c) for c in rows],
        total=total,
        limit=limit,
        offset=offset,
    )


# ---------------------------------------------------------------------------
# GET /leads/campaigns/{id}
# ---------------------------------------------------------------------------


@leads_router.get(
    "/campaigns/{campaign_id}",
    response_model=LeadCampaignDetail,
)
async def get_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeadCampaignDetail:
    """Return one campaign with its leads sorted by intent score desc."""
    campaign = (
        await db.execute(
            select(LeadCampaign).where(
                LeadCampaign.id == campaign_id,
                LeadCampaign.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    leads = (
        await db.execute(
            select(Lead)
            .where(Lead.campaign_id == campaign_id)
            .order_by(Lead.intent_score.desc(), Lead.created_at.desc())
        )
    ).scalars().all()

    detail = LeadCampaignDetail.model_validate(campaign)
    detail.leads = [LeadOut.model_validate(lead) for lead in leads]
    return detail


# ---------------------------------------------------------------------------
# POST /leads/campaigns/{id}/topup
# ---------------------------------------------------------------------------


@leads_router.post(
    "/campaigns/{campaign_id}/topup",
    response_model=LeadCampaignStartResponse,
    status_code=202,
)
async def topup_campaign(
    campaign_id: uuid.UUID,
    background_tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> LeadCampaignStartResponse:
    """Run another discovery round on an existing campaign.

    Charges `LEAD_CAMPAIGN_TOPUP_CREDITS`, bumps the round counter, raises the
    leads target by `LEAD_CAMPAIGN_TOPUP_SIZE`, and schedules a new pipeline
    run that dedups against post URLs from prior rounds.
    """
    campaign = (
        await db.execute(
            select(LeadCampaign)
            .where(
                LeadCampaign.id == campaign_id,
                LeadCampaign.user_id == current_user.id,
            )
            .with_for_update()
        )
    ).scalar_one_or_none()
    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    if campaign.status != LeadCampaignStatus.completed:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Top-up is only available on completed campaigns.",
        )

    if campaign.rounds >= LEAD_CAMPAIGN_MAX_ROUNDS:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Campaign already at the {LEAD_CAMPAIGN_MAX_ROUNDS}-round cap "
                "(100 leads). Start a new campaign if you need more."
            ),
        )

    cost = LEAD_CAMPAIGN_TOPUP_CREDITS
    if current_user.credits_balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: need {cost}, have {current_user.credits_balance}. "
                "Top up to continue."
            ),
        )

    existing_urls = (
        await db.execute(
            select(Lead.post_url).where(Lead.campaign_id == campaign_id)
        )
    ).scalars().all()
    existing_post_urls = set(existing_urls)

    next_round = campaign.rounds + 1
    campaign.rounds = next_round
    campaign.leads_target = (campaign.leads_target or 0) + LEAD_CAMPAIGN_TOPUP_SIZE
    campaign.credits_charged = (campaign.credits_charged or 0) + cost
    campaign.status = LeadCampaignStatus.pending
    campaign.progress = 0
    campaign.progress_label = "Queued"
    campaign.error_message = None
    campaign.refused_reason = None

    current_user.credits_balance -= cost
    await db.commit()

    background_tasks.add_task(
        lead_pipeline.run_campaign,
        campaign_id=campaign_id,
        user_id=current_user.id,
        refund_amount=cost,
        round_number=next_round,
        existing_post_urls=existing_post_urls,
    )

    logger.info(
        "Queued lead campaign top-up %s round %s for user %s (charged %s)",
        campaign_id,
        next_round,
        current_user.id,
        cost,
    )
    return LeadCampaignStartResponse(
        campaign_id=campaign_id,
        status=LeadCampaignStatus.pending,
    )


# ---------------------------------------------------------------------------
# GET /leads/campaigns/{id}/export.csv
# ---------------------------------------------------------------------------


_CSV_COLUMNS = [
    "score",
    "signal_type",
    "platform",
    "author",
    "role",
    "company",
    "niche",
    "suggested_angle",
    "signal_quote",
    "post_url",
    "post_created_at",
    "round",
]


@leads_router.get("/campaigns/{campaign_id}/export.csv")
async def export_campaign_csv(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> StreamingResponse:
    """Stream this campaign's leads as CSV, sorted by intent score desc."""
    campaign = (
        await db.execute(
            select(LeadCampaign).where(
                LeadCampaign.id == campaign_id,
                LeadCampaign.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    leads = (
        await db.execute(
            select(Lead)
            .where(Lead.campaign_id == campaign_id)
            .order_by(Lead.intent_score.desc(), Lead.created_at.desc())
        )
    ).scalars().all()

    buffer = io.StringIO()
    writer = csv.writer(buffer)
    writer.writerow(_CSV_COLUMNS)
    for lead in leads:
        writer.writerow(
            [
                lead.intent_score,
                lead.signal_type,
                lead.platform,
                lead.author_handle,
                lead.enriched_role or "",
                lead.enriched_company or "",
                lead.enriched_niche or "",
                lead.suggested_angle or "",
                lead.signal_quote,
                lead.post_url,
                lead.post_created_at.isoformat() if lead.post_created_at else "",
                lead.round,
            ]
        )
    buffer.seek(0)

    filename = f"leads-{campaign_id}.csv"
    return StreamingResponse(
        iter([buffer.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


# ---------------------------------------------------------------------------
# DELETE /leads/campaigns/{id}
# ---------------------------------------------------------------------------


@leads_router.delete("/campaigns/{campaign_id}", status_code=204)
async def delete_campaign(
    campaign_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Hard-delete a campaign and all its leads."""
    campaign = (
        await db.execute(
            select(LeadCampaign).where(
                LeadCampaign.id == campaign_id,
                LeadCampaign.user_id == current_user.id,
            )
        )
    ).scalar_one_or_none()
    if campaign is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Campaign not found",
        )

    await db.delete(campaign)
    await db.commit()
    logger.info("Deleted lead campaign %s for user %s", campaign_id, current_user.id)
