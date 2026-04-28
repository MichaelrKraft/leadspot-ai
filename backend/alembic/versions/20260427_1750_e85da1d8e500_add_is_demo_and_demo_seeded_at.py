"""add_is_demo_and_demo_seeded_at

Revision ID: e85da1d8e500
Revises: 20260408_contacts
Create Date: 2026-04-27 17:50:24.794351

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = 'e85da1d8e500'
down_revision: Union[str, None] = '20260408_contacts'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('contacts', sa.Column('is_demo', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('campaigns', sa.Column('is_demo', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('deals', sa.Column('is_demo', sa.Integer(), nullable=False, server_default='0'))
    op.add_column('organizations', sa.Column('demo_seeded_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column('organizations', 'demo_seeded_at')
    op.drop_column('deals', 'is_demo')
    op.drop_column('campaigns', 'is_demo')
    op.drop_column('contacts', 'is_demo')
