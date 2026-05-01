"""switch credits_balance to numeric and add coach tables

Revision ID: e5f6a7b8c9d0
Revises: d4e5f6a7b8c9
Create Date: 2026-04-30 14:00:00.000000

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql


revision: str = 'e5f6a7b8c9d0'
down_revision: Union[str, None] = 'd4e5f6a7b8c9'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


coach_module_enum = postgresql.ENUM(
    'foundation', 'acquisition', 'content', 'outreach', 'funnel',
    name='coach_module',
    create_type=False,
)


def upgrade() -> None:
    # 1. Switch users.credits_balance from Integer to Numeric(10,2).
    op.execute(
        "ALTER TABLE users "
        "ALTER COLUMN credits_balance TYPE NUMERIC(10, 2) "
        "USING credits_balance::numeric"
    )

    # 2. Create the coach_module enum (only if it doesn't already exist).
    op.execute(
        "DO $$ BEGIN "
        "CREATE TYPE coach_module AS ENUM "
        "('foundation','acquisition','content','outreach','funnel'); "
        "EXCEPTION WHEN duplicate_object THEN null; END $$;"
    )

    # 3. coach_conversations
    op.create_table(
        "coach_conversations",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("title", sa.String(length=255), nullable=False, server_default="New conversation"),
        sa.Column("current_module", coach_module_enum, nullable=False, server_default="foundation"),
        sa.Column(
            "context",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=False,
            server_default=sa.text("'{}'::jsonb"),
        ),
        sa.Column("last_message_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_coach_conversations_user_id_last_message_at",
        "coach_conversations",
        ["user_id", "last_message_at"],
    )

    # 4. coach_messages
    op.create_table(
        "coach_messages",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "conversation_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("coach_conversations.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("role", sa.String(length=16), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column(
            "structured_output",
            postgresql.JSONB(astext_type=sa.Text()),
            nullable=True,
        ),
        sa.Column("module", coach_module_enum, nullable=True),
        sa.Column("token_count", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_coach_messages_conversation_id_created_at",
        "coach_messages",
        ["conversation_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_coach_messages_conversation_id_created_at", table_name="coach_messages")
    op.drop_table("coach_messages")
    op.drop_index("ix_coach_conversations_user_id_last_message_at", table_name="coach_conversations")
    op.drop_table("coach_conversations")
    op.execute("DROP TYPE IF EXISTS coach_module")
    op.execute(
        "ALTER TABLE users "
        "ALTER COLUMN credits_balance TYPE INTEGER "
        "USING credits_balance::integer"
    )
