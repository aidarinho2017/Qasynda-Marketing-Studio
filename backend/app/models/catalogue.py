import uuid

from sqlalchemy import ForeignKey, Index, Integer, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.db.base import Base, TimestampMixin


class Catalogue(TimestampMixin, Base):
    __tablename__ = "catalogues"

    id: Mapped[uuid.UUID] = mapped_column(primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"),
        nullable=False,
    )
    name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mode: Mapped[str] = mapped_column(String(50), nullable=False, default="marketplace")
    settings: Mapped[dict] = mapped_column(JSONB, nullable=False)
    total_items: Mapped[int] = mapped_column(Integer, nullable=False)

    __table_args__ = (Index("ix_catalogues_user_id", "user_id"),)
