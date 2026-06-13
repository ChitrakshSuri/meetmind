"""create meetings and tickets tables

Revision ID: 444d35839366
Revises:
Create Date: 2026-06-13 18:54:37.909419

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import UUID


revision: str = "444d35839366"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "meetings",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column("bot_id", sa.String(), nullable=False, unique=True),
        sa.Column("meeting_url", sa.String(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="processing"),
        sa.Column("transcript", sa.Text(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_meetings_bot_id", "meetings", ["bot_id"])

    op.create_table(
        "tickets",
        sa.Column("id", UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "meeting_id",
            UUID(as_uuid=True),
            sa.ForeignKey("meetings.id"),
            nullable=False,
        ),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("ticket_type", sa.String(), nullable=False),
        sa.Column("priority", sa.String(), nullable=False),
        sa.Column("assignee", sa.String(), nullable=True),
        sa.Column("approved", sa.Boolean(), nullable=True),
        sa.Column("jira_key", sa.String(), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.text("now()"),
        ),
    )
    op.create_index("ix_tickets_meeting_id", "tickets", ["meeting_id"])


def downgrade() -> None:
    op.drop_index("ix_tickets_meeting_id", table_name="tickets")
    op.drop_table("tickets")
    op.drop_index("ix_meetings_bot_id", table_name="meetings")
    op.drop_table("meetings")
