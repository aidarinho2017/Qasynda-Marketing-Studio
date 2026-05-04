from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.generation import GenerationOut


class CatalogueStartResponse(BaseModel):
    catalogue_id: UUID
    generation_ids: list[UUID]


class CatalogueListItem(BaseModel):
    id: UUID
    name: str | None
    mode: str
    settings: dict
    total_items: int
    completed: int
    failed: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class CataloguesListResponse(BaseModel):
    items: list[CatalogueListItem]
    total: int
    limit: int
    offset: int


class CatalogueDetail(CatalogueListItem):
    generations: list[GenerationOut]
