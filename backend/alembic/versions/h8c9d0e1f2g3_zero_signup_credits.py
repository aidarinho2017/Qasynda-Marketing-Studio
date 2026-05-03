"""set credits_balance default to 0

Revision ID: h8c9d0e1f2g3
Revises: g7b8c9d0e1f2
Create Date: 2026-05-03 13:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = 'h8c9d0e1f2g3'
down_revision: Union[str, None] = 'g7b8c9d0e1f2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.alter_column(
        "users",
        "credits_balance",
        existing_type=sa.Numeric(10, 2),
        existing_nullable=False,
        server_default="0",
    )


def downgrade() -> None:
    op.alter_column(
        "users",
        "credits_balance",
        existing_type=sa.Numeric(10, 2),
        existing_nullable=False,
        server_default="5",
    )
