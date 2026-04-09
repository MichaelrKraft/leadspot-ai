"""Add email tracking fields and suppression list

Revision ID: a1b2c3d4e5f6
Revises: 20260327_stripe_billing
Create Date: 2026-04-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260408_email_tracking'
down_revision = '20260327_stripe_billing'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Add tracking columns to emails table
    op.add_column('emails', sa.Column('campaign_id', sa.String(36), nullable=True))
    op.add_column('emails', sa.Column('contact_id', sa.String(36), nullable=True))
    op.add_column('emails', sa.Column('message_id', sa.String(255), nullable=True))
    op.add_column('emails', sa.Column('unsubscribed_at', sa.DateTime(), nullable=True))

    # Create indexes for new columns
    op.create_index('ix_emails_campaign_id', 'emails', ['campaign_id'])
    op.create_index('ix_emails_contact_id', 'emails', ['contact_id'])
    op.create_index('ix_emails_message_id', 'emails', ['message_id'])

    # Create email_suppressions table
    op.create_table(
        'email_suppressions',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('email', sa.String(255), nullable=False),
        sa.Column('reason', sa.String(50), nullable=False),
        sa.Column('source', sa.String(50), nullable=True),
        sa.Column('suppressed_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
        sa.Column('created_at', sa.DateTime(), nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_email_suppressions_id', 'email_suppressions', ['id'])
    op.create_index('ix_email_suppressions_email', 'email_suppressions', ['email'], unique=True)


def downgrade() -> None:
    op.drop_index('ix_email_suppressions_email', 'email_suppressions')
    op.drop_index('ix_email_suppressions_id', 'email_suppressions')
    op.drop_table('email_suppressions')
    op.drop_index('ix_emails_message_id', 'emails')
    op.drop_index('ix_emails_contact_id', 'emails')
    op.drop_index('ix_emails_campaign_id', 'emails')
    op.drop_column('emails', 'unsubscribed_at')
    op.drop_column('emails', 'message_id')
    op.drop_column('emails', 'contact_id')
    op.drop_column('emails', 'campaign_id')
