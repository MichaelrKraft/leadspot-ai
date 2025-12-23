"""
Super Admin API Router

Provides cross-organization administrative endpoints for platform owners:
- Overview of all organizations
- Global usage statistics
- Cross-tenant monitoring
- Platform-wide analytics

Requires: SUPER_ADMIN role (platform owner)
"""

from datetime import datetime, timedelta
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from pydantic import BaseModel
from sqlalchemy import and_, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import get_current_user
from app.models.audit_log import AuditLog
from app.models.document import Document
from app.models.organization import Organization
from app.models.user import User

router = APIRouter(prefix="/api/superadmin", tags=["superadmin"])


# ============================================================================
# Pydantic Models
# ============================================================================

class OrganizationSummary(BaseModel):
    """Summary of an organization."""
    organization_id: str
    name: str
    domain: str
    subscription_tier: str
    user_count: int
    document_count: int
    total_queries: int
    last_activity: datetime | None
    created_at: datetime
    is_active: bool


class PlatformStats(BaseModel):
    """Platform-wide statistics."""
    total_organizations: int
    total_users: int
    total_documents: int
    total_queries: int
    active_orgs_today: int
    active_users_today: int
    new_orgs_this_week: int
    new_users_this_week: int
    storage_used_mb: float


class OrganizationActivity(BaseModel):
    """Activity for a single organization."""
    organization_id: str
    organization_name: str
    queries_count: int
    documents_added: int
    active_users: int
    date: str


class SuperAdminDashboard(BaseModel):
    """Complete super admin dashboard data."""
    platform_stats: PlatformStats
    organizations: list[OrganizationSummary]
    recent_activity: list[OrganizationActivity]
    ai_provider_status: dict


# ============================================================================
# Permission Check
# ============================================================================

def require_superadmin(current_user: dict):
    """Check if user is a super admin (platform owner)."""
    # Super admin can be determined by:
    # 1. A special 'superadmin' role
    # 2. Being in a specific 'platform' organization
    # 3. Having an environment-configured email

    import os
    superadmin_emails = os.getenv("SUPERADMIN_EMAILS", "").split(",")
    superadmin_emails = [e.strip().lower() for e in superadmin_emails if e.strip()]

    user_email = current_user.get("email", "").lower()
    user_role = current_user.get("role", "")

    # Allow if email is in superadmin list or role is 'superadmin'
    if user_email in superadmin_emails or user_role == "superadmin":
        return True

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Super admin access required. Contact platform administrator."
    )


# ============================================================================
# Endpoints
# ============================================================================

@router.get("/dashboard", response_model=SuperAdminDashboard)
async def get_superadmin_dashboard(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get complete super admin dashboard data.

    Requires: Super admin role
    """
    require_superadmin(current_user)

    # Get platform stats
    platform_stats = await _get_platform_stats(db)

    # Get all organizations with stats
    organizations = await _get_organizations_summary(db)

    # Get recent activity
    recent_activity = await _get_recent_activity(db, days=7)

    # Get AI provider status
    ai_status = await _get_ai_provider_status()

    return SuperAdminDashboard(
        platform_stats=platform_stats,
        organizations=organizations,
        recent_activity=recent_activity,
        ai_provider_status=ai_status
    )


@router.get("/stats", response_model=PlatformStats)
async def get_platform_stats(
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get platform-wide statistics.

    Requires: Super admin role
    """
    require_superadmin(current_user)
    return await _get_platform_stats(db)


@router.get("/organizations", response_model=list[OrganizationSummary])
async def list_all_organizations(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    search: str | None = None,
    tier: str | None = None,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    List all organizations on the platform.

    Requires: Super admin role
    """
    require_superadmin(current_user)
    return await _get_organizations_summary(db, skip=skip, limit=limit, search=search, tier=tier)


@router.get("/organizations/{org_id}")
async def get_organization_detail(
    org_id: UUID,
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get detailed information for a specific organization.

    Requires: Super admin role
    """
    require_superadmin(current_user)

    # Get organization
    result = await db.execute(
        select(Organization).where(Organization.organization_id == org_id)
    )
    org = result.scalar_one_or_none()

    if not org:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Organization not found"
        )

    # Get users
    users_result = await db.execute(
        select(User).where(User.organization_id == org_id)
    )
    users = users_result.scalars().all()

    # Get documents count
    docs_result = await db.execute(
        select(func.count(Document.document_id)).where(Document.organization_id == org_id)
    )
    doc_count = docs_result.scalar() or 0

    # Get recent activity
    activity_result = await db.execute(
        select(AuditLog)
        .where(AuditLog.organization_id == org_id)
        .order_by(AuditLog.timestamp.desc())
        .limit(20)
    )
    recent_activity = activity_result.scalars().all()

    return {
        "organization": {
            "id": str(org.organization_id),
            "name": org.name,
            "domain": org.domain,
            "subscription_tier": org.subscription_tier,
            "created_at": org.created_at.isoformat() if org.created_at else None,
            "is_active": org.is_active
        },
        "users": [
            {
                "id": str(u.user_id),
                "email": u.email,
                "name": u.name,
                "role": u.role,
                "is_active": u.is_active,
                "last_login": u.last_login.isoformat() if u.last_login else None
            }
            for u in users
        ],
        "document_count": doc_count,
        "recent_activity": [
            {
                "action": a.action,
                "resource_type": a.resource_type,
                "timestamp": a.timestamp.isoformat() if a.timestamp else None,
                "status": a.status
            }
            for a in recent_activity
        ]
    }


@router.get("/activity", response_model=list[OrganizationActivity])
async def get_platform_activity(
    days: int = Query(7, ge=1, le=90),
    current_user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Get platform-wide activity for the past N days.

    Requires: Super admin role
    """
    require_superadmin(current_user)
    return await _get_recent_activity(db, days=days)


@router.get("/ai-status")
async def get_ai_status(
    current_user: dict = Depends(get_current_user),
):
    """
    Get status of AI providers (embeddings and synthesis).

    Requires: Super admin role
    """
    require_superadmin(current_user)
    return await _get_ai_provider_status()


# ============================================================================
# Helper Functions
# ============================================================================

async def _get_platform_stats(db: AsyncSession) -> PlatformStats:
    """Get platform-wide statistics."""
    now = datetime.utcnow()
    today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    week_ago = today - timedelta(days=7)

    # Total organizations
    org_count = await db.execute(select(func.count(Organization.organization_id)))
    total_orgs = org_count.scalar() or 0

    # Total users
    user_count = await db.execute(select(func.count(User.user_id)))
    total_users = user_count.scalar() or 0

    # Total documents
    doc_count = await db.execute(select(func.count(Document.document_id)))
    total_docs = doc_count.scalar() or 0

    # Active orgs today (have audit logs)
    active_orgs = await db.execute(
        select(func.count(func.distinct(AuditLog.organization_id)))
        .where(AuditLog.timestamp >= today)
    )
    active_orgs_today = active_orgs.scalar() or 0

    # Active users today
    active_users = await db.execute(
        select(func.count(func.distinct(AuditLog.user_id)))
        .where(AuditLog.timestamp >= today)
    )
    active_users_today = active_users.scalar() or 0

    # New orgs this week
    new_orgs = await db.execute(
        select(func.count(Organization.organization_id))
        .where(Organization.created_at >= week_ago)
    )
    new_orgs_week = new_orgs.scalar() or 0

    # New users this week
    new_users = await db.execute(
        select(func.count(User.user_id))
        .where(User.created_at >= week_ago)
    )
    new_users_week = new_users.scalar() or 0

    # Total queries (from audit logs)
    query_count = await db.execute(
        select(func.count(AuditLog.id))
        .where(AuditLog.action.like("query.%"))
    )
    total_queries = query_count.scalar() or 0

    return PlatformStats(
        total_organizations=total_orgs,
        total_users=total_users,
        total_documents=total_docs,
        total_queries=total_queries,
        active_orgs_today=active_orgs_today,
        active_users_today=active_users_today,
        new_orgs_this_week=new_orgs_week,
        new_users_this_week=new_users_week,
        storage_used_mb=0.0  # Would need to calculate from document sizes
    )


async def _get_organizations_summary(
    db: AsyncSession,
    skip: int = 0,
    limit: int = 100,
    search: str | None = None,
    tier: str | None = None
) -> list[OrganizationSummary]:
    """Get summary of all organizations."""
    query = select(Organization)

    if search:
        query = query.where(
            Organization.name.ilike(f"%{search}%") |
            Organization.domain.ilike(f"%{search}%")
        )

    if tier:
        query = query.where(Organization.subscription_tier == tier)

    query = query.offset(skip).limit(limit).order_by(Organization.created_at.desc())

    result = await db.execute(query)
    orgs = result.scalars().all()

    summaries = []
    for org in orgs:
        # Get user count
        user_count = await db.execute(
            select(func.count(User.user_id))
            .where(User.organization_id == org.organization_id)
        )
        users = user_count.scalar() or 0

        # Get document count
        doc_count = await db.execute(
            select(func.count(Document.document_id))
            .where(Document.organization_id == org.organization_id)
        )
        docs = doc_count.scalar() or 0

        # Get query count
        query_count = await db.execute(
            select(func.count(AuditLog.id))
            .where(
                and_(
                    AuditLog.organization_id == org.organization_id,
                    AuditLog.action.like("query.%")
                )
            )
        )
        queries = query_count.scalar() or 0

        # Get last activity
        last_activity_result = await db.execute(
            select(AuditLog.timestamp)
            .where(AuditLog.organization_id == org.organization_id)
            .order_by(AuditLog.timestamp.desc())
            .limit(1)
        )
        last_activity = last_activity_result.scalar_one_or_none()

        summaries.append(OrganizationSummary(
            organization_id=str(org.organization_id),
            name=org.name,
            domain=org.domain,
            subscription_tier=org.subscription_tier or "free",
            user_count=users,
            document_count=docs,
            total_queries=queries,
            last_activity=last_activity,
            created_at=org.created_at,
            is_active=org.is_active if hasattr(org, 'is_active') else True
        ))

    return summaries


async def _get_recent_activity(db: AsyncSession, days: int = 7) -> list[OrganizationActivity]:
    """Get recent activity across all organizations."""
    cutoff = datetime.utcnow() - timedelta(days=days)

    # Get activity grouped by organization and date
    # This is simplified - in production you'd want proper date grouping
    result = await db.execute(
        select(
            AuditLog.organization_id,
            Organization.name,
            func.count(AuditLog.id).label('activity_count')
        )
        .join(Organization, AuditLog.organization_id == Organization.organization_id)
        .where(AuditLog.timestamp >= cutoff)
        .group_by(AuditLog.organization_id, Organization.name)
        .order_by(func.count(AuditLog.id).desc())
        .limit(20)
    )

    rows = result.all()

    return [
        OrganizationActivity(
            organization_id=str(row[0]),
            organization_name=row[1],
            queries_count=row[2],
            documents_added=0,  # Would need separate query
            active_users=0,  # Would need separate query
            date=datetime.utcnow().strftime("%Y-%m-%d")
        )
        for row in rows
    ]


async def _get_ai_provider_status() -> dict:
    """Get status of AI providers."""
    from app.services.embedding_service import get_provider_info as get_embedding_info
    from app.services.synthesis_service import get_provider_info as get_synthesis_info

    try:
        embedding_info = get_embedding_info()
    except Exception as e:
        embedding_info = {"error": str(e)}

    try:
        synthesis_info = get_synthesis_info()
    except Exception as e:
        synthesis_info = {"error": str(e)}

    # Check Ollama status
    try:
        import asyncio

        from app.services import ollama_service
        ollama_available = asyncio.get_event_loop().run_until_complete(
            ollama_service.is_available()
        )
    except Exception:
        ollama_available = False

    return {
        "embedding": embedding_info,
        "synthesis": synthesis_info,
        "ollama_available": ollama_available,
        "status": "healthy" if embedding_info and synthesis_info else "degraded"
    }
