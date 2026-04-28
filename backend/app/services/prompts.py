"""Prompt templates for marketplace and UGC image generation.

The product itself is provided to the model as the first inline image, so the
prompt does not need to describe the product visually — it focuses on the
desired creative direction (style, layout, creativity level), the user's
description in their own words, and an optional reference-image clause when a
second visual is provided.
"""


_CARD_STYLES: dict[str, str] = {
    "minimal": (
        "Minimal product card aesthetic: clean white or very light background, "
        "soft single-source lighting, product centered with a subtle grounding shadow, "
        "no props, no text overlays, faithful product colors."
    ),
    "premium": (
        "Premium product card aesthetic: rich dark or muted gradient background, "
        "moody directional lighting with soft fill, tasteful complementary props "
        "(marble, brushed metal, fabric), rule-of-thirds composition, hero feel."
    ),
    "bright": (
        "Bright, eye-catching product card aesthetic: bold saturated background color, "
        "high-key even lighting with no shadows, optional colorful geometric accents, "
        "punchy color grading reminiscent of trending social-commerce content."
    ),
    "infographic": (
        "Infographic product card: clean white background, product on the left half, "
        "right half reserved for 3-4 short benefit callouts with simple line icons, "
        "clean sans-serif typography legible at thumbnail scale, one accent color."
    ),
}

_UGC_STYLES: dict[str, str] = {
    "realistic": (
        "Authentic UGC look — feels shot on a smartphone by a real consumer, "
        "natural ambient light, candid framing, organic context, "
        "shallow depth of field, slightly imperfect but aesthetically pleasing."
    ),
    "instagram": (
        "Polished Instagram lifestyle aesthetic — bright airy lighting, curated styling, "
        "complementary props neatly arranged, soft shadows, aspirational mood, "
        "clean color palette with one accent color, Pinterest-worthy framing."
    ),
    "tiktok": (
        "TikTok-native energy — phone-camera look with mild high contrast, "
        "dynamic angle (held toward camera or 45-degree tilt), authentic lived-in environment, "
        "scroll-stopping composition with the product as the clear hero."
    ),
}

_LAYOUTS: dict[str, str] = {
    "square": "Aspect ratio: 1:1 (square). Compose for a square crop.",
    "portrait": "Aspect ratio: 3:4 (portrait). Compose for a vertical crop.",
    "landscape": "Aspect ratio: 16:9 (landscape). Compose for a horizontal crop.",
}


def _creativity_phrase(creativity: int) -> str:
    """Map a 1-10 creativity slider value to a directional phrase."""
    if creativity <= 3:
        return (
            "Creativity level: low. Stay faithful to a conventional, conservative styling "
            "that closely respects the source product photo."
        )
    if creativity <= 6:
        return (
            "Creativity level: balanced. Apply tasteful styling and atmosphere while "
            "keeping the result believable and on-brand."
        )
    return (
        "Creativity level: high. Be bold and experimental with composition, color, and "
        "atmosphere — push for striking, unexpected visuals while still recognisably "
        "showing the product."
    )


_REFERENCE_CLAUSE = (
    "An additional reference image is provided as the second visual input. "
    "Use it as a style, color, and composition guide — but the actual product must "
    "always come from the first image, not the reference."
)


def build_marketplace_prompt(
    description: str,
    style: str,
    layout: str,
    creativity: int,
    has_reference: bool,
) -> str:
    """Build a marketplace product-card prompt from free-form description.

    Args:
        description: User-provided free text describing the product.
        style: One of minimal | premium | bright | infographic.
        layout: One of square | portrait | landscape.
        creativity: Integer 1–10 controlling stylistic boldness.
        has_reference: Whether a second reference image is being sent alongside.

    Returns:
        Full prompt string ready to send to the image model.
    """
    style_direction = _CARD_STYLES.get(style, _CARD_STYLES["minimal"])
    layout_direction = _LAYOUTS.get(layout, _LAYOUTS["square"])

    parts = [
        "You are generating a marketplace product card image.",
        f"Product description (from the seller): {description.strip()}",
        f"Style direction: {style_direction}",
        layout_direction,
        _creativity_phrase(creativity),
        "The product itself is provided as the first inline image — generate a new image "
        "that shows this product on the new background and styling described above. "
        "The product's shape, colors, and identifying details must be preserved exactly.",
    ]
    if has_reference:
        parts.append(_REFERENCE_CLAUSE)
    parts.append("Do not add watermarks, platform logos, or marketplace branding.")

    return "\n\n".join(parts)


def build_enhance_prompt(wishes: str) -> str:
    """Build a product-photo enhancement prompt.

    The user's source product photo is provided as the first inline image.
    The model must clean it up — remove the background, fix lighting,
    sharpen detail — without altering the product itself.

    Args:
        wishes: Optional free-text user note ("make the colour pop", "warmer
            tone", etc.). May be empty.
    """
    parts = [
        "You are enhancing the seller's product photo to a clean, marketplace-ready quality.",
        "Required improvements:",
        "- Remove the existing background and replace it with a clean, soft white "
        "studio backdrop, with a subtle natural grounding shadow under the product.",
        "- Correct the lighting: even, neutral, soft studio illumination that flatters "
        "the product. Eliminate harsh shadows, color casts, and uneven exposure.",
        "- Increase sharpness and clarity: crisp edges, accurate textures, no motion "
        "blur, no compression artefacts.",
        "- Keep the product perfectly centered and at a flattering scale within the frame.",
        "Critical constraint: the product itself — its exact shape, proportions, "
        "colors, materials, logos, labels and identifying details — must be preserved "
        "exactly as in the source. Do not redesign, recolor, or restyle the product. "
        "This is a photo cleanup, not a redesign.",
    ]
    if wishes.strip():
        parts.append(f"Additional wishes from the seller: {wishes.strip()}")
    parts.append(
        "Output a square (1:1) image. Do not add watermarks, text overlays, "
        "stickers, badges, or marketplace branding."
    )
    return "\n\n".join(parts)


def build_ugc_prompt(
    use_case: str,
    wishes: str,
    style: str,
    layout: str,
    creativity: int,
    has_reference: bool,
) -> str:
    """Build a UGC-style prompt from a free-form use case description.

    Args:
        use_case: User-provided free text describing how the product is used.
        wishes: Optional free text with extra creative wishes (may be empty).
        style: One of realistic | instagram | tiktok.
        layout: One of square | portrait | landscape.
        creativity: Integer 1–10 controlling stylistic boldness.
        has_reference: Whether a second reference image is being sent alongside.

    Returns:
        Full prompt string ready to send to the image model.
    """
    style_direction = _UGC_STYLES.get(style, _UGC_STYLES["realistic"])
    layout_direction = _LAYOUTS.get(layout, _LAYOUTS["square"])

    parts = [
        "You are generating a user-generated-content (UGC) style lifestyle image "
        "showing the product in real-life use.",
        f"Use case (how the product is being used): {use_case.strip()}",
    ]
    if wishes.strip():
        parts.append(f"Additional wishes from the seller: {wishes.strip()}")
    parts.extend([
        f"Style direction: {style_direction}",
        layout_direction,
        _creativity_phrase(creativity),
        "The product itself is provided as the first inline image — generate a new "
        "lifestyle scene that includes this exact product naturally and as the clear "
        "focal point. Preserve the product's shape, colors, and identifying details.",
    ])
    if has_reference:
        parts.append(_REFERENCE_CLAUSE)
    parts.append("Do not add watermarks, platform logos, or branding overlays.")

    return "\n\n".join(parts)
