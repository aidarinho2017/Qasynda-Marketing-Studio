from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel

from app.models.generation import GenerationStatus, GenerationType


class GenerationStartResponse(BaseModel):
    generation_id: UUID
    status: GenerationStatus


class GenerationOut(BaseModel):
    id: UUID
    type: GenerationType
    status: GenerationStatus
    input_data: dict
    source_image_url: str
    # Flat list of URL strings (legacy generations) OR list of
    # {type, index, url} objects (listing_pack).
    image_urls: list[Any]
    prompt_used: str | None
    error_message: str | None
    content_plan: dict | None = None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class GenerationsListResponse(BaseModel):
    items: list[GenerationOut]
    total: int
    limit: int
    offset: int
