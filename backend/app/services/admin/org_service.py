"""
Organization Administration Service

Handles organization management operations:
- Get organization details
- Update organization settings
- Manage subscription tiers
- Track usage limits
"""

import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.document import Document
from app.models.organization import Organization
from app.models.query import Query
from app.models.user import User
from app.schemas.admin import OrganizationUpdate, UsageStats


class OrganizationAdminService:
    """Service for administrative organization management operations"""

    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_organization(
        self,
        organization_id: uuid.UUID
    ) -> Organization | None:
        """
        Get organization by ID.

        Args:
            organization_id: Organization ID

        Returns:
            Organization object or None if not found
        """
        result = await self.db.execute(
            select(Organization).where(
                Organization.organization_id == organization_id
            )
        )
        return result.scalar_one_or_none()

    async def update_organization(
        self,
        organization_id: uuid.UUID,
        org_data: OrganizationUpdate
    ) -> Organization | None:
        """
        Update organization settings.

        Args:
            organization_id: Organization ID to update
            org_data: Updated organization data

        Returns:
            Updated organization or None if not found
        """
        # Build update dict (only include provided fields)
        update_data = {}
        if org_data.name is not None:
            update_data["name"] = org_data.name
        if org_data.domain is not None:
            # Check domain uniqueness
            existing = await self.db.execute(
                select(Organization).where(
                    Organization.domain == org_data.domain,
                    Organization.organization_id != organization_id
                )
            )
            if existing.scalar_one_or_none():
                raise ValueError(f"Domain {org_data.domain} already in use")
            update_data["domain"] = org_data.domain
        if org_data.subscription_tier is not None:
            update_data["subscription_tier"] = org_data.subscription_tier

        # Apply updates
        if update_data:
            await self.db.execute(
                update(Organization)
                .where(Organization.organization_id == organization_id)
                .values(**update_data)
            )

        # Return updated organization
        return await self.get_organization(organization_id)

    async def get_usage_statistics(
        self,
        organization_id: uuid.UUID,
        days: int = 30
    ) -> UsageStats:
        """
        Get usage statistics for an organization.

        Args:
            organization_id: Organization ID
            days: Number of days to look back for usage stats

        Returns:
            UsageStats object with comprehensive metrics
        """
        cutoff_date = datetime.utcnow() - timedelta(days=days)

        # Get user count
        user_count_result = await self.db.execute(
            select(func.count(User.user_id))
            .where(User.organization_id == organization_id)
        )
        user_count = user_count_result.scalar() or 0

        # Get document count
        doc_count_result = await self.db.execute(
            select(func.count(Document.document_id))
            .where(Document.organization_id == organization_id)
        )
        document_count = doc_count_result.scalar() or 0

        # Get query count (total)
        total_queries_result = await self.db.execute(
            select(func.count(Query.query_id))
            .where(Query.organization_id == organization_id)
        )
        total_queries = total_queries_result.scalar() or 0

        # Get recent query count
        recent_queries_result = await self.db.execute(
            select(func.count(Query.query_id))
            .where(
                Query.organization_id == organization_id,
                Query.created_at >= cutoff_date
            )
        )
        recent_queries = recent_queries_result.scalar() or 0

        # Get storage usage (estimate based on document count)
        # In production, calculate actual storage from document sizes
        storage_bytes = document_count * 1024 * 1024  # Estimate 1MB per doc

        # Get active users (users who made queries recently)
        active_users_result = await self.db.execute(
            select(func.count(func.distinct(Query.user_id)))
            .where(
                Query.organization_id == organization_id,
                Query.created_at >= cutoff_date
            )
        )
        active_users = active_users_result.scalar() or 0

        # Calculate average queries per active user
        avg_queries_per_user = (
            recent_queries / active_users if active_users > 0 else 0
        )

        return UsageStats(
            organization_id=organization_id,
            period_days=days,
            total_users=user_count,
            active_users=active_users,
            total_documents=document_count,
            total_queries=total_queries,
            queries_last_period=recent_queries,
            storage_bytes=storage_bytes,
            avg_queries_per_user=round(avg_queries_per_user, 2),
            calculated_at=datetime.utcnow()
        )

    async def get_subscription_limits(
        self,
        organization_id: uuid.UUID
    ) -> dict[str, Any]:
        """
        Get subscription tier limits for an organization.

        Args:
            organization_id: Organization ID

        Returns:
            Dictionary with tier limits and current usage
        """
        org = await self.get_organization(organization_id)
        if not org:
            raise ValueError(f"Organization {organization_id} not found")

        # Define tier limits
        tier_limits = {
            "pilot": {
                "max_users": 10,
                "max_documents": 1000,
                "max_queries_per_month": 10000,
                "storage_gb": 10,
                "features": ["basic_search", "document_upload"]
            },
            "growth": {
                "max_users": 50,
                "max_documents": 10000,
                "max_queries_per_month": 100000,
                "storage_gb": 100,
                "features": ["basic_search", "document_upload", "advanced_analytics", "api_access"]
            },
            "enterprise": {
                "max_users": None,  # Unlimited
                "max_documents": None,
                "max_queries_per_month": None,
                "storage_gb": None,
                "features": [
                    "basic_search",
                    "document_upload",
                    "advanced_analytics",
                    "api_access",
                    "custom_integrations",
                    "dedicated_support",
                    "sso"
                ]
            }
        }

        limits = tier_limits.get(org.subscription_tier, tier_limits["pilot"])

        # Get current usage
        usage = await self.get_usage_statistics(organization_id, days=30)

        return {
            "subscription_tier": org.subscription_tier,
            "limits": limits,
            "current_usage": {
                "users": usage.total_users,
                "documents": usage.total_documents,
                "queries_this_month": usage.queries_last_period,
                "storage_gb": round(usage.storage_bytes / (1024**3), 2)
            },
            "usage_percentage": {
                "users": (
                    (usage.total_users / limits["max_users"] * 100)
                    if limits["max_users"] else 0
                ),
                "documents": (
                    (usage.total_documents / limits["max_documents"] * 100)
                    if limits["max_documents"] else 0
                ),
                "queries": (
                    (usage.queries_last_period / limits["max_queries_per_month"] * 100)
                    if limits["max_queries_per_month"] else 0
                ),
            }
        }

    async def check_usage_limits(
        self,
        organization_id: uuid.UUID,
        check_type: str
    ) -> tuple[bool, str | None]:
        """
        Check if organization is within usage limits.

        Args:
            organization_id: Organization ID
            check_type: Type of limit to check (users, documents, queries)

        Returns:
            Tuple of (is_within_limits, error_message)
        """
        limits_info = await self.get_subscription_limits(organization_id)
        limits = limits_info["limits"]
        usage = limits_info["current_usage"]

        if check_type == "users":
            max_users = limits.get("max_users")
            if max_users and usage["users"] >= max_users:
                return False, f"User limit reached ({max_users}). Please upgrade your plan."

        elif check_type == "documents":
            max_docs = limits.get("max_documents")
            if max_docs and usage["documents"] >= max_docs:
                return False, f"Document limit reached ({max_docs}). Please upgrade your plan."

        elif check_type == "queries":
            max_queries = limits.get("max_queries_per_month")
            if max_queries and usage["queries_this_month"] >= max_queries:
                return False, f"Monthly query limit reached ({max_queries}). Please upgrade your plan."

        return True, None

    async def upgrade_subscription(
        self,
        organization_id: uuid.UUID,
        new_tier: str
    ) -> Organization | None:
        """
        Upgrade organization subscription tier.

        Args:
            organization_id: Organization ID
            new_tier: New subscription tier (pilot, growth, enterprise)

        Returns:
            Updated organization or None if not found
        """
        valid_tiers = ["pilot", "growth", "enterprise"]
        if new_tier not in valid_tiers:
            raise ValueError(f"Invalid tier. Must be one of: {valid_tiers}")

        org_data = OrganizationUpdate(subscription_tier=new_tier)
        return await self.update_organization(organization_id, org_data)
