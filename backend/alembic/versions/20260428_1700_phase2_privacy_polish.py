"""Phase 2 privacy polish — eu_strict_mode + daemon pause fields

Revision ID: phase2_privacy
Revises: ghostlog_init
Create Date: 2026-04-28 17:00:00.000000

Adds:
- users.eu_strict_mode (BOOLEAN, default false)
- daemon_credentials.paused_until (DateTime, nullable; NULL = not paused;
  far-future value = pause indefinitely)
- daemon_credentials.pause_set_at (DateTime, nullable; bookkeeping)

See plan §11.3 (EU strict mode) and §11.4 (data retention windows). Pause
fields support the privacy settings UI (Part A §2 of the Phase 2 build).
"""
from alembic import op
import sqlalchemy as sa


revision = 'phase2_privacy'
down_revision = 'ghostlog_init'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # users.eu_strict_mode
    with op.batch_alter_table('users') as batch_op:
        batch_op.add_column(
            sa.Column(
                'eu_strict_mode',
                sa.Boolean(),
                nullable=False,
                server_default=sa.text('0'),
            )
        )

    # daemon_credentials.paused_until + pause_set_at
    with op.batch_alter_table('daemon_credentials') as batch_op:
        batch_op.add_column(sa.Column('paused_until', sa.DateTime(), nullable=True))
        batch_op.add_column(sa.Column('pause_set_at', sa.DateTime(), nullable=True))


def downgrade() -> None:
    with op.batch_alter_table('daemon_credentials') as batch_op:
        batch_op.drop_column('pause_set_at')
        batch_op.drop_column('paused_until')

    with op.batch_alter_table('users') as batch_op:
        batch_op.drop_column('eu_strict_mode')
