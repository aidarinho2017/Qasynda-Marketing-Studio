"""add enhance to generation_type enum

Revision ID: b2c3d4e5f6a7
Revises: a1b2c3d4e5f6
Create Date: 2026-04-28 21:00:00.000000

"""
from typing import Sequence, Union

from alembic import op


revision: str = 'b2c3d4e5f6a7'
down_revision: Union[str, None] = 'a1b2c3d4e5f6'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # ALTER TYPE ... ADD VALUE cannot run inside a transaction in Postgres < 12,
    # but Alembic + asyncpg handles this fine on Supabase (PG 15+). The IF NOT
    # EXISTS guard makes the migration idempotent.
    op.execute("ALTER TYPE generation_type ADD VALUE IF NOT EXISTS 'enhance'")


def downgrade() -> None:
    # Postgres has no ALTER TYPE ... DROP VALUE. Down-migrating would require
    # recreating the enum and rewriting every row that used the value.
    # Leaving as a no-op since this column only gains values forward.
    pass
