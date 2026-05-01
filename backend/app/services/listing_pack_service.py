"""Listing Pack pipeline.

Given a single product photo, produces a structured set of 5–7 marketplace-ready
images: hero, 2–3 benefit slides, use-case lifestyle, details close-up, final
selling slide.

Pipeline:
  1. Status -> processing
  2. (Optional) OpenAI vision analysis to fill in missing title/benefits/etc.
  3. Build content_plan (merge user input + AI output)
  4. Build per-slide prompts
  5. asyncio.gather all image generations via Nano Banana
  6. Upload to Supabase Storage with type-encoded keys
  7. Persist image_urls (rich objects), content_plan, prompt_used; status -> completed
"""

from __future__ import annotations

import asyncio
import base64
import json
import logging
from uuid import UUID

from openai import AsyncOpenAI
from sqlalchemy import select

from app.core.config import settings
from app.db.session import AsyncSessionLocal
from app.models.generation import Generation, GenerationStatus
from app.services import image_service, storage_service
from app.services.prompts import (
    build_benefits_prompt,
    build_details_prompt,
    build_final_prompt,
    build_hero_prompt,
    build_use_case_prompt,
)

logger = logging.getLogger(__name__)

_openai_client: AsyncOpenAI | None = None


def _get_openai() -> AsyncOpenAI:
    global _openai_client
    if _openai_client is None:
        _openai_client = AsyncOpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


_ANALYSIS_SYSTEM_PROMPT = (
    "You are an e-commerce copywriter. You receive a single product photo and "
    "must extract structured listing content for an online marketplace card. "
    "Reply ONLY with valid JSON matching exactly this schema:\n"
    "{\n"
    '  "title": string,                // short product name, 2-5 words\n'
    '  "category": string,             // e.g. "kitchen appliance"\n'
    '  "benefits": [string, string, string],  // exactly 3 short benefits, each 2-5 words\n'
    '  "use_case": string,             // one sentence describing primary use, 6-12 words\n'
    '  "details": [string, string],    // 2 specific product details, each 2-4 words\n'
    '  "final_message": string         // bold closing line, 3-6 words\n'
    "}\n"
    "Be specific to the product visible in the photo. Do not include any other keys, "
    "no markdown, no commentary."
)


async def _analyze_product(image_bytes: bytes) -> dict:
    """Call OpenAI vision to extract a structured content plan from the photo."""
    client = _get_openai()
    image_b64 = base64.b64encode(image_bytes).decode("ascii")

    response = await client.chat.completions.create(
        model=settings.OPENAI_MODEL,
        messages=[
            {"role": "system", "content": _ANALYSIS_SYSTEM_PROMPT},
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": "Analyze this product photo and return the JSON.",
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:image/jpeg;base64,{image_b64}",
                        },
                    },
                ],
            },
        ],
        response_format={"type": "json_object"},
        temperature=0.4,
    )

    raw = response.choices[0].message.content or "{}"
    try:
        plan = json.loads(raw)
    except json.JSONDecodeError as exc:
        raise ValueError(f"OpenAI returned invalid JSON: {raw[:200]}") from exc

    return plan


def _merge_plan(ai_plan: dict, user_title: str | None, user_benefits: list[str] | None) -> dict:
    """User-provided fields take priority over AI-extracted ones."""
    merged = {
        "title": ai_plan.get("title", "Product"),
        "category": ai_plan.get("category", ""),
        "benefits": list(ai_plan.get("benefits", []) or []),
        "use_case": ai_plan.get("use_case", "Used in everyday life"),
        "details": list(ai_plan.get("details", []) or []),
        "final_message": ai_plan.get("final_message", "Order yours today"),
    }
    if user_title:
        merged["title"] = user_title
    if user_benefits:
        merged["benefits"] = user_benefits
    # Guarantee at least 3 benefits (pad with AI's if user gave fewer).
    if len(merged["benefits"]) < 3:
        ai_benefits = ai_plan.get("benefits", []) or []
        for b in ai_benefits:
            if b not in merged["benefits"]:
                merged["benefits"].append(b)
            if len(merged["benefits"]) >= 3:
                break
    return merged


def _build_slide_prompts(plan: dict, marketplace: str) -> list[tuple[str, int, str]]:
    """Returns (image_type, index, prompt) tuples in canonical order."""
    benefits = plan.get("benefits", []) or []
    benefit_count = max(2, min(3, len(benefits)))  # 2 or 3 benefit slides

    slides: list[tuple[str, int, str]] = [
        ("hero", 0, build_hero_prompt(plan, marketplace)),
    ]
    for i in range(benefit_count):
        slides.append(("benefit", i, build_benefits_prompt(plan, i, marketplace)))
    slides.extend([
        ("use_case", 0, build_use_case_prompt(plan, marketplace)),
        ("details", 0, build_details_prompt(plan, marketplace)),
        ("final", 0, build_final_prompt(plan, marketplace)),
    ])
    return slides


async def _generate_and_upload_slide(
    image_bytes: bytes,
    prompt: str,
    image_type: str,
    index: int,
    user_id: UUID,
    generation_id: UUID,
) -> dict:
    """Generate a single slide, upload it, return the rich URL object."""
    img_bytes = await image_service._call_nano_banana(image_bytes, prompt)
    key = f"{user_id}/{generation_id}/{image_type}_{index}.png"
    url = await storage_service.upload_bytes(
        settings.SUPABASE_BUCKET_GENERATIONS,
        key,
        img_bytes,
        "image/png",
    )
    return {"type": image_type, "index": index, "url": url}


async def generate_listing_pack(
    generation_id: UUID,
    user_id: UUID,
    image_bytes: bytes,
    user_title: str | None,
    user_benefits: list[str] | None,
    marketplace: str,
) -> None:
    """Background task: full listing-pack pipeline."""
    logger.info("Starting listing-pack generation %s", generation_id)

    async with AsyncSessionLocal() as db:
        generation: Generation | None = None
        try:
            result = await db.execute(
                select(Generation).where(Generation.id == generation_id)
            )
            generation = result.scalar_one()
            generation.status = GenerationStatus.processing
            await db.commit()

            # Step 1: product analysis (always run — the AI plan also fills gaps
            # like use_case / details / final_message that the user can't easily provide).
            ai_plan = await _analyze_product(image_bytes)
            logger.info(
                "Listing-pack %s: analyzed product, title=%r",
                generation_id,
                ai_plan.get("title"),
            )

            # Step 2: merge with user input
            plan = _merge_plan(ai_plan, user_title, user_benefits)

            # Step 3: build prompts
            slides = _build_slide_prompts(plan, marketplace)
            logger.info(
                "Listing-pack %s: planned %d slides", generation_id, len(slides)
            )

            # Step 4: generate + upload in parallel
            tasks = [
                _generate_and_upload_slide(
                    image_bytes=image_bytes,
                    prompt=prompt,
                    image_type=image_type,
                    index=index,
                    user_id=user_id,
                    generation_id=generation_id,
                )
                for image_type, index, prompt in slides
            ]
            image_objects = await asyncio.gather(*tasks)

            generation.status = GenerationStatus.completed
            generation.image_urls = image_objects
            generation.content_plan = plan
            generation.prompt_used = "\n\n---\n\n".join(
                f"[{t}_{i}]\n{p}" for t, i, p in slides
            )
            await db.commit()

            logger.info(
                "Listing-pack generation %s completed — %d images",
                generation_id,
                len(image_objects),
            )

        except Exception as exc:
            logger.error(
                "Listing-pack generation %s failed: %s",
                generation_id,
                exc,
                exc_info=True,
            )
            await db.rollback()
            if generation is not None:
                generation.status = GenerationStatus.failed
                generation.error_message = str(exc)[:1000]
                await db.commit()
