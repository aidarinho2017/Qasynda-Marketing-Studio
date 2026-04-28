import logging
import uuid

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
from app.models.generation import Generation, GenerationStatus, GenerationType
from app.models.user import User
from app.schemas.generation import (
    GenerationOut,
    GenerationStartResponse,
    GenerationsListResponse,
)
from app.services import image_service, storage_service

logger = logging.getLogger(__name__)

# POST /generate/...
generate_router = APIRouter()

# GET|DELETE /generations/...
generations_router = APIRouter()

_ALLOWED_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
_MAX_FILE_BYTES = 10 * 1024 * 1024  # 10 MB

_VALID_LAYOUTS = {"square", "portrait", "landscape"}
_VALID_CARD_STYLES = {"minimal", "premium", "bright", "infographic"}
_VALID_UGC_STYLES = {"realistic", "instagram", "tiktok"}
_MIN_DESCRIPTION_CHARS = 10


def _validate_and_read_image(image: UploadFile, raw: bytes) -> None:
    """Raise 422 if the upload is not an accepted image type or exceeds 10 MB."""
    if image.content_type not in _ALLOWED_CONTENT_TYPES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"Unsupported file type '{image.content_type}'. "
                "Accepted: image/jpeg, image/png, image/webp."
            ),
        )
    if len(raw) > _MAX_FILE_BYTES:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="File too large. Maximum allowed size is 10 MB.",
        )


# ---------------------------------------------------------------------------
# POST /generate/marketplace
# ---------------------------------------------------------------------------


@generate_router.post("/marketplace", response_model=GenerationStartResponse, status_code=202)
async def generate_marketplace(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(..., description="Product photo (JPEG/PNG/WebP, max 10 MB)"),
    description: str = Form(..., description="Free-text description of the product"),
    style: str = Form(default="minimal", description="minimal | premium | bright | infographic"),
    layout: str = Form(default="square", description="square | portrait | landscape"),
    creativity: int = Form(default=5, ge=1, le=10, description="Creativity level 1–10"),
    count: int = Form(default=4, ge=1, le=4, description="Number of images to generate (1–4)"),
    reference_image: UploadFile | None = File(
        default=None,
        description="Optional reference design (JPEG/PNG/WebP, max 10 MB)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GenerationStartResponse:
    """Start an async marketplace product-card generation job.

    Raises:
        422: Invalid file type, file too large, or invalid enum values.
    """
    if style not in _VALID_CARD_STYLES:
        raise HTTPException(422, detail=f"style must be one of {sorted(_VALID_CARD_STYLES)}")
    if layout not in _VALID_LAYOUTS:
        raise HTTPException(422, detail=f"layout must be one of {sorted(_VALID_LAYOUTS)}")
    if len(description.strip()) < _MIN_DESCRIPTION_CHARS:
        raise HTTPException(
            422,
            detail=f"description must be at least {_MIN_DESCRIPTION_CHARS} characters.",
        )

    cost = credits_for_count(count)
    if current_user.credits_balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: need {cost}, have {current_user.credits_balance}. "
                "Top up to continue."
            ),
        )

    image_bytes = await image.read()
    _validate_and_read_image(image, image_bytes)

    reference_bytes: bytes | None = None
    if reference_image is not None and reference_image.filename:
        reference_bytes = await reference_image.read()
        _validate_and_read_image(reference_image, reference_bytes)

    generation_id = uuid.uuid4()
    ext = (image.content_type or "image/jpeg").split("/")[-1]
    source_key = f"{current_user.id}/{generation_id}/source.{ext}"

    source_url = await storage_service.upload_bytes(
        settings.SUPABASE_BUCKET_UPLOADS,
        source_key,
        image_bytes,
        image.content_type or "image/jpeg",
    )

    if reference_bytes is not None:
        ref_ext = (reference_image.content_type or "image/jpeg").split("/")[-1]
        ref_key = f"{current_user.id}/{generation_id}/reference.{ref_ext}"
        await storage_service.upload_bytes(
            settings.SUPABASE_BUCKET_UPLOADS,
            ref_key,
            reference_bytes,
            reference_image.content_type or "image/jpeg",
        )

    generation = Generation(
        id=generation_id,
        user_id=current_user.id,
        type=GenerationType.marketplace,
        status=GenerationStatus.pending,
        input_data={
            "description": description.strip(),
            "style": style,
            "layout": layout,
            "creativity": creativity,
            "count": count,
            "credits_charged": cost,
            "has_reference": reference_bytes is not None,
        },
        source_image_url=source_url,
        image_urls=[],
    )
    current_user.credits_balance -= cost
    db.add(generation)
    await db.commit()

    background_tasks.add_task(
        image_service.generate_marketplace,
        generation_id=generation_id,
        user_id=current_user.id,
        image_bytes=image_bytes,
        description=description.strip(),
        style=style,
        layout=layout,
        creativity=creativity,
        count=count,
        reference_bytes=reference_bytes,
    )

    logger.info(
        "Queued marketplace generation %s for user %s",
        generation_id,
        current_user.id,
    )
    return GenerationStartResponse(
        generation_id=generation_id,
        status=GenerationStatus.pending,
    )


# ---------------------------------------------------------------------------
# POST /generate/enhance
# ---------------------------------------------------------------------------


@generate_router.post("/enhance", response_model=GenerationStartResponse, status_code=202)
async def generate_enhance(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(..., description="Product photo to enhance (JPEG/PNG/WebP, max 10 MB)"),
    wishes: str = Form(default="", description="Optional notes on how to improve the photo"),
    count: int = Form(default=4, ge=1, le=4, description="Number of enhanced variants (1–4)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GenerationStartResponse:
    """Start an async product-photo enhancement job.

    Cleans up the user's source photo: removes the background, fixes lighting,
    sharpens detail. Same credit cost as marketplace/UGC.
    """
    cost = credits_for_count(count)
    if current_user.credits_balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: need {cost}, have {current_user.credits_balance}. "
                "Top up to continue."
            ),
        )

    image_bytes = await image.read()
    _validate_and_read_image(image, image_bytes)

    generation_id = uuid.uuid4()
    ext = (image.content_type or "image/jpeg").split("/")[-1]
    source_key = f"{current_user.id}/{generation_id}/source.{ext}"

    source_url = await storage_service.upload_bytes(
        settings.SUPABASE_BUCKET_UPLOADS,
        source_key,
        image_bytes,
        image.content_type or "image/jpeg",
    )

    generation = Generation(
        id=generation_id,
        user_id=current_user.id,
        type=GenerationType.enhance,
        status=GenerationStatus.pending,
        input_data={
            "wishes": wishes.strip(),
            "count": count,
            "credits_charged": cost,
        },
        source_image_url=source_url,
        image_urls=[],
    )
    current_user.credits_balance -= cost
    db.add(generation)
    await db.commit()

    background_tasks.add_task(
        image_service.generate_enhance,
        generation_id=generation_id,
        user_id=current_user.id,
        image_bytes=image_bytes,
        wishes=wishes.strip(),
        count=count,
    )

    logger.info(
        "Queued enhance generation %s for user %s",
        generation_id,
        current_user.id,
    )
    return GenerationStartResponse(
        generation_id=generation_id,
        status=GenerationStatus.pending,
    )


# ---------------------------------------------------------------------------
# POST /generate/fat-maker  (mini app)
# ---------------------------------------------------------------------------


@generate_router.post("/fat-maker", response_model=GenerationStartResponse, status_code=202)
async def generate_fat_maker(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(..., description="Photo of the person (JPEG/PNG/WebP, max 10 MB)"),
    wishes: str = Form(default="", description="Optional creative wishes"),
    fatness: int = Form(default=5, ge=1, le=10, description="Fatness intensity 1–10"),
    count: int = Form(default=1, ge=1, le=4, description="Number of variants (1–4)"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GenerationStartResponse:
    """Start an async 'Fat Maker' mini-app generation."""
    cost = credits_for_count(count)
    if current_user.credits_balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: need {cost}, have {current_user.credits_balance}. "
                "Top up to continue."
            ),
        )

    image_bytes = await image.read()
    _validate_and_read_image(image, image_bytes)

    generation_id = uuid.uuid4()
    ext = (image.content_type or "image/jpeg").split("/")[-1]
    source_key = f"{current_user.id}/{generation_id}/source.{ext}"

    source_url = await storage_service.upload_bytes(
        settings.SUPABASE_BUCKET_UPLOADS,
        source_key,
        image_bytes,
        image.content_type or "image/jpeg",
    )

    generation = Generation(
        id=generation_id,
        user_id=current_user.id,
        type=GenerationType.mini_app,
        status=GenerationStatus.pending,
        input_data={
            "app_id": "fat_maker",
            "wishes": wishes.strip(),
            "fatness": fatness,
            "count": count,
            "credits_charged": cost,
        },
        source_image_url=source_url,
        image_urls=[],
    )
    current_user.credits_balance -= cost
    db.add(generation)
    await db.commit()

    background_tasks.add_task(
        image_service.generate_fat_maker,
        generation_id=generation_id,
        user_id=current_user.id,
        image_bytes=image_bytes,
        wishes=wishes.strip(),
        fatness=fatness,
        count=count,
    )

    logger.info(
        "Queued fat-maker generation %s for user %s (fatness=%d)",
        generation_id,
        current_user.id,
        fatness,
    )
    return GenerationStartResponse(
        generation_id=generation_id,
        status=GenerationStatus.pending,
    )


# ---------------------------------------------------------------------------
# POST /generate/ugc
# ---------------------------------------------------------------------------


@generate_router.post("/ugc", response_model=GenerationStartResponse, status_code=202)
async def generate_ugc(
    background_tasks: BackgroundTasks,
    image: UploadFile = File(..., description="Product photo (JPEG/PNG/WebP, max 10 MB)"),
    use_case: str = Form(..., description="How the product is being used"),
    wishes: str = Form(default="", description="Optional creative wishes"),
    style: str = Form(default="realistic", description="realistic | instagram | tiktok"),
    layout: str = Form(default="square", description="square | portrait | landscape"),
    creativity: int = Form(default=5, ge=1, le=10, description="Creativity level 1–10"),
    count: int = Form(default=4, ge=1, le=4, description="Number of images to generate (1–4)"),
    reference_image: UploadFile | None = File(
        default=None,
        description="Optional reference design (JPEG/PNG/WebP, max 10 MB)",
    ),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GenerationStartResponse:
    """Start an async UGC-style image generation job.

    Raises:
        422: Invalid file type, file too large, or invalid enum values.
    """
    if style not in _VALID_UGC_STYLES:
        raise HTTPException(422, detail=f"style must be one of {sorted(_VALID_UGC_STYLES)}")
    if layout not in _VALID_LAYOUTS:
        raise HTTPException(422, detail=f"layout must be one of {sorted(_VALID_LAYOUTS)}")
    if len(use_case.strip()) < _MIN_DESCRIPTION_CHARS:
        raise HTTPException(
            422,
            detail=f"use_case must be at least {_MIN_DESCRIPTION_CHARS} characters.",
        )

    cost = credits_for_count(count)
    if current_user.credits_balance < cost:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: need {cost}, have {current_user.credits_balance}. "
                "Top up to continue."
            ),
        )

    image_bytes = await image.read()
    _validate_and_read_image(image, image_bytes)

    reference_bytes: bytes | None = None
    if reference_image is not None and reference_image.filename:
        reference_bytes = await reference_image.read()
        _validate_and_read_image(reference_image, reference_bytes)

    generation_id = uuid.uuid4()
    ext = (image.content_type or "image/jpeg").split("/")[-1]
    source_key = f"{current_user.id}/{generation_id}/source.{ext}"

    source_url = await storage_service.upload_bytes(
        settings.SUPABASE_BUCKET_UPLOADS,
        source_key,
        image_bytes,
        image.content_type or "image/jpeg",
    )

    if reference_bytes is not None:
        ref_ext = (reference_image.content_type or "image/jpeg").split("/")[-1]
        ref_key = f"{current_user.id}/{generation_id}/reference.{ref_ext}"
        await storage_service.upload_bytes(
            settings.SUPABASE_BUCKET_UPLOADS,
            ref_key,
            reference_bytes,
            reference_image.content_type or "image/jpeg",
        )

    generation = Generation(
        id=generation_id,
        user_id=current_user.id,
        type=GenerationType.ugc,
        status=GenerationStatus.pending,
        input_data={
            "use_case": use_case.strip(),
            "wishes": wishes.strip(),
            "style": style,
            "layout": layout,
            "creativity": creativity,
            "count": count,
            "credits_charged": cost,
            "has_reference": reference_bytes is not None,
        },
        source_image_url=source_url,
        image_urls=[],
    )
    current_user.credits_balance -= cost
    db.add(generation)
    await db.commit()

    background_tasks.add_task(
        image_service.generate_ugc,
        generation_id=generation_id,
        user_id=current_user.id,
        image_bytes=image_bytes,
        use_case=use_case.strip(),
        wishes=wishes.strip(),
        style=style,
        layout=layout,
        creativity=creativity,
        count=count,
        reference_bytes=reference_bytes,
    )

    logger.info(
        "Queued UGC generation %s for user %s",
        generation_id,
        current_user.id,
    )
    return GenerationStartResponse(
        generation_id=generation_id,
        status=GenerationStatus.pending,
    )


# ---------------------------------------------------------------------------
# GET /generations
# ---------------------------------------------------------------------------


@generations_router.get("", response_model=GenerationsListResponse)
async def list_generations(
    limit: int = Query(default=20, ge=1, le=100),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GenerationsListResponse:
    """Return the current user's generations, newest first, with pagination."""
    count_result = await db.execute(
        select(func.count(Generation.id)).where(
            Generation.user_id == current_user.id
        )
    )
    total = count_result.scalar_one()

    rows_result = await db.execute(
        select(Generation)
        .where(Generation.user_id == current_user.id)
        .order_by(Generation.created_at.desc())
        .limit(limit)
        .offset(offset)
    )
    generations = rows_result.scalars().all()

    return GenerationsListResponse(
        items=[GenerationOut.model_validate(g) for g in generations],
        total=total,
        limit=limit,
        offset=offset,
    )


# ---------------------------------------------------------------------------
# GET /generations/{id}
# ---------------------------------------------------------------------------


@generations_router.get("/{generation_id}", response_model=GenerationOut)
async def get_generation(
    generation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> GenerationOut:
    """Return a single generation by ID.

    Raises:
        404: If the generation does not exist or belongs to another user.
    """
    result = await db.execute(
        select(Generation).where(
            Generation.id == generation_id,
            Generation.user_id == current_user.id,
        )
    )
    generation = result.scalar_one_or_none()
    if generation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation not found")

    return GenerationOut.model_validate(generation)


# ---------------------------------------------------------------------------
# DELETE /generations/{id}
# ---------------------------------------------------------------------------


@generations_router.delete("/{generation_id}", status_code=204)
async def delete_generation(
    generation_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
) -> None:
    """Hard-delete a generation and all its associated storage objects.

    Deletes the source image from the uploads bucket, all generated images
    from the generations bucket, and finally the database row.

    Raises:
        404: If the generation does not exist or belongs to another user.
    """
    result = await db.execute(
        select(Generation).where(
            Generation.id == generation_id,
            Generation.user_id == current_user.id,
        )
    )
    generation = result.scalar_one_or_none()
    if generation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Generation not found")

    # Delete source image
    try:
        src_bucket, src_key = storage_service.extract_bucket_and_key(
            generation.source_image_url
        )
        await storage_service.delete_object(src_bucket, src_key)
    except Exception as exc:
        logger.warning(
            "Could not delete source image for generation %s: %s",
            generation_id,
            exc,
        )

    # Delete all generated images
    for url in generation.image_urls or []:
        try:
            bucket, key = storage_service.extract_bucket_and_key(url)
            await storage_service.delete_object(bucket, key)
        except Exception as exc:
            logger.warning(
                "Could not delete generated image %s for generation %s: %s",
                url,
                generation_id,
                exc,
            )

    await db.delete(generation)
    await db.commit()
    logger.info("Deleted generation %s and its storage objects", generation_id)
