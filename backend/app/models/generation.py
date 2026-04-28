import uuid
from enum import Enum as PyEnum

from sqlalchemy import Enum, ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class GenerationType(str, PyEnum):
    marketplace = "marketplace"
    ugc = "ugc"


class GenerationStatus(str, PyEnum):
    pending = "pending"
    processing = "processing"
    completed = "completed"
    failed = "failed"


class Generation(TimestampMixin, Base):
    __tablename__ = "generations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    type: Mapped[GenerationType] = mapped_column(
        Enum(GenerationType, name="generation_type"),
        nullable=False,
    )
    status: Mapped[GenerationStatus] = mapped_column(
        Enum(GenerationStatus, name="generation_status"),
        nullable=False,
        default=GenerationStatus.pending,
    )
    input_data: Mapped[dict] = mapped_column(JSONB, nullable=False)
    source_image_url: Mapped[str] = mapped_column(String(2000), nullable=False)
    image_urls: Mapped[list] = mapped_column(JSONB, nullable=False, default=list)
    prompt_used: Mapped[str | None] = mapped_column(Text, nullable=True)
    error_message: Mapped[str | None] = mapped_column(Text, nullable=True)

    __table_args__ = (
        Index("ix_generations_user_id", "user_id"),
        Index("ix_generations_status", "status"),
    )
