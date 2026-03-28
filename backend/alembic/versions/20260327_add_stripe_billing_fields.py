"""Add Stripe billing fields to organizations

Revision ID: 20260327_stripe_billing
Revises: 20251224_white_label
Create Date: 2026-03-27 00:00:00.000000

"""

from alembic import op
import sqlalchemy as sa

# revision identifiers, used by Alembic.
revision = "20260327_stripe_billing"
down_revision = "20251224_white_label"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "organizations",
        sa.Column("stripe_customer_id", sa.String(255), nullable=True)
    )
    op.add_column(
        "organizations",
        sa.Column("stripe_subscription_id", sa.String(255), nullable=True)
    )
    op.add_column(
        "organizations",
        sa.Column("stripe_price_id", sa.String(255), nullable=True)
    )
    op.add_column(
        "organizations",
        sa.Column(
            "subscription_status",
            sa.String(50),
            nullable=False,
            server_default="active"
        )
    )


def downgrade() -> None:
    op.drop_column("organizations", "subscription_status")
    op.drop_column("organizations", "stripe_price_id")
    op.drop_column("organizations", "stripe_subscription_id")
    op.drop_column("organizations", "stripe_customer_id")
