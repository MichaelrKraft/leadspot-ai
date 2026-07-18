"""unified inbox phase A: email_messages thread/direction/category + email_events

Revision ID: 20260717_inbox_a
Revises: 20260716_cre2
Create Date: 2026-07-17 13:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '20260717_inbox_a'
down_revision: Union[str, None] = '20260716_cre2'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.add_column('email_messages', sa.Column('thread_id', sa.String(255), nullable=True))
    op.add_column('email_messages', sa.Column('direction', sa.String(10), nullable=False, server_default='inbound'))
    op.add_column('email_messages', sa.Column('category', sa.String(100), nullable=True))
    op.create_index('ix_email_messages_thread_id', 'email_messages', ['thread_id'])

    op.create_table(
        'email_events',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('org_id', sa.String(36), nullable=False),
        sa.Column('provider_message_id', sa.String(255), nullable=False),
        sa.Column('email_message_id', sa.String(36), nullable=True),
        sa.Column('category', sa.String(100), nullable=True),
        sa.Column('action', sa.String(50), nullable=False),
        sa.Column('detail', sa.String(300), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.UniqueConstraint('org_id', 'provider_message_id', 'action', name='ux_email_events_org_msg_action'),
    )
    op.create_index('ix_email_events_org_id', 'email_events', ['org_id'])
    op.create_index('ix_email_events_email_message_id', 'email_events', ['email_message_id'])
    op.create_index('ix_email_events_org_created', 'email_events', ['org_id', 'created_at'])


def downgrade() -> None:
    op.drop_index('ix_email_events_org_created', table_name='email_events')
    op.drop_index('ix_email_events_email_message_id', table_name='email_events')
    op.drop_index('ix_email_events_org_id', table_name='email_events')
    op.drop_table('email_events')
    op.drop_index('ix_email_messages_thread_id', table_name='email_messages')
    op.drop_column('email_messages', 'category')
    op.drop_column('email_messages', 'direction')
    op.drop_column('email_messages', 'thread_id')
