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


def build_fat_maker_prompt(wishes: str, fatness: int) -> str:
    """Build a 'fat maker' joke prompt — friendly weight-gain photo edit.

    The user's friend's photo is provided as the first inline image.

    Args:
        wishes: Optional free-text user note.
        fatness: 1–10 intensity (1 = barely noticeable, 10 = extreme cartoonish).
    """
    fatness = max(1, min(10, int(fatness)))

    if fatness <= 3:
        intensity = (
            "Subtle weight gain — slightly fuller cheeks and a softer jawline, "
            "minimal change to body shape. The result should still look like a real, "
            "plausible photo of the same person."
        )
    elif fatness <= 7:
        intensity = (
            "Moderate, clearly visible weight gain — noticeably rounder face, "
            "double-chin starting to form, fuller arms, broader torso, fuller cheeks. "
            "Still photo-realistic and recognisable as the same person."
        )
    else:
        intensity = (
            "Extreme cartoon-level weight gain — very round face and cheeks, prominent "
            "double chin, much larger torso and arms, fingers slightly puffier. "
            "Push toward humorous exaggeration but keep facial features identifiable."
        )

    parts = [
        "You are editing a photo of a person to humorously make them look heavier "
        "(this is a friendly joke between friends, not a real-world critique).",
        f"Intensity (scale 1-10): {fatness}/10. {intensity}",
        "Strict preservation rules:",
        "- Keep the person's facial identity recognisable: same eye color, same hair "
        "(color, length, and style), same skin tone, same age range.",
        "- Keep their clothing the same items and colors, just adjusted to fit the "
        "new body shape naturally (fabric stretches, slight bulges).",
        "- Keep the original background, lighting, and overall framing exactly.",
        "- Maintain a friendly, playful, non-shaming tone. The result should look "
        "like a fun joke filter, not a cruel caricature.",
    ]
    if wishes.strip():
        parts.append(f"Additional wishes from the user: {wishes.strip()}")
    parts.append(
        "Output a photo with the same aspect ratio as the input. "
        "Do not add captions, text overlays, watermarks, or stickers."
    )
    return "\n\n".join(parts)


_CHESS_PIECES: dict[str, str] = {
    "pawn": (
        "a Pawn — the smallest, humblest piece: a short, round-headed cylindrical figure "
        "with a ball on top and a simple flared base, like a tiny soldier."
    ),
    "rook": (
        "a Rook — a sturdy castle-tower piece: a wide cylindrical body with battlements "
        "(crenellations) on top, solid and fortress-like."
    ),
    "knight": (
        "a Knight — a horse-head piece: an elongated horse head and neck mounted on a "
        "stepped base, dynamic and proud."
    ),
    "bishop": (
        "a Bishop — a tall, slender piece with a distinctive pointed top (mitre), slightly "
        "taller than a rook, elegant and narrow."
    ),
    "queen": (
        "a Queen — the most powerful piece: tall and elegant with a spiked crown on top, "
        "slender body, commanding presence."
    ),
    "king": (
        "a King — the tallest piece: a cross on top of a crown, wide and regal, "
        "imposing and dignified."
    ),
}


def build_chess_prompt(piece: str, wishes: str) -> str:
    """Build a chess mini-app prompt — transform a person into a chess figure.

    The person's photo is provided as the first inline image.

    Args:
        piece: One of pawn, rook, knight, bishop, queen, king.
        wishes: Optional free-text creative wishes from the user.
    """
    piece = piece.lower().strip()
    piece_desc = _CHESS_PIECES.get(piece, _CHESS_PIECES["pawn"])

    parts = [
        "You are transforming a photo of a person into a 3D-rendered chess piece figure. "
        "The output should look like a high-quality wooden or marble chess piece, but with "
        "the person's facial features subtly incorporated into the piece's design — "
        "for example, a carved face on the piece's 'head' area that resembles the person.",
        f"The chess piece to create is {piece_desc}",
        "Style requirements:",
        "- Render it as a classic hand-carved wooden chess piece (dark walnut or light maple) "
        "or polished marble chess piece — photorealistic material texture.",
        "- The piece sits on a chessboard square or a plain dark background with soft studio lighting.",
        "- The person's likeness (face, distinctive features) should be subtly carved or sculpted "
        "into the piece — not a floating head, but organically integrated into the piece's form.",
        "- Keep the piece recognisably that chess type — don't change the silhouette.",
        "- The result should be funny and charming, like a personalised chess set gift.",
    ]
    if wishes.strip():
        parts.append(f"Additional wishes from the user: {wishes.strip()}")
    parts.append(
        "Output a square image. Do not add captions, text overlays, watermarks, or stickers."
    )
    return "\n\n".join(parts)


_MARKETPLACE_STYLE: dict[str, str] = {
    "kaspi": (
        "Kaspi marketplace style: minimal, clean, almost editorial. Plain white or "
        "very light neutral background, soft single-source lighting, restrained color "
        "palette, generous whitespace. Text overlays — when present — are short, "
        "left-aligned, in a clean modern sans-serif (think Inter / SF Pro), high contrast, "
        "no decorative shapes or stickers. The product is the hero; styling never "
        "competes with it."
    ),
    "wildberries": (
        "Wildberries marketplace style: punchy infographic look. Bold saturated "
        "background blocks, large readable headline text in a strong sans-serif, "
        "icon callouts and short benefit captions arranged around the product, "
        "high-energy color accents (often a single brand color + white). The "
        "composition reads at a thumbnail size and conveys the main benefit instantly."
    ),
}


def _marketplace_style(marketplace: str) -> str:
    return _MARKETPLACE_STYLE.get(
        marketplace.lower().strip(), _MARKETPLACE_STYLE["kaspi"]
    )


def _common_listing_rules() -> str:
    return (
        "Strict rules:\n"
        "- The product itself is provided as the first inline image. Preserve its exact "
        "shape, colors, materials, and identifying details. Do not redesign it.\n"
        "- This image has ONE purpose. Do not mix multiple ideas into a single frame.\n"
        "- Any text overlay must be short (max ~6 words), highly legible, and positioned "
        "with clear contrast against the background.\n"
        "- Do not add platform logos, watermarks, prices, or marketplace branding.\n"
        "- Output a square (1:1) image suitable for a marketplace listing."
    )


def build_hero_prompt(plan: dict, marketplace: str) -> str:
    """Hero (main) listing image — the cover slide of the pack."""
    title = plan.get("title", "the product")
    return "\n\n".join([
        f"You are generating the HERO (main cover) listing image for: {title}.",
        f"Marketplace style: {_marketplace_style(marketplace)}",
        "Composition: product centered, full and clearly visible, "
        "professional studio framing. Background is clean and minimal so the product "
        "pops at thumbnail size.",
        "Text overlay: a single short headline with the product title — "
        f"\"{title}\" — bold, readable, top-left or top-center placement. "
        "No subtitle, no extra text.",
        _common_listing_rules(),
    ])


def build_benefits_prompt(plan: dict, index: int, marketplace: str) -> str:
    """Benefit slide #index (0-based) — one benefit, one visual."""
    benefits: list[str] = plan.get("benefits", []) or []
    if not benefits:
        benefit = "Key benefit"
    else:
        benefit = benefits[index % len(benefits)]
    title = plan.get("title", "the product")
    return "\n\n".join([
        f"You are generating BENEFIT slide #{index + 1} for: {title}.",
        f"This slide must communicate exactly ONE benefit: \"{benefit}\".",
        f"Marketplace style: {_marketplace_style(marketplace)}",
        "Composition: product on one side, benefit text on the other, "
        "with a single supporting visual cue (icon, callout line, or close-up "
        "detail) that reinforces the benefit. Do not introduce any other benefits.",
        f"Text overlay: a short benefit headline — \"{benefit}\" — "
        "rendered as the primary copy. Optional one-line supporting caption "
        "(maximum 6 words). High contrast, clean sans-serif.",
        _common_listing_rules(),
    ])


def build_use_case_prompt(plan: dict, marketplace: str) -> str:
    """Use-case slide — lifestyle image showing the product in real use."""
    use_case = plan.get("use_case", "in everyday use")
    title = plan.get("title", "the product")
    return "\n\n".join([
        f"You are generating the USE-CASE (lifestyle) listing image for: {title}.",
        f"Scenario: {use_case}",
        f"Marketplace style: {_marketplace_style(marketplace)}",
        "Composition: a believable lifestyle scene where the product is naturally "
        "in use as the clear focal point. Soft natural lighting, plausible "
        "real-world environment, no other competing products.",
        "Text overlay: a single short caption describing the moment of use "
        "(max 5 words), placed where it does not cover the product or the user's face.",
        _common_listing_rules(),
    ])


def build_details_prompt(plan: dict, marketplace: str) -> str:
    """Details slide — close-up showcasing 1–2 specific product details."""
    details: list[str] = plan.get("details", []) or []
    detail_text = ", ".join(details[:2]) if details else "key construction details"
    title = plan.get("title", "the product")
    return "\n\n".join([
        f"You are generating the DETAILS (close-up) listing image for: {title}.",
        f"Highlight these specific details: {detail_text}.",
        f"Marketplace style: {_marketplace_style(marketplace)}",
        "Composition: a tight close-up of the product showing the highlighted "
        "details with crisp focus and macro-level clarity. Subtle directional "
        "lighting that brings out texture, finish, and material quality.",
        "Text overlay: 1–2 short labeled callouts pointing to the highlighted "
        "details (each 1–3 words, e.g. \"Stainless steel blades\"). Clean thin "
        "leader lines, no clutter.",
        _common_listing_rules(),
    ])


def build_final_prompt(plan: dict, marketplace: str) -> str:
    """Final selling slide — strong closing CTA-style image."""
    final_message = plan.get("final_message", "Make it yours today")
    title = plan.get("title", "the product")
    return "\n\n".join([
        f"You are generating the FINAL (closing) listing image for: {title}.",
        f"Marketplace style: {_marketplace_style(marketplace)}",
        "Composition: a confident, conversion-oriented closing slide. "
        "The product is presented in a strong final framing — slightly "
        "more dramatic lighting and a richer background block than the hero — "
        "to leave a strong last impression. No props that distract from the product.",
        f"Text overlay: one bold closing headline — \"{final_message}\" — "
        "as the dominant text element. Optional one-line micro-copy underneath "
        "(maximum 4 words). High contrast, large readable type.",
        _common_listing_rules(),
    ])


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
