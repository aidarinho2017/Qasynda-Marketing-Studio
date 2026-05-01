import uuid
from decimal import Decimal

from sqlalchemy import Index, Numeric, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.pricing import SIGNUP_CREDITS_GRANT
from app.db.base import Base, TimestampMixin


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[uuid.UUID] = mapped_column(
        primary_key=True,
        default=uuid.uuid4,
    )
    google_sub: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    avatar: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    credits_balance: Mapped[Decimal] = mapped_column(
        Numeric(10, 2),
        nullable=False,
        default=lambda: Decimal(str(SIGNUP_CREDITS_GRANT)),
        server_default=str(SIGNUP_CREDITS_GRANT),
    )

    __table_args__ = (
        Index("ix_users_google_sub", "google_sub"),
        Index("ix_users_email", "email"),
    )
