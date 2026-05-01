import uuid
from datetime import datetime
from enum import Enum as PyEnum

from sqlalchemy import DateTime, Enum, ForeignKey, Index, Integer, String, Text, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class CoachModule(str, PyEnum):
    foundation = "foundation"
    acquisition = "acquisition"
    content = "content"
    outreach = "outreach"
    funnel = "funnel"


class CoachConversation(TimestampMixin, Base):
    __tablename__ = "coach_conversations"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="New conversation")
    current_module: Mapped[CoachModule] = mapped_column(
        Enum(CoachModule, name="coach_module"),
        nullable=False,
        default=CoachModule.foundation,
    )
    context: Mapped[dict] = mapped_column(JSONB, nullable=False, default=dict)
    last_message_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )

    __table_args__ = (
        Index(
            "ix_coach_conversations_user_id_last_message_at",
            "user_id",
            "last_message_at",
        ),
    )


class CoachMessage(Base):
    __tablename__ = "coach_messages"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    conversation_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("coach_conversations.id", ondelete="CASCADE"),
        nullable=False,
    )
    role: Mapped[str] = mapped_column(String(16), nullable=False)  # "user" | "assistant"
    content: Mapped[str] = mapped_column(Text, nullable=False)
    structured_output: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    module: Mapped[CoachModule | None] = mapped_column(
        Enum(CoachModule, name="coach_module"), nullable=True
    )
    token_count: Mapped[int | None] = mapped_column(Integer, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )

    __table_args__ = (
        Index("ix_coach_messages_conversation_id_created_at", "conversation_id", "created_at"),
    )
