import uuid
from enum import Enum as PyEnum

from sqlalchemy import (
    DateTime,
    Enum,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class LeadCampaignStatus(str, PyEnum):
    pending = "pending"
    selecting_channels = "selecting_channels"
    refused = "refused"
    discovering = "discovering"
    enriching = "enriching"
    completed = "completed"
    failed = "failed"


class LeadCampaign(TimestampMixin, Base):
    __tablename__ = "lead_campaigns"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    status: Mapped[LeadCampaignStatus] = mapped_column(
        Enum(LeadCampaignStatus, name="lead_campaign_status"),
        nullable=False,
        default=LeadCampaignStatus.pending,
    )
    progress: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    progress_label: Mapped[str] = mapped_column(String(120), nullable=False, default="")
    icp: Mapped[dict] = mapped_column(JSONB, nullable=False)
    selected_channels: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    leads_target: Mapped[int] = mapped_column(Integer, nullable=False)
    leads_found: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rounds: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    credits_charged: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    refused_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_lead_campaigns_user_id", "user_id"),
        Index("ix_lead_campaigns_status", "status"),
    )


class Lead(TimestampMixin, Base):
    __tablename__ = "leads"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    campaign_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lead_campaigns.id", ondelete="CASCADE"),
        nullable=False,
    )
    round: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    platform: Mapped[str] = mapped_column(String(32), nullable=False)
    author_handle: Mapped[str] = mapped_column(String(255), nullable=False)
    author_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    post_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    post_text: Mapped[str] = mapped_column(Text, nullable=False)
    post_created_at: Mapped["DateTime | None"] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    signal_type: Mapped[str] = mapped_column(String(32), nullable=False)
    signal_quote: Mapped[str] = mapped_column(Text, nullable=False)
    intent_score: Mapped[int] = mapped_column(Integer, nullable=False)
    enriched_role: Mapped[str | None] = mapped_column(String(255), nullable=True)
    enriched_company: Mapped[str | None] = mapped_column(String(255), nullable=True)
    enriched_niche: Mapped[str | None] = mapped_column(String(255), nullable=True)
    suggested_angle: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        UniqueConstraint("campaign_id", "post_url", name="uq_leads_campaign_post"),
        Index("ix_leads_campaign_id", "campaign_id"),
        Index("ix_leads_intent_score", "intent_score"),
    )
