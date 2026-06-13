"""add summary fields to meetings

Revision ID: fede6c31a5b4
Revises: 444d35839366
Create Date: 2026-06-13 22:30:53.014667

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


revision: str = "fede6c31a5b4"
down_revision: Union[str, Sequence[str], None] = "444d35839366"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column("meetings", sa.Column("summary", sa.Text(), nullable=True))
    op.add_column("meetings", sa.Column("voice_summary_path", sa.String(), nullable=True))


def downgrade() -> None:
    op.drop_column("meetings", "voice_summary_path")
    op.drop_column("meetings", "summary")
