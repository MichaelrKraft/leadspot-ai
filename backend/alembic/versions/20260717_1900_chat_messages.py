"""chat_messages — conversation history for /api/v2/chat

Revision ID: 20260717_chat_mem
Revises: 20260717_inbox_c
Create Date: 2026-07-17 19:00:00
"""

import sqlalchemy as sa
from alembic import op

revision = "20260717_chat_mem"
down_revision = "20260717_inbox_c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "chat_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("organization_id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("thread_id", sa.String(36), nullable=False),
        sa.Column("role", sa.String(20), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(
        "ix_chat_messages_thread_created", "chat_messages", ["thread_id", "created_at"]
    )
    op.create_index(
        "ix_chat_messages_org_thread", "chat_messages", ["organization_id", "thread_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_chat_messages_org_thread", table_name="chat_messages")
    op.drop_index("ix_chat_messages_thread_created", table_name="chat_messages")
    op.drop_table("chat_messages")
