"""add email_messages and deal_suggestions tables

Revision ID: 20260716_cre2
Revises: 20260716_cre1
Create Date: 2026-07-16 17:00:00

"""
from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = '20260716_cre2'
down_revision: Union[str, None] = '20260716_cre1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'email_messages',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('org_id', sa.String(36), nullable=False),
        sa.Column('provider', sa.String(20), nullable=False, server_default='outlook'),
        sa.Column('provider_message_id', sa.String(255), nullable=False),
        sa.Column('from_address', sa.String(255), nullable=False),
        sa.Column('to_addresses', sa.Text(), nullable=True),
        sa.Column('subject', sa.String(500), nullable=True),
        sa.Column('body_preview', sa.Text(), nullable=True),
        sa.Column('received_at', sa.DateTime(), nullable=False),
        sa.Column('contact_id', sa.String(36), nullable=True),
        sa.Column('deal_id', sa.String(36), nullable=True),
        sa.Column('analyzed_at', sa.DateTime(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=False),
    )
    op.create_index('ix_email_messages_org_id', 'email_messages', ['org_id'])
    op.create_index('ix_email_messages_contact_id', 'email_messages', ['contact_id'])
    op.create_index('ix_email_messages_deal_id', 'email_messages', ['deal_id'])
    op.create_index('ix_email_messages_org_provider_msg', 'email_messages', ['org_id', 'provider_message_id'])

    op.create_table(
        'deal_suggestions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('org_id', sa.String(36), nullable=False),
        sa.Column('deal_id', sa.String(36), nullable=False),
        sa.Column('current_stage', sa.String(50), nullable=False),
        sa.Column('suggested_stage', sa.String(50), nullable=False),
        sa.Column('confidence', sa.Integer(), nullable=False, server_default='0'),
        sa.Column('evidence', sa.Text(), nullable=True),
        sa.Column('source_type', sa.String(20), nullable=False),
        sa.Column('source_id', sa.String(36), nullable=False),
        sa.Column('status', sa.String(20), nullable=False, server_default='pending'),
        sa.Column('created_at', sa.DateTime(), nullable=False),
        sa.Column('resolved_at', sa.DateTime(), nullable=True),
        sa.Column('resolved_by', sa.String(36), nullable=True),
    )
    op.create_index('ix_deal_suggestions_org_id', 'deal_suggestions', ['org_id'])
    op.create_index('ix_deal_suggestions_deal_id', 'deal_suggestions', ['deal_id'])
    op.create_index('ix_deal_suggestions_status', 'deal_suggestions', ['status'])


def downgrade() -> None:
    op.drop_index('ix_deal_suggestions_status', table_name='deal_suggestions')
    op.drop_index('ix_deal_suggestions_deal_id', table_name='deal_suggestions')
    op.drop_index('ix_deal_suggestions_org_id', table_name='deal_suggestions')
    op.drop_table('deal_suggestions')
    op.drop_index('ix_email_messages_org_provider_msg', table_name='email_messages')
    op.drop_index('ix_email_messages_deal_id', table_name='email_messages')
    op.drop_index('ix_email_messages_contact_id', table_name='email_messages')
    op.drop_index('ix_email_messages_org_id', table_name='email_messages')
    op.drop_table('email_messages')


