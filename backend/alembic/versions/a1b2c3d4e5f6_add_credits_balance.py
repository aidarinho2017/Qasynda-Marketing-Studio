"""add credits_balance to users

Revision ID: a1b2c3d4e5f6
Revises: 9371e3d98817
Create Date: 2026-04-28 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '9371e3d98817'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column(
        'users',
        sa.Column(
            'credits_balance',
            sa.Integer(),
            nullable=False,
            server_default=sa.text('5'),
        ),
    )


def downgrade() -> None:
    op.drop_column('users', 'credits_balance')
