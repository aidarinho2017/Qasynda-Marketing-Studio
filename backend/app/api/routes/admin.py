import logging
import uuid
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_admin_user, get_db
from app.models.catalogue import Catalogue
from app.models.generation import Generation, GenerationStatus, GenerationType
from app.models.user import User
from app.schemas.generation import GenerationOut
from app.schemas.user import UserOut

logger = logging.getLogger(__name__)
admin_router = APIRouter()


# ── Schemas ──────────────────────────────────────────────────────────────────

class AdminStats(BaseModel):
    total_users: int
    total_generations: int
    total_catalogues: int
    generations_by_status: dict[str, int]
    generations_by_type: dict[str, int]
    recent_failures: list[dict]


class AdminUserListItem(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar: str | None
    credits_balance: float
    is_admin: bool
    generation_count: int
    created_at: str

    model_config = {"from_attributes": True}


class AdminUsersListResponse(BaseModel):
    items: list[AdminUserListItem]
    total: int
    limit: int
    offset: int


class AdminUserDetail(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    avatar: str | None
    credits_balance: float
    is_admin: bool
    created_at: str
    generation_count: int
    recent_generations: list[GenerationOut]


class AdminUserPatch(BaseModel):
    credits_balance: float | None = None
    is_admin: bool | None = None


class AdminGenerationItem(BaseModel):
    id: uuid.UUID
    type: str
    status: str
    user_email: str
    user_name: str
    created_at: str
    error_message: str | None


class AdminGenerationsListResponse(BaseModel):
    items: list[AdminGenerationItem]
    total: int
    limit: int
    offset: int


# ── Routes ───────────────────────────────────────────────────────────────────


@admin_router.get("/stats", response_model=AdminStats)
async def get_stats(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> AdminStats:
    """Aggregate metrics for the admin dashboard."""
    total_users = (await db.execute(select(func.count(User.id)))).scalar_one()
    total_catalogues = (await db.execute(select(func.count(Catalogue.id)))).scalar_one()

    # Generation counts grouped by status and type in two queries.
    status_rows = (await db.execute(
        select(Generation.status, func.count(Generation.id).label("n"))
        .group_by(Generation.status)
    )).all()
    type_rows = (await db.execute(
        select(Generation.type, func.count(Generation.id).label("n"))
        .group_by(Generation.type)
    )).all()

    total_generations = sum(n for _, n in status_rows)
    generations_by_status = {s.value: n for s, n in status_rows}
    generations_by_type = {t.value: n for t, n in type_rows}

    # Last 10 failures with user email.
    failure_rows = (await db.execute(
        select(Generation, User.email, User.name)
        .join(User, Generation.user_id == User.id)
        .where(Generation.status == GenerationStatus.failed)
        .order_by(Generation.created_at.desc())
        .limit(10)
    )).all()

    recent_failures = [
        {
            "id": str(g.id),
            "type": g.type.value,
            "user_email": email,
            "user_name": name,
            "error_message": g.error_message,
            "created_at": g.created_at.isoformat(),
        }
        for g, email, name in failure_rows
    ]

    return AdminStats(
        total_users=total_users,
        total_generations=total_generations,
        total_catalogues=total_catalogues,
        generations_by_status=generations_by_status,
        generations_by_type=generations_by_type,
        recent_failures=recent_failures,
    )


@admin_router.get("/users", response_model=AdminUsersListResponse)
async def list_users(
    search: str | None = Query(default=None, description="Filter by name or email"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> AdminUsersListResponse:
    """Paginated list of all users with their generation counts."""
    base = select(User)
    count_q = select(func.count(User.id))

    if search:
        pattern = f"%{search.strip()}%"
        base = base.where(User.email.ilike(pattern) | User.name.ilike(pattern))
        count_q = count_q.where(User.email.ilike(pattern) | User.name.ilike(pattern))

    total = (await db.execute(count_q)).scalar_one()
    users = (await db.execute(
        base.order_by(User.created_at.desc()).limit(limit).offset(offset)
    )).scalars().all()

    if not users:
        return AdminUsersListResponse(items=[], total=total, limit=limit, offset=offset)

    # Generation counts per user — single grouped query.
    user_ids = [u.id for u in users]
    gen_counts_rows = (await db.execute(
        select(Generation.user_id, func.count(Generation.id).label("n"))
        .where(Generation.user_id.in_(user_ids))
        .group_by(Generation.user_id)
    )).all()
    gen_counts = {uid: n for uid, n in gen_counts_rows}

    items = [
        AdminUserListItem(
            id=u.id,
            email=u.email,
            name=u.name,
            avatar=u.avatar,
            credits_balance=float(u.credits_balance),
            is_admin=u.is_admin,
            generation_count=gen_counts.get(u.id, 0),
            created_at=u.created_at.isoformat(),
        )
        for u in users
    ]
    return AdminUsersListResponse(items=items, total=total, limit=limit, offset=offset)


@admin_router.get("/users/{user_id}", response_model=AdminUserDetail)
async def get_user(
    user_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> AdminUserDetail:
    """Full user detail including last 10 generations."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    gen_count = (await db.execute(
        select(func.count(Generation.id)).where(Generation.user_id == user_id)
    )).scalar_one()

    recent_gens = (await db.execute(
        select(Generation)
        .where(Generation.user_id == user_id)
        .order_by(Generation.created_at.desc())
        .limit(10)
    )).scalars().all()

    return AdminUserDetail(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar=user.avatar,
        credits_balance=float(user.credits_balance),
        is_admin=user.is_admin,
        created_at=user.created_at.isoformat(),
        generation_count=gen_count,
        recent_generations=[GenerationOut.model_validate(g) for g in recent_gens],
    )


@admin_router.patch("/users/{user_id}", response_model=AdminUserDetail)
async def patch_user(
    user_id: uuid.UUID,
    body: AdminUserPatch,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user),
) -> AdminUserDetail:
    """Update a user's credits or admin status."""
    user = (await db.execute(select(User).where(User.id == user_id))).scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    if body.credits_balance is not None:
        if body.credits_balance < 0:
            raise HTTPException(422, detail="credits_balance cannot be negative")
        user.credits_balance = Decimal(str(round(body.credits_balance, 2)))
        logger.info("Admin %s set credits for user %s to %.2f", admin.id, user_id, body.credits_balance)

    if body.is_admin is not None:
        # Prevent an admin from revoking their own admin status.
        if user_id == admin.id and not body.is_admin:
            raise HTTPException(422, detail="Cannot revoke your own admin status")
        user.is_admin = body.is_admin
        logger.info("Admin %s set is_admin=%s for user %s", admin.id, body.is_admin, user_id)

    await db.commit()
    await db.refresh(user)

    # Re-fetch detail to return consistent shape.
    gen_count = (await db.execute(
        select(func.count(Generation.id)).where(Generation.user_id == user_id)
    )).scalar_one()
    recent_gens = (await db.execute(
        select(Generation)
        .where(Generation.user_id == user_id)
        .order_by(Generation.created_at.desc())
        .limit(10)
    )).scalars().all()

    return AdminUserDetail(
        id=user.id,
        email=user.email,
        name=user.name,
        avatar=user.avatar,
        credits_balance=float(user.credits_balance),
        is_admin=user.is_admin,
        created_at=user.created_at.isoformat(),
        generation_count=gen_count,
        recent_generations=[GenerationOut.model_validate(g) for g in recent_gens],
    )


@admin_router.get("/generations", response_model=AdminGenerationsListResponse)
async def list_all_generations(
    filter_status: str | None = Query(default=None, alias="status"),
    filter_type: str | None = Query(default=None, alias="type"),
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(get_admin_user),
) -> AdminGenerationsListResponse:
    """All generations across all users with optional status/type filter."""
    base = select(Generation, User.email, User.name).join(User, Generation.user_id == User.id)
    count_q = select(func.count(Generation.id)).join(User, Generation.user_id == User.id)

    if filter_status:
        try:
            s = GenerationStatus(filter_status)
            base = base.where(Generation.status == s)
            count_q = count_q.where(Generation.status == s)
        except ValueError:
            raise HTTPException(422, detail=f"Invalid status '{filter_status}'")

    if filter_type:
        try:
            t = GenerationType(filter_type)
            base = base.where(Generation.type == t)
            count_q = count_q.where(Generation.type == t)
        except ValueError:
            raise HTTPException(422, detail=f"Invalid type '{filter_type}'")

    total = (await db.execute(count_q)).scalar_one()
    rows = (await db.execute(
        base.order_by(Generation.created_at.desc()).limit(limit).offset(offset)
    )).all()

    items = [
        AdminGenerationItem(
            id=g.id,
            type=g.type.value,
            status=g.status.value,
            user_email=email,
            user_name=name,
            created_at=g.created_at.isoformat(),
            error_message=g.error_message,
        )
        for g, email, name in rows
    ]
    return AdminGenerationsListResponse(items=items, total=total, limit=limit, offset=offset)
