from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class UserOut(BaseModel):
    id: UUID
    email: str
    name: str
    avatar: str | None
    credits_balance: int
    created_at: datetime

    model_config = {"from_attributes": True}


class TopupRequest(BaseModel):
    pack_id: str


class TopupPackOut(BaseModel):
    id: str
    credits: int
    price_usd: float


class TopupResponse(BaseModel):
    credits_balance: int
    credits_added: int
    price_usd: float
    pack_id: str


class PricingResponse(BaseModel):
    credits_per_image: int
    credits_by_count: dict[int, int]
    topup_packs: list[TopupPackOut]
