"""Add white-label fields to organizations

Revision ID: 20251224_white_label
Revises: 20251208_add_password_reset_tokens
Create Date: 2024-12-24 10:00:00.000000

"""

from alembic import op
import sqlalchemy as sa
import json

# revision identifiers, used by Alembic.
revision = "20251224_white_label"
down_revision = "a1b2c3d4e5f6"  # password_reset_tokens migration
branch_labels = None
depends_on = None


# Default values as JSON strings (SQLite compatible)
DEFAULT_BRANDING = json.dumps({
    "app_name": "LeadSpot.ai",
    "logo_url": None,
    "favicon_url": None,
    "primary_color": "#818cf8",
    "secondary_color": "#a5b4fc",
    "accent_color": "#c7d2fe",
})

DEFAULT_FEATURES = json.dumps({
    "white_label_enabled": False,
    "voice_agents_enabled": False,
    "max_sub_organizations": 0,
    "max_contacts": 10000,
    "max_users": 5,
    "ai_insights_enabled": True,
    "lead_scoring_enabled": True,
})


def upgrade() -> None:
    # White-label hierarchy
    op.add_column(
        "organizations",
        sa.Column("parent_organization_id", sa.String(36), nullable=True)
    )
    op.add_column(
        "organizations",
        sa.Column("organization_type", sa.String(50), nullable=False, server_default="client")
    )
    op.add_column(
        "organizations",
        sa.Column("custom_domain", sa.String(255), nullable=True)
    )

    # Branding and features (TEXT for SQLite, JSON for PostgreSQL)
    op.add_column(
        "organizations",
        sa.Column(
            "branding",
            sa.Text(),
            nullable=False,
            server_default=DEFAULT_BRANDING
        )
    )
    op.add_column(
        "organizations",
        sa.Column(
            "features",
            sa.Text(),
            nullable=False,
            server_default=DEFAULT_FEATURES
        )
    )

    # Billing & Wallet (GoHighLevel-style)
    op.add_column(
        "organizations",
        sa.Column("wallet_balance", sa.Numeric(10, 2), nullable=False, server_default="0.00")
    )
    op.add_column(
        "organizations",
        sa.Column("wallet_auto_recharge", sa.Boolean(), nullable=False, server_default="false")
    )
    op.add_column(
        "organizations",
        sa.Column("wallet_recharge_amount", sa.Numeric(10, 2), nullable=False, server_default="50.00")
    )
    op.add_column(
        "organizations",
        sa.Column("wallet_recharge_threshold", sa.Numeric(10, 2), nullable=False, server_default="10.00")
    )
    op.add_column(
        "organizations",
        sa.Column("stripe_customer_id", sa.String(255), nullable=True)
    )
    op.add_column(
        "organizations",
        sa.Column("subscription_status", sa.String(50), nullable=False, server_default="active")
    )

    # Create indexes (skip if SQLite has issues)
    try:
        op.create_index(
            "ix_organizations_parent_organization_id",
            "organizations",
            ["parent_organization_id"]
        )
    except Exception:
        pass  # Index may already exist or not supported

    try:
        op.create_index(
            "ix_organizations_custom_domain",
            "organizations",
            ["custom_domain"],
            unique=True
        )
    except Exception:
        pass  # Index may already exist or not supported

    # Note: Foreign key constraint skipped for SQLite compatibility
    # In production (PostgreSQL), add this constraint manually:
    # ALTER TABLE organizations ADD CONSTRAINT fk_organizations_parent
    # FOREIGN KEY (parent_organization_id) REFERENCES organizations(organization_id)
    # ON DELETE SET NULL;


def downgrade() -> None:
    # Drop indexes (with error handling for SQLite)
    try:
        op.drop_index("ix_organizations_custom_domain", table_name="organizations")
    except Exception:
        pass
    try:
        op.drop_index("ix_organizations_parent_organization_id", table_name="organizations")
    except Exception:
        pass

    # Drop columns
    op.drop_column("organizations", "subscription_status")
    op.drop_column("organizations", "stripe_customer_id")
    op.drop_column("organizations", "wallet_recharge_threshold")
    op.drop_column("organizations", "wallet_recharge_amount")
    op.drop_column("organizations", "wallet_auto_recharge")
    op.drop_column("organizations", "wallet_balance")
    op.drop_column("organizations", "features")
    op.drop_column("organizations", "branding")
    op.drop_column("organizations", "custom_domain")
    op.drop_column("organizations", "organization_type")
    op.drop_column("organizations", "parent_organization_id")
