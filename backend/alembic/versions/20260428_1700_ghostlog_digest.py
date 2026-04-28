"""Ghostlog Phase 1 Week 3 — digest tables + user timezone

Revision ID: ghostlog_digest
Revises: ghostlog_init
Create Date: 2026-04-28 17:00:00.000000

Adds:
- digest_unmatched_samples: cloud-side proxy of the daemon's unmatched_signals_log,
  used by the cold-start morning digest in the first 14 days. 14-day TTL via
  expires_at (cleaned up opportunistically; not enforced by DB).
- users.timezone: IANA timezone string (e.g. "America/Los_Angeles") used by the
  digest scheduler to fire at 7am local time per user.
"""
from alembic import op
import sqlalchemy as sa


revision = 'ghostlog_digest'
# Chain after phase2_privacy (which is also a child of ghostlog_init) so we
# have a single head. Both migrations are independent in scope; ordering
# is for the linear-chain requirement, not a logical dependency.
down_revision = 'phase2_privacy'
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # users.timezone — IANA TZ name. Default Pacific time (Mike's TZ).
    # Existing rows pick up the default via server_default.
    # ------------------------------------------------------------------
    with op.batch_alter_table('users') as batch:
        batch.add_column(
            sa.Column(
                'timezone',
                sa.String(64),
                nullable=False,
                server_default='America/Los_Angeles',
            )
        )

    # ------------------------------------------------------------------
    # digest_unmatched_samples
    # The daemon POSTs sampled unmatched candidates daily (capped at 50/call).
    # Cold-start digest (first 14 days) reads the most recent rows for the org.
    # expires_at lets us prune via a simple WHERE clause; no cron needed for
    # the wedge — the 14-day window is short enough that the rows churn
    # naturally, and the digest query already filters by expires_at > now.
    # ------------------------------------------------------------------
    op.create_table(
        'digest_unmatched_samples',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('daemon_id', sa.String(36), nullable=False),
        sa.Column('organization_id', sa.String(36), nullable=False),
        sa.Column('contact_match_key', sa.String(255), nullable=False),
        sa.Column('source_app', sa.String(120), nullable=True),
        sa.Column('summary', sa.String(512), nullable=False, server_default=''),
        sa.Column('observed_at', sa.DateTime, nullable=False),
        sa.Column('expires_at', sa.DateTime, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        'ix_digest_unmatched_org_expires',
        'digest_unmatched_samples',
        ['organization_id', 'expires_at'],
    )
    op.create_index(
        'ix_digest_unmatched_daemon',
        'digest_unmatched_samples',
        ['daemon_id'],
    )


def downgrade() -> None:
    op.drop_index('ix_digest_unmatched_daemon', 'digest_unmatched_samples')
    op.drop_index('ix_digest_unmatched_org_expires', 'digest_unmatched_samples')
    op.drop_table('digest_unmatched_samples')

    with op.batch_alter_table('users') as batch:
        batch.drop_column('timezone')
