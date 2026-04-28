import logging

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.pricing import (
    CREDITS_BY_COUNT,
    CREDITS_PER_IMAGE,
    TOPUP_PACKS,
    get_topup_pack,
)
from app.models.user import User
from app.schemas.user import (
    PricingResponse,
    TopupPackOut,
    TopupRequest,
    TopupResponse,
    UserOut,
)

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/me", response_model=UserOut)
async def get_me(current_user: User = Depends(get_current_user)) -> UserOut:
    """Return the currently authenticated user's profile."""
    return UserOut.model_validate(current_user)


@router.post("/me/topup", response_model=TopupResponse)
async def topup(
    req: TopupRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> TopupResponse:
    """Fake top-up: add the selected pack's credits, no payment processed."""
    pack = get_topup_pack(req.pack_id)
    if pack is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Unknown top-up pack '{req.pack_id}'.",
        )

    current_user.credits_balance += pack.credits
    await db.commit()
    await db.refresh(current_user)

    logger.info(
        "Top-up: user %s +%s credits (pack=%s, new balance %s)",
        current_user.id,
        pack.credits,
        pack.id,
        current_user.credits_balance,
    )

    return TopupResponse(
        credits_balance=current_user.credits_balance,
        credits_added=pack.credits,
        price_usd=pack.price_usd,
        pack_id=pack.id,
    )


@router.get("/pricing", response_model=PricingResponse)
async def get_pricing() -> PricingResponse:
    """Public pricing table — credits per image, bundle costs, top-up packs."""
    return PricingResponse(
        credits_per_image=CREDITS_PER_IMAGE,
        credits_by_count=CREDITS_BY_COUNT,
        topup_packs=[TopupPackOut(**p.to_dict()) for p in TOPUP_PACKS],
    )
