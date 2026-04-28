"""Ghostlog signals + daemon auth + supporting tables

Revision ID: ghostlog_init
Revises: e85da1d8e500
Create Date: 2026-04-28 15:00:00.000000

Adds the schema for the Ghostlog feature inside LeadSpot.AI:
- signals: redacted observations from the Ambient daemon
- daemon_credentials: per-Mac auth for the daemon
- signal_tombstones: cloud-side soft-deletes that propagate to daemons
- email_aliases: multiple emails per contact for matching
- merge_redirects: contact A merged into B (so daemon-emitted signals
  targeting A get attributed to B instead of 404'd)
- daemon_token_usage: per-user-per-day cost telemetry (Haiku/Sonnet token spend)
"""
from alembic import op
import sqlalchemy as sa


revision = 'ghostlog_init'
down_revision = 'e85da1d8e500'
branch_labels = None
depends_on = None


SIGNAL_STATES = (
    "captured", "enriched", "matched", "queued",
    "promoted", "held", "dropped", "redacted",
)
SIGNAL_SOURCES = ("ambient_screen", "dockable_transcript", "manual")
REDACTION_STATUSES = ("clean", "pii_stripped", "rejected")


def upgrade() -> None:
    # ------------------------------------------------------------------
    # daemon_credentials
    # ------------------------------------------------------------------
    op.create_table(
        'daemon_credentials',
        sa.Column('daemon_id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('refresh_token_hash', sa.String(128), nullable=False),
        # rotation_generation increments on every refresh; previous-generation tokens
        # within the 60-second grace window return the most-recent successor (idempotent).
        sa.Column('refresh_generation', sa.Integer, nullable=False, server_default='0'),
        sa.Column('last_successor_token_hash', sa.String(128), nullable=True),
        sa.Column('last_successor_issued_at', sa.DateTime, nullable=True),
        sa.Column('device_label', sa.String(255), nullable=False, server_default=''),
        sa.Column('user_email_at_auth', sa.String(255), nullable=False, server_default=''),
        sa.Column('schema_version', sa.SmallInteger, nullable=False, server_default='1'),
        sa.Column('last_seen_at', sa.DateTime, nullable=True),
        sa.Column('revoked_at', sa.DateTime, nullable=True),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index('ix_daemon_creds_org', 'daemon_credentials', ['organization_id'])
    op.create_index('ix_daemon_creds_user', 'daemon_credentials', ['user_id'])
    op.create_index('ix_daemon_creds_token_hash', 'daemon_credentials', ['refresh_token_hash'])

    # ------------------------------------------------------------------
    # email_aliases (multiple addresses per contact)
    # ------------------------------------------------------------------
    op.create_table(
        'email_aliases',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('contact_id', sa.String(36), nullable=False),
        sa.Column('organization_id', sa.String(36), nullable=False),
        # Normalized: lowercase + +-suffix stripped, then sha256-hashed.
        sa.Column('email_hash', sa.String(64), nullable=False),
        # Original address kept only for display; hash is what's matched against.
        sa.Column('email_display', sa.String(255), nullable=False, server_default=''),
        sa.Column('is_primary', sa.Boolean, nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('organization_id', 'email_hash', name='ux_email_aliases_org_hash'),
    )
    op.create_index('ix_email_aliases_contact', 'email_aliases', ['contact_id'])
    op.create_index('ix_email_aliases_org_hash', 'email_aliases', ['organization_id', 'email_hash'])

    # ------------------------------------------------------------------
    # merge_redirects (A merged into B → signals targeting A go to B)
    # ------------------------------------------------------------------
    op.create_table(
        'merge_redirects',
        sa.Column('old_contact_id', sa.String(36), primary_key=True),
        sa.Column('new_contact_id', sa.String(36), nullable=False),
        sa.Column('organization_id', sa.String(36), nullable=False),
        sa.Column('merged_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('merged_by_user_id', sa.String(36), nullable=True),
    )
    op.create_index('ix_merge_redirects_new', 'merge_redirects', ['new_contact_id'])
    op.create_index('ix_merge_redirects_org', 'merge_redirects', ['organization_id'])

    # ------------------------------------------------------------------
    # signals (the unifying primitive)
    # ------------------------------------------------------------------
    op.create_table(
        'signals',
        sa.Column('id', sa.String(36), primary_key=True),
        # sha256(observed_minute|match_key|extractor|content_hash) — daemon-generated.
        sa.Column('idempotency_key', sa.String(64), nullable=False),
        sa.Column('contact_id', sa.String(36), nullable=True),
        sa.Column('contact_match_key', sa.String(255), nullable=False),
        sa.Column('organization_id', sa.String(36), nullable=False),
        sa.Column('source', sa.String(40), nullable=False),
        sa.Column('source_app', sa.String(120), nullable=True),
        sa.Column('extractor', sa.String(60), nullable=False),
        # ≤240 chars per design; column is wider to be safe with multi-byte chars.
        sa.Column('summary', sa.String(512), nullable=False, server_default=''),
        sa.Column('confidence', sa.SmallInteger, nullable=False, server_default='0'),
        sa.Column('state', sa.String(20), nullable=False, server_default='captured'),
        sa.Column('redaction_status', sa.String(20), nullable=False, server_default='clean'),
        sa.Column('observed_at', sa.DateTime, nullable=False),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('promoted_at', sa.DateTime, nullable=True),
        sa.Column('deleted_at', sa.DateTime, nullable=True),
        sa.Column('daemon_id', sa.String(36), nullable=False),
        sa.Column('schema_version', sa.SmallInteger, nullable=False, server_default='1'),
        # Forward-compat: new extractor fields land here without DB migration.
        # JSON type maps to JSONB on Postgres, TEXT on SQLite.
        sa.Column('extras', sa.JSON, nullable=True),
        # OCR-snippet hash for "Why was this logged?" auditability without
        # storing the raw OCR.
        sa.Column('ocr_snippet_hash', sa.String(64), nullable=True),
        sa.CheckConstraint(
            "state IN ('captured','enriched','matched','queued','promoted','held','dropped','redacted')",
            name='ck_signals_state',
        ),
        sa.CheckConstraint(
            "source IN ('ambient_screen','dockable_transcript','manual')",
            name='ck_signals_source',
        ),
        sa.CheckConstraint(
            "redaction_status IN ('clean','pii_stripped','rejected')",
            name='ck_signals_redaction',
        ),
        sa.CheckConstraint(
            "confidence BETWEEN 0 AND 100",
            name='ck_signals_confidence',
        ),
        # Idempotency: a single (org, key) tuple produces exactly one row.
        sa.UniqueConstraint('organization_id', 'idempotency_key', name='ux_signals_org_idempotency'),
    )
    # Timeline reads: contact's signals ordered by observed_at desc, excluding deleted.
    op.create_index(
        'ix_signals_contact_observed',
        'signals',
        ['contact_id', 'observed_at'],
    )
    # Org-scope state queries (e.g., outbox depth by org).
    op.create_index('ix_signals_org_state', 'signals', ['organization_id', 'state'])
    op.create_index('ix_signals_daemon', 'signals', ['daemon_id'])
    # For RTBF / unmatched-signal joins.
    op.create_index('ix_signals_match_key', 'signals', ['organization_id', 'contact_match_key'])

    # ------------------------------------------------------------------
    # signal_tombstones (drop replication to daemons)
    # ------------------------------------------------------------------
    op.create_table(
        'signal_tombstones',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), nullable=False),
        # tombstone_type: 'signal' (specific signal_id), 'contact' (cascade by contact),
        # 'email_hash' (RTBF: purge all signals for a hashed email),
        # 'subscription' (cancel: purge all org signals after grace).
        sa.Column('tombstone_type', sa.String(30), nullable=False),
        sa.Column('signal_id', sa.String(36), nullable=True),
        sa.Column('contact_id', sa.String(36), nullable=True),
        sa.Column('email_hash', sa.String(64), nullable=True),
        sa.Column('reason', sa.String(120), nullable=True),
        sa.Column('issued_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.Column('issued_by_user_id', sa.String(36), nullable=True),
        sa.CheckConstraint(
            "tombstone_type IN ('signal','contact','email_hash','subscription')",
            name='ck_tombstones_type',
        ),
    )
    # Daemons poll: GET /tombstones?since=<cursor> — orderable by issued_at.
    op.create_index('ix_tombstones_org_issued', 'signal_tombstones', ['organization_id', 'issued_at'])

    # ------------------------------------------------------------------
    # daemon_token_usage (cost telemetry — non-negotiable per §13/§15)
    # ------------------------------------------------------------------
    op.create_table(
        'daemon_token_usage',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('daemon_id', sa.String(36), nullable=False),
        sa.Column('day', sa.Date, nullable=False),
        sa.Column('haiku_tokens_input', sa.Integer, nullable=False, server_default='0'),
        sa.Column('haiku_tokens_output', sa.Integer, nullable=False, server_default='0'),
        sa.Column('sonnet_tokens_input', sa.Integer, nullable=False, server_default='0'),
        sa.Column('sonnet_tokens_output', sa.Integer, nullable=False, server_default='0'),
        sa.Column('signal_count', sa.Integer, nullable=False, server_default='0'),
        sa.Column('updated_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint('user_id', 'daemon_id', 'day', name='ux_token_usage_user_day'),
    )
    op.create_index('ix_token_usage_day', 'daemon_token_usage', ['day'])


def downgrade() -> None:
    # Reverse order of creation. Indexes drop with the table on SQLite;
    # explicit drop_index calls help on Postgres where it doesn't.
    op.drop_index('ix_token_usage_day', 'daemon_token_usage')
    op.drop_table('daemon_token_usage')

    op.drop_index('ix_tombstones_org_issued', 'signal_tombstones')
    op.drop_table('signal_tombstones')

    op.drop_index('ix_signals_match_key', 'signals')
    op.drop_index('ix_signals_daemon', 'signals')
    op.drop_index('ix_signals_org_state', 'signals')
    op.drop_index('ix_signals_contact_observed', 'signals')
    op.drop_table('signals')

    op.drop_index('ix_merge_redirects_org', 'merge_redirects')
    op.drop_index('ix_merge_redirects_new', 'merge_redirects')
    op.drop_table('merge_redirects')

    op.drop_index('ix_email_aliases_org_hash', 'email_aliases')
    op.drop_index('ix_email_aliases_contact', 'email_aliases')
    op.drop_table('email_aliases')

    op.drop_index('ix_daemon_creds_token_hash', 'daemon_credentials')
    op.drop_index('ix_daemon_creds_user', 'daemon_credentials')
    op.drop_index('ix_daemon_creds_org', 'daemon_credentials')
    op.drop_table('daemon_credentials')
