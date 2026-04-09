"""Add local contacts table (replaces Mautic dependency)

Revision ID: 20260408_contacts
Revises: 20260408_email_tracking
Create Date: 2026-04-08 00:00:00.000000
"""
from alembic import op
import sqlalchemy as sa

revision = '20260408_contacts'
down_revision = '20260408_email_tracking'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'contacts',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('first_name', sa.String(100), nullable=False, server_default=''),
        sa.Column('last_name', sa.String(100), nullable=False, server_default=''),
        sa.Column('email', sa.String(255), nullable=False, server_default=''),
        sa.Column('company', sa.String(255), nullable=True),
        sa.Column('phone', sa.String(50), nullable=True),
        sa.Column('tags_json', sa.Text, nullable=True),
        sa.Column('points', sa.Integer, nullable=False, server_default='0'),
        sa.Column('last_active', sa.DateTime, nullable=True),
        sa.Column('organization_id', sa.String(36), nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_contacts_organization_id', 'contacts', ['organization_id'])
    op.create_index('ix_contacts_email', 'contacts', ['email'])


def downgrade() -> None:
    op.drop_index('ix_contacts_email', 'contacts')
    op.drop_index('ix_contacts_organization_id', 'contacts')
    op.drop_table('contacts')
