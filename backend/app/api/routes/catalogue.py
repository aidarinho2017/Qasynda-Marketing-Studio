import logging
import uuid
from typing import List

from fastapi import (
    APIRouter,
    BackgroundTasks,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.deps import get_current_user, get_db
from app.core.config import settings
from app.core.pricing import credits_for_count
from app.models.catalogue import Catalogue
from app.models.generation import Generation, GenerationStatus, GenerationType
from app.models.user import User
from app.schemas.catalogue import (
    CatalogueDetail,
    CatalogueListItem,
    CatalogueStartResponse,
    CataloguesListResponse,
)
from app.schemas.generation import GenerationOut
from app.services import image_service, storage_service

logger = logging.getLogger(__name__)

catalogue_router = APIRouter()

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_FILE_BYTES = 10 * 1024 * 1024
_MAX_FILES = 20
_COST_PER_PRODUCT = credits_for_count(4)  # 17 credits

_VALID_LAYOUTS = {"square", "portrait", "landscape"}
_VALID_CARD_STYLES = {"minimal", "premium", "bright", "infographic"}


def _validate_file(upload: UploadFile, raw: bytes) -> None:
    if upload.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Unsupported file type '{upload.content_type}' for '{upload.filename}'. "
                "Accepted: image/jpeg, image/png, image/webp."
            ),
        )
    if len(raw) > _MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"File '{upload.filename}' exceeds the 10 MB limit.",
        )


# ---------------------------------------------------------------------------
# POST /catalogue
# ---------------------------------------------------------------------------


@catalogue_router.post("", response_model=CatalogueStartResponse, status_code=202)
async def create_catalogue(
    background_tasks: BackgroundTasks,
    files: List[UploadFile] = File(..., description="Product images (1–20, JPEG/PNG/WebP, max 10 MB each)"),
    name: str | None = Form(default=None, description="Optional catalogue name"),
    style: str = Form(default="minimal", description="minimal | premium | bright | infographic"),
    layout: str = Form(default="square", description="square | portrait | landscape"),
    creativity: int = Form(default=5, ge=1, le=10, description="Creativity level 1–10"),
    description: str | None = Form(default=None, description="Optional shared product context"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CatalogueStartResponse:
    """Queue marketplace-image generation for a batch of product photos.

    Charges credits for all products upfront, creates one Generation row per
    file, then schedules background tasks. A single DB commit covers the whole
    batch so partial failures roll back cleanly.
    """
    if style not in _VALID_CARD_STYLES:
        raise HTTPException(422, detail=f"style must be one of {sorted(_VALID_CARD_STYLES)}")
    if layout not in _VALID_LAYOUTS:
        raise HTTPException(422, detail=f"layout must be one of {sorted(_VALID_LAYOUTS)}")
    if not files or len(files) < 1:
        raise HTTPException(422, detail="At least one image is required.")
    if len(files) > _MAX_FILES:
        raise HTTPException(422, detail=f"Maximum {_MAX_FILES} images per catalogue.")

    # Read all files into memory and validate before touching the DB.
    file_data: list[tuple[UploadFile, bytes]] = []
    for upload in files:
        raw = await upload.read()
        _validate_file(upload, raw)
        file_data.append((upload, raw))

    total_cost = len(file_data) * _COST_PER_PRODUCT
    if current_user.credits_balance < total_cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: need {total_cost} "
                f"({len(file_data)} products × {_COST_PER_PRODUCT}), "
                f"have {current_user.credits_balance}. Top up to continue."
            ),
        )

    shared_description = description.strip() if description else ""

    # Create the Catalogue record.
    catalogue = Catalogue(
        user_id=current_user.id,
        name=name.strip() if name else None,
        mode="marketplace",
        settings={"style": style, "layout": layout, "creativity": creativity},
        total_items=len(file_data),
    )
    db.add(catalogue)

    # For each file: deduct credits, upload source image, create Generation row.
    generation_ids: list[uuid.UUID] = []
    task_args: list[dict] = []

    for upload, raw in file_data:
        generation_id = uuid.uuid4()
        ext = (upload.content_type or "image/jpeg").split("/")[-1]
        source_key = f"{current_user.id}/{generation_id}/source.{ext}"

        source_url = await storage_service.upload_bytes(
            settings.SUPABASE_BUCKET_UPLOADS,
            source_key,
            raw,
            upload.content_type or "image/jpeg",
        )

        generation = Generation(
            id=generation_id,
            user_id=current_user.id,
            type=GenerationType.marketplace,
            status=GenerationStatus.pending,
            catalogue_id=catalogue.id,
            input_data={
                "description": shared_description,
                "style": style,
                "layout": layout,
                "creativity": creativity,
                "count": 4,
                "credits_charged": _COST_PER_PRODUCT,
                "catalogue_id": str(catalogue.id),
            },
            source_image_url=source_url,
            image_urls=[],
        )
        current_user.credits_balance -= _COST_PER_PRODUCT
        db.add(generation)

        generation_ids.append(generation_id)
        task_args.append(
            dict(
                generation_id=generation_id,
                user_id=current_user.id,
                image_bytes=raw,
                description=shared_description,
                style=style,
                layout=layout,
                creativity=creativity,
                count=4,
            )
        )

    # Single atomic commit: catalogue + all generations + credit deductions.
    await db.commit()

    # Schedule background tasks only after the commit succeeds.
    for kwargs in task_args:
        background_tasks.add_task(image_service.generate_marketplace, **kwargs)

    logger.info(
        "Queued catalogue %s with %d products for user %s",
        catalogue.id,
        len(file_data),
        current_user.id,
    )
    return CatalogueStartResponse(
        catalogue_id=catalogue.id,
        generation_ids=generation_ids,
    )


# ---------------------------------------------------------------------------
# GET /catalogue
# ---------------------------------------------------------------------------


@catalogue_router.get("", response_model=CataloguesListResponse)
async def list_catalogues(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CataloguesListResponse:
    """Return the current user's catalogues, newest first."""
    count_res = await db.execute(
        select(func.count(Catalogue.id)).where(Catalogue.user_id == current_user.id)
    )
    total = count_res.scalar_one()

    rows_res = await db.execute(
        select(Catalogue)
        .where(Catalogue.user_id == current_user.id)
        .order_by(Catalogue.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    catalogues = rows_res.scalars().all()

    if not catalogues:
        return CataloguesListResponse(items=[], total=total, limit=limit, offset=offset)

    # Fetch generation status counts for all catalogues in one query.
    ids = [c.id for c in catalogues]
    counts_res = await db.execute(
        select(
            Generation.catalogue_id,
            Generation.status,
            func.count(Generation.id).label("n"),
        )
        .where(Generation.catalogue_id.in_(ids))
        .group_by(Generation.catalogue_id, Generation.status)
    )
    progress: dict[uuid.UUID, dict[str, int]] = {}
    for catalogue_id, gen_status, n in counts_res:
        bucket = progress.setdefault(catalogue_id, {"completed": 0, "failed": 0})
        if gen_status == GenerationStatus.completed:
            bucket["completed"] += n
        elif gen_status == GenerationStatus.failed:
            bucket["failed"] += n

    items = [
        CatalogueListItem(
            id=c.id,
            name=c.name,
            mode=c.mode,
            settings=c.settings,
            total_items=c.total_items,
            completed=progress.get(c.id, {}).get("completed", 0),
            failed=progress.get(c.id, {}).get("failed", 0),
            created_at=c.created_at,
            updated_at=c.updated_at,
        )
        for c in catalogues
    ]
    return CataloguesListResponse(items=items, total=total, limit=limit, offset=offset)


# ---------------------------------------------------------------------------
# GET /catalogue/{catalogue_id}
# ---------------------------------------------------------------------------


@catalogue_router.get("/{catalogue_id}", response_model=CatalogueDetail)
async def get_catalogue(
    catalogue_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> CatalogueDetail:
    """Return a catalogue and all its generations."""
    cat_res = await db.execute(
        select(Catalogue).where(
            Catalogue.id == catalogue_id,
            Catalogue.user_id == current_user.id,
        )
    )
    catalogue = cat_res.scalar_one_or_none()
    if catalogue is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Catalogue not found")

    gens_res = await db.execute(
        select(Generation)
        .where(Generation.catalogue_id == catalogue_id)
        .order_by(Generation.created_at.asc())
    )
    generations = gens_res.scalars().all()

    completed = sum(1 for g in generations if g.status == GenerationStatus.completed)
    failed = sum(1 for g in generations if g.status == GenerationStatus.failed)

    return CatalogueDetail(
        id=catalogue.id,
        name=catalogue.name,
        mode=catalogue.mode,
        settings=catalogue.settings,
        total_items=catalogue.total_items,
        completed=completed,
        failed=failed,
        created_at=catalogue.created_at,
        updated_at=catalogue.updated_at,
        generations=[GenerationOut.model_validate(g) for g in generations],
    )
