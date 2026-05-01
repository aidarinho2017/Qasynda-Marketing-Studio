from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel, field_serializer


class UserOut(BaseModel):
    id: UUID
    email: str
    name: str
    avatar: str | None
    credits_balance: Decimal
    created_at: datetime

    model_config = {"from_attributes": True}

    @field_serializer("credits_balance")
    def _credits_to_float(self, v: Decimal) -> float:
        return float(v)


class TopupRequest(BaseModel):
    pack_id: str


class TopupPackOut(BaseModel):
    id: str
    credits: int
    price_usd: float


class TopupResponse(BaseModel):
    credits_balance: Decimal
    credits_added: int
    price_usd: float
    pack_id: str

    @field_serializer("credits_balance")
    def _credits_to_float(self, v: Decimal) -> float:
        return float(v)


class PricingResponse(BaseModel):
    credits_per_image: int
    credits_by_count: dict[int, int]
    topup_packs: list[TopupPackOut]
