"""Credit pricing for image generation and top-ups.

Centralised so frontend and backend agree on costs. The bundled prices for
2/3/4 images include a small discount vs. the per-image rate.
"""

CREDITS_PER_IMAGE: int = 5
SIGNUP_CREDITS_GRANT: int = 5

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
    TopupPack(id="small", credits=50, price_usd=3.00),
    TopupPack(id="medium", credits=100, price_usd=5.00),
    TopupPack(id="large", credits=200, price_usd=9.00),
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
