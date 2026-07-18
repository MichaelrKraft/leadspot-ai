"""unified inbox phase B: email_categories + sender_rules

Revision ID: 20260717_inbox_b
Revises: 20260717_inbox_a
Create Date: 2026-07-17 15:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '20260717_inbox_b'
down_revision: Union[str, None] = '20260717_inbox_a'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'email_categories',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('org_id', sa.String(36), nullable=False),
        sa.Column('name', sa.String(100), nullable=False),
        sa.Column('description', sa.String(500), nullable=True),
        sa.Column('position', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('enabled', sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column('drafts_enabled', sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('org_id', 'name', name='ux_email_categories_org_name'),
    )
    op.create_index('ix_email_categories_org_id', 'email_categories', ['org_id'])

    op.create_table(
        'sender_rules',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('org_id', sa.String(36), nullable=False),
        sa.Column('pattern', sa.String(200), nullable=False),
        sa.Column('category_name', sa.String(100), nullable=False),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('org_id', 'pattern', name='ux_sender_rules_org_pattern'),
    )
    op.create_index('ix_sender_rules_org_id', 'sender_rules', ['org_id'])


def downgrade() -> None:
    op.drop_index('ix_sender_rules_org_id', table_name='sender_rules')
    op.drop_table('sender_rules')
    op.drop_index('ix_email_categories_org_id', table_name='email_categories')
    op.drop_table('email_categories')
