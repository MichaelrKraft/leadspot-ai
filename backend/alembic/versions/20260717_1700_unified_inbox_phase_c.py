"""unified inbox phase C: style_profiles

Revision ID: 20260717_inbox_c
Revises: 20260717_inbox_b
Create Date: 2026-07-17 17:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '20260717_inbox_c'
down_revision: Union[str, None] = '20260717_inbox_b'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'style_profiles',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('org_id', sa.String(36), nullable=False),
        sa.Column('mailbox_email', sa.String(255), nullable=False),
        sa.Column('profile_md', sa.Text(), nullable=False),
        sa.Column('built_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('org_id', 'mailbox_email', name='ux_style_profiles_org_mailbox'),
    )
    op.create_index('ix_style_profiles_org_id', 'style_profiles', ['org_id'])


def downgrade() -> None:
    op.drop_index('ix_style_profiles_org_id', table_name='style_profiles')
    op.drop_table('style_profiles')
