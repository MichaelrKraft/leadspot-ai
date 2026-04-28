"""Phase 3 conv-AI: chat_telemetry table

Revision ID: phase3_chat_telemetry
Revises: ghostlog_digest
Create Date: 2026-04-28 19:00:00.000000

Adds the per-turn telemetry table backing the Phase 3 Conversational AI layer's
hallucination guard metric. See plan §6 success metrics:
  "100% of factual claims cite >= 1 signal_id"
  "0 hallucinated contact facts"

The chat token spend is folded INTO this same table (tokens_input / tokens_output
columns) rather than into daemon_token_usage. Rationale: daemon_token_usage is
day-rolled-up and keyed by daemon_id, which doesn't apply to a chat session
that happens browser-side (no daemon involved). Aggregating chat spend per-turn
also lets us correlate cost with the citation guard outcome — the daemon table
intentionally has no per-turn dimension.
"""
from alembic import op
import sqlalchemy as sa


revision = 'phase3_chat_telemetry'
down_revision = 'ghostlog_digest'
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        'chat_telemetry',
        sa.Column('id', sa.String(36), primary_key=True),
        sa.Column('organization_id', sa.String(36), nullable=False),
        sa.Column('user_id', sa.String(36), nullable=False),
        sa.Column('thread_id', sa.String(36), nullable=False),
        sa.Column('model', sa.String(60), nullable=False),
        sa.Column('has_citations', sa.Boolean, nullable=False, server_default=sa.text('0')),
        sa.Column('num_signal_ids', sa.Integer, nullable=False, server_default='0'),
        sa.Column('triggered_citation_guard', sa.Boolean, nullable=False, server_default=sa.text('0')),
        sa.Column('tokens_input', sa.Integer, nullable=False, server_default='0'),
        sa.Column('tokens_output', sa.Integer, nullable=False, server_default='0'),
        sa.Column('is_deep', sa.Boolean, nullable=False, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime, nullable=False, server_default=sa.func.now()),
    )
    op.create_index(
        'ix_chat_telemetry_org_created',
        'chat_telemetry',
        ['organization_id', 'created_at'],
    )
    op.create_index('ix_chat_telemetry_thread', 'chat_telemetry', ['thread_id'])
    op.create_index(
        'ix_chat_telemetry_user_created',
        'chat_telemetry',
        ['user_id', 'created_at'],
    )


def downgrade() -> None:
    op.drop_index('ix_chat_telemetry_user_created', 'chat_telemetry')
    op.drop_index('ix_chat_telemetry_thread', 'chat_telemetry')
    op.drop_index('ix_chat_telemetry_org_created', 'chat_telemetry')
    op.drop_table('chat_telemetry')
