"""Credit pricing for image generation and top-ups.

Centralised so frontend and backend agree on costs. The bundled prices for
2/3/4 images include a small discount vs. the per-image rate.

User.credits_balance is Decimal-backed in the DB so we can charge sub-credit
amounts (like 0.5 for growth-coach turns). Whole-credit costs stay as ints —
Decimal arithmetic with int works cleanly; with float it doesn't.
"""

from decimal import Decimal

CREDITS_PER_IMAGE: int = 5
SIGNUP_CREDITS_GRANT: int = 0

# Flat cost for the listing-pack pipeline (5–7 typed images + LLM analysis).
LISTING_PACK_CREDITS: int = 25

# AI Growth Manager — flat cost per assistant turn (sub-credit).
GROWTH_TURN_CREDITS: Decimal = Decimal("0.5")

# Lead Search — base campaign delivers 20 leads, top-ups add 20 more each.
# Capped at MAX_ROUNDS total batches (base + 4 top-ups = 100 leads).
LEAD_CAMPAIGN_BASE_CREDITS: int = 20
LEAD_CAMPAIGN_TOPUP_CREDITS: int = 15
LEAD_CAMPAIGN_BASE_SIZE: int = 20
LEAD_CAMPAIGN_TOPUP_SIZE: int = 20
LEAD_CAMPAIGN_MAX_ROUNDS: int = 5
LEAD_RECENCY_DAYS: int = 30

CREDITS_BY_COUNT: dict[int, int] = {
    1: 5,
    2: 9,
    3: 14,
    4: 17,
}


class TopupPack:
    __slots__ = ("id", "credits", "price_usd")

    def __init__(self, id: str, credits: int, price_usd: float) -> None:
        self.id = id
        self.credits = credits
        self.price_usd = price_usd

    def to_dict(self) -> dict:
        return {"id": self.id, "credits": self.credits, "price_usd": self.price_usd}


TOPUP_PACKS: list[TopupPack] = [
    TopupPack(id="basic", credits=50, price_usd=3.00),
    TopupPack(id="pro", credits=100, price_usd=5.00),
    TopupPack(id="ultra", credits=500, price_usd=22.00),
]


def get_topup_pack(pack_id: str) -> TopupPack | None:
    return next((p for p in TOPUP_PACKS if p.id == pack_id), None)


def credits_for_count(count: int) -> int:
    """Bundled credit cost for generating `count` images."""
    if count not in CREDITS_BY_COUNT:
        raise ValueError(
            f"Unsupported image count {count}. Must be one of {sorted(CREDITS_BY_COUNT)}."
        )
    return CREDITS_BY_COUNT[count]
