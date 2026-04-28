import asyncio
import base64
import logging
import uuid
from uuid import UUID

from google import genai
from google.genai import types
from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.generation import Generation, GenerationStatus
from app.services import storage_service
from app.services.prompts import (
    build_enhance_prompt,
    build_fat_maker_prompt,
    build_marketplace_prompt,
    build_ugc_prompt,
)

logger = logging.getLogger(__name__)

_client: genai.Client | None = None


def _get_client() -> genai.Client:
    global _client
    if _client is None:
        _client = genai.Client(api_key=settings.GEMINI_API_KEY)
    return _client


async def _call_nano_banana(
    image_bytes: bytes,
    prompt: str,
    reference_bytes: bytes | None = None,
) -> bytes:
    """Call the Gemini image generation model once and return raw image bytes.

    Args:
        image_bytes: Source product image bytes (always sent first).
        prompt: Detailed generation instruction for this variant.
        reference_bytes: Optional second image used as a style/composition guide.

    Returns:
        Generated image as raw bytes.

    Raises:
        ValueError: If the model returns a response with no image part.
    """
    client = _get_client()

    parts: list[types.Part] = [
        types.Part(
            inline_data=types.Blob(mime_type="image/jpeg", data=image_bytes)
        ),
    ]
    if reference_bytes is not None:
        parts.append(
            types.Part(
                inline_data=types.Blob(mime_type="image/jpeg", data=reference_bytes)
            )
        )
    parts.append(types.Part(text=prompt))

    response = await client.aio.models.generate_content(
        model=settings.GEMINI_IMAGE_MODEL,
        contents=[types.Content(role="user", parts=parts)],
        config=types.GenerateContentConfig(
            response_modalities=["IMAGE", "TEXT"],
        ),
    )

    for part in response.candidates[0].content.parts:
        if part.inline_data is not None:
            img_data = part.inline_data.data
            if isinstance(img_data, str):
                return base64.b64decode(img_data)
            return img_data

    raise ValueError("Nano Banana Pro returned no image in its response")


async def _generate_variants(
    image_bytes: bytes,
    prompt: str,
    count: int,
    reference_bytes: bytes | None = None,
) -> list[bytes]:
    tasks = [
        _call_nano_banana(image_bytes, prompt, reference_bytes) for _ in range(count)
    ]
    return list(await asyncio.gather(*tasks))


async def _upload_variants(
    variant_bytes_list: list[bytes],
    user_id: UUID,
    generation_id: UUID,
) -> list[str]:
    urls: list[str] = []
    for img_bytes in variant_bytes_list:
        key = f"{user_id}/{generation_id}/{uuid.uuid4()}.png"
        url = await storage_service.upload_bytes(
            settings.SUPABASE_BUCKET_GENERATIONS,
            key,
            img_bytes,
            "image/png",
        )
        urls.append(url)
    return urls


async def generate_marketplace(
    generation_id: UUID,
    user_id: UUID,
    image_bytes: bytes,
    description: str,
    style: str,
    layout: str,
    creativity: int,
    count: int = 4,
    reference_bytes: bytes | None = None,
) -> None:
    """Background task: generate marketplace product-card variants."""
    logger.info("Starting marketplace generation %s", generation_id)

    async with AsyncSessionLocal() as db:
        generation: Generation | None = None
        try:
            result = await db.execute(
                select(Generation).where(Generation.id == generation_id)
            )
            generation = result.scalar_one()
            generation.status = GenerationStatus.processing
            await db.commit()

            prompt = build_marketplace_prompt(
                description=description,
                style=style,
                layout=layout,
                creativity=creativity,
                has_reference=reference_bytes is not None,
            )

            variants = await _generate_variants(
                image_bytes, prompt, count, reference_bytes
            )
            image_urls = await _upload_variants(variants, user_id, generation_id)

            generation.status = GenerationStatus.completed
            generation.image_urls = image_urls
            generation.prompt_used = prompt
            await db.commit()

            logger.info(
                "Marketplace generation %s completed — %d images",
                generation_id,
                len(image_urls),
            )

        except Exception as exc:
            logger.error(
                "Marketplace generation %s failed: %s",
                generation_id,
                exc,
                exc_info=True,
            )
            await db.rollback()
            if generation is not None:
                generation.status = GenerationStatus.failed
                generation.error_message = str(exc)[:1000]
                await db.commit()


async def generate_enhance(
    generation_id: UUID,
    user_id: UUID,
    image_bytes: bytes,
    wishes: str,
    count: int = 4,
) -> None:
    """Background task: generate enhanced (cleaned-up) product photo variants."""
    logger.info("Starting enhance generation %s", generation_id)

    async with AsyncSessionLocal() as db:
        generation: Generation | None = None
        try:
            result = await db.execute(
                select(Generation).where(Generation.id == generation_id)
            )
            generation = result.scalar_one()
            generation.status = GenerationStatus.processing
            await db.commit()

            prompt = build_enhance_prompt(wishes=wishes)

            variants = await _generate_variants(image_bytes, prompt, count)
            image_urls = await _upload_variants(variants, user_id, generation_id)

            generation.status = GenerationStatus.completed
            generation.image_urls = image_urls
            generation.prompt_used = prompt
            await db.commit()

            logger.info(
                "Enhance generation %s completed — %d images",
                generation_id,
                len(image_urls),
            )

        except Exception as exc:
            logger.error(
                "Enhance generation %s failed: %s",
                generation_id,
                exc,
                exc_info=True,
            )
            await db.rollback()
            if generation is not None:
                generation.status = GenerationStatus.failed
                generation.error_message = str(exc)[:1000]
                await db.commit()


async def generate_fat_maker(
    generation_id: UUID,
    user_id: UUID,
    image_bytes: bytes,
    wishes: str,
    fatness: int,
    count: int = 1,
) -> None:
    """Background task: generate fat-maker (joke weight-gain) variants."""
    logger.info("Starting fat-maker generation %s", generation_id)

    async with AsyncSessionLocal() as db:
        generation: Generation | None = None
        try:
            result = await db.execute(
                select(Generation).where(Generation.id == generation_id)
            )
            generation = result.scalar_one()
            generation.status = GenerationStatus.processing
            await db.commit()

            prompt = build_fat_maker_prompt(wishes=wishes, fatness=fatness)

            variants = await _generate_variants(image_bytes, prompt, count)
            image_urls = await _upload_variants(variants, user_id, generation_id)

            generation.status = GenerationStatus.completed
            generation.image_urls = image_urls
            generation.prompt_used = prompt
            await db.commit()

            logger.info(
                "Fat-maker generation %s completed — %d images",
                generation_id,
                len(image_urls),
            )

        except Exception as exc:
            logger.error(
                "Fat-maker generation %s failed: %s",
                generation_id,
                exc,
                exc_info=True,
            )
            await db.rollback()
            if generation is not None:
                generation.status = GenerationStatus.failed
                generation.error_message = str(exc)[:1000]
                await db.commit()


async def generate_ugc(
    generation_id: UUID,
    user_id: UUID,
    image_bytes: bytes,
    use_case: str,
    wishes: str,
    style: str,
    layout: str,
    creativity: int,
    count: int = 4,
    reference_bytes: bytes | None = None,
) -> None:
    """Background task: generate UGC-style image variants."""
    logger.info("Starting UGC generation %s", generation_id)

    async with AsyncSessionLocal() as db:
        generation: Generation | None = None
        try:
            result = await db.execute(
                select(Generation).where(Generation.id == generation_id)
            )
            generation = result.scalar_one()
            generation.status = GenerationStatus.processing
            await db.commit()

            prompt = build_ugc_prompt(
                use_case=use_case,
                wishes=wishes,
                style=style,
                layout=layout,
                creativity=creativity,
                has_reference=reference_bytes is not None,
            )

            variants = await _generate_variants(
                image_bytes, prompt, count, reference_bytes
            )
            image_urls = await _upload_variants(variants, user_id, generation_id)

            generation.status = GenerationStatus.completed
            generation.image_urls = image_urls
            generation.prompt_used = prompt
            await db.commit()

            logger.info(
                "UGC generation %s completed — %d images",
                generation_id,
                len(image_urls),
            )

        except Exception as exc:
            logger.error(
                "UGC generation %s failed: %s",
                generation_id,
                exc,
                exc_info=True,
            )
            await db.rollback()
            if generation is not None:
                generation.status = GenerationStatus.failed
                generation.error_message = str(exc)[:1000]
                await db.commit()
