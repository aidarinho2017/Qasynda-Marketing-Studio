"""add catalogues table and catalogue_id fk on generations

Revision ID: i9d0e1f2g3h4
Revises: h8c9d0e1f2g3
Create Date: 2026-05-04 10:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql
from alembic import op


revision: str = 'i9d0e1f2g3h4'
down_revision: Union[str, None] = 'h8c9d0e1f2g3'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "catalogues",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(length=255), nullable=True),
        sa.Column(
            "mode",
            sa.String(length=50),
            nullable=False,
            server_default="marketplace",
        ),
        sa.Column(
            "settings",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column("total_items", sa.Integer(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_catalogues_user_id", "catalogues", ["user_id"])

    op.add_column(
        "generations",
        sa.Column(
            "catalogue_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("catalogues.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )
    op.create_index("ix_generations_catalogue_id", "generations", ["catalogue_id"])


def downgrade() -> None:
    op.drop_index("ix_generations_catalogue_id", table_name="generations")
    op.drop_column("generations", "catalogue_id")
    op.drop_index("ix_catalogues_user_id", table_name="catalogues")
    op.drop_table("catalogues")
