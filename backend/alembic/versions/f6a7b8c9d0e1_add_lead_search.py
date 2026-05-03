"""add lead search tables

Revision ID: f6a7b8c9d0e1
Revises: e5f6a7b8c9d0
Create Date: 2026-05-02 12:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = 'f6a7b8c9d0e1'
down_revision: Union[str, None] = 'e5f6a7b8c9d0'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


lead_campaign_status_enum = postgresql.ENUM(
    'pending',
    'selecting_channels',
    'refused',
    'discovering',
    'enriching',
    'completed',
    'failed',
    name='lead_campaign_status',
    create_type=False,
)


def upgrade() -> None:
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE lead_campaign_status AS ENUM "
        "('pending','selecting_channels','refused','discovering','enriching','completed','failed'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    op.create_table(
        "lead_campaigns",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "status",
            lead_campaign_status_enum,
            nullable=False,
            server_default="pending",
        ),
        sa.Column("progress", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "progress_label",
            sa.String(length=120),
            nullable=False,
            server_default="",
        ),
        sa.Column(
            "icp",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
        ),
        sa.Column(
            "selected_channels",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("leads_target", sa.Integer(), nullable=False),
        sa.Column("leads_found", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("rounds", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("credits_charged", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("error_message", sa.Text(), nullable=True),
        sa.Column("refused_reason", sa.Text(), nullable=True),
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
    op.create_index(
        "ix_lead_campaigns_user_id", "lead_campaigns", ["user_id"]
    )
    op.create_index(
        "ix_lead_campaigns_status", "lead_campaigns", ["status"]
    )

    op.create_table(
        "leads",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "campaign_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("lead_campaigns.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("round", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("platform", sa.String(length=32), nullable=False),
        sa.Column("author_handle", sa.String(length=255), nullable=False),
        sa.Column("author_url", sa.String(length=2000), nullable=True),
        sa.Column("post_url", sa.String(length=2000), nullable=False),
        sa.Column("post_text", sa.Text(), nullable=False),
        sa.Column("post_created_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("signal_type", sa.String(length=32), nullable=False),
        sa.Column("signal_quote", sa.Text(), nullable=False),
        sa.Column("intent_score", sa.Integer(), nullable=False),
        sa.Column("enriched_role", sa.String(length=255), nullable=True),
        sa.Column("enriched_company", sa.String(length=255), nullable=True),
        sa.Column("enriched_niche", sa.String(length=255), nullable=True),
        sa.Column("suggested_angle", sa.Text(), nullable=True),
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
        sa.UniqueConstraint(
            "campaign_id", "post_url", name="uq_leads_campaign_post"
        ),
    )
    op.create_index("ix_leads_campaign_id", "leads", ["campaign_id"])
    op.create_index("ix_leads_intent_score", "leads", ["intent_score"])


def downgrade() -> None:
    op.drop_index("ix_leads_intent_score", table_name="leads")
    op.drop_index("ix_leads_campaign_id", table_name="leads")
    op.drop_table("leads")
    op.drop_index("ix_lead_campaigns_status", table_name="lead_campaigns")
    op.drop_index("ix_lead_campaigns_user_id", table_name="lead_campaigns")
    op.drop_table("lead_campaigns")
    op.execute("DROP TYPE IF EXISTS lead_campaign_status")
