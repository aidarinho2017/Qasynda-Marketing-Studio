"""add mini_app to generation_type enum

Revision ID: c3d4e5f6a7b8
Revises: b2c3d4e5f6a7
Create Date: 2026-04-28 22:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'c3d4e5f6a7b8'
down_revision: Union[str, None] = 'b2c3d4e5f6a7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE generation_type ADD VALUE IF NOT EXISTS 'mini_app'")


def downgrade() -> None:
    # PostgreSQL has no ALTER TYPE ... DROP VALUE. No-op.
    pass
