"""drop voice_summary_path from meetings

Revision ID: a1b2c3d4e5f6
Revises: fede6c31a5b4
Create Date: 2026-06-14

"""
from alembic import op

revision = 'a1b2c3d4e5f6'
down_revision = 'fede6c31a5b4'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_column('meetings', 'voice_summary_path')


def downgrade() -> None:
    import sqlalchemy as sa
    op.add_column('meetings', sa.Column('voice_summary_path', sa.String(), nullable=True))
