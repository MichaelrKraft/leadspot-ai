"""add leasing pipeline fields to deals

Revision ID: 20260716_cre1
Revises: 20260428_2100
Create Date: 2026-07-16 16:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '20260716_cre1'
down_revision: Union[str, None] = '20260428_2100'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('deals', sa.Column('pipeline', sa.String(20), nullable=False, server_default='sales'))
    op.add_column('deals', sa.Column('property_name', sa.String(255), nullable=True))
    op.add_column('deals', sa.Column('stage_changed_at', sa.DateTime(), nullable=True))
    op.add_column('deals', sa.Column('source_meta', sa.JSON(), nullable=True))
    op.create_index('ix_deals_pipeline', 'deals', ['pipeline'])


def downgrade() -> None:
    op.drop_index('ix_deals_pipeline', table_name='deals')
    op.drop_column('deals', 'source_meta')
    op.drop_column('deals', 'stage_changed_at')
    op.drop_column('deals', 'property_name')
    op.drop_column('deals', 'pipeline')
