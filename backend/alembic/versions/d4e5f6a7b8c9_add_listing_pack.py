"""add listing_pack to generation_type and content_plan column

Revision ID: d4e5f6a7b8c9
Revises: c3d4e5f6a7b8
Create Date: 2026-04-30 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = 'd4e5f6a7b8c9'
down_revision: Union[str, None] = 'c3d4e5f6a7b8'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("ALTER TYPE generation_type ADD VALUE IF NOT EXISTS 'listing_pack'")
    op.add_column(
        'generations',
        sa.Column('content_plan', postgresql.JSONB(astext_type=sa.Text()), nullable=True),
    )


def downgrade() -> None:
    op.drop_column('generations', 'content_plan')
    # PostgreSQL has no ALTER TYPE ... DROP VALUE. No-op for the enum.
