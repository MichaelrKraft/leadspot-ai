"""Space Agent: feature flag backfill, audit actor_type, user onboarding timestamp

Revision ID: 20260428_2100
Revises: phase3_chat_telemetry
Create Date: 2026-04-28 21:00:00.000000

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers
revision = '20260428_2100'
down_revision = 'phase3_chat_telemetry'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # Part A: Backfill space_agent_enabled in organizations features JSON
    # Only works on PostgreSQL — in SQLite dev the model default handles it
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("""
            UPDATE organizations
            SET features = features || '{"space_agent_enabled": false}'::jsonb
            WHERE features IS NOT NULL
              AND features->>'space_agent_enabled' IS NULL
        """)

    # Part B: Add actor_type to audit_logs
    op.add_column(
        'audit_logs',
        sa.Column(
            'actor_type',
            sa.String(20),
            nullable=False,
            server_default='human'
        )
    )

    # Part C: Add space_agent_onboarding_completed_at to users
    op.add_column(
        'users',
        sa.Column(
            'space_agent_onboarding_completed_at',
            sa.DateTime(),
            nullable=True
        )
    )


def downgrade() -> None:
    # Reverse Part C
    op.drop_column('users', 'space_agent_onboarding_completed_at')

    # Reverse Part B
    op.drop_column('audit_logs', 'actor_type')

    # Reverse Part A: Remove space_agent_enabled from features JSON
    bind = op.get_bind()
    if bind.dialect.name == 'postgresql':
        op.execute("""
            UPDATE organizations
            SET features = features - 'space_agent_enabled'
            WHERE features IS NOT NULL
              AND features->>'space_agent_enabled' IS NOT NULL
        """)
