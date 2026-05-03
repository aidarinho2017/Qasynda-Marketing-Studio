from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.lead import LeadCampaignStatus


class IcpInput(BaseModel):
    """Hybrid ICP form: required role + problem, optional keywords + notes."""

    role: str = Field(..., min_length=2, max_length=200)
    problem: str = Field(..., min_length=10, max_length=600)
    keywords: list[str] = Field(default_factory=list, max_length=20)
    notes: str = Field(default="", max_length=1000)

    @field_validator("keywords")
    @classmethod
    def _strip_keywords(cls, v: list[str]) -> list[str]:
        return [k.strip() for k in v if k and k.strip()]


class LeadCampaignCreateRequest(BaseModel):
    icp: IcpInput


class LeadCampaignStartResponse(BaseModel):
    campaign_id: UUID
    status: LeadCampaignStatus


class LeadOut(BaseModel):
    id: UUID
    campaign_id: UUID
    round: int
    platform: str
    author_handle: str
    author_url: str | None
    post_url: str
    post_text: str
    post_created_at: datetime | None
    signal_type: str
    signal_quote: str
    intent_score: int
    enriched_role: str | None
    enriched_company: str | None
    enriched_niche: str | None
    suggested_angle: str | None
    created_at: datetime

    model_config = {"from_attributes": True}


class LeadCampaignSummary(BaseModel):
    """Lightweight row for list views — no leads attached."""

    id: UUID
    status: LeadCampaignStatus
    progress: int
    progress_label: str
    icp: dict[str, Any]
    selected_channels: list[Any] | None
    leads_target: int
    leads_found: int
    rounds: int
    credits_charged: int
    error_message: str | None
    refused_reason: str | None
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class LeadCampaignDetail(LeadCampaignSummary):
    leads: list[LeadOut] = Field(default_factory=list)


class LeadCampaignsListResponse(BaseModel):
    items: list[LeadCampaignSummary]
    total: int
    limit: int
    offset: int
