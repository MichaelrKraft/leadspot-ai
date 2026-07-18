"""
Daily Insights API Routes

Provides endpoints for the Daily AI Dashboard feature.
Returns hot leads, campaign insights, and AI-synthesized recommendations.
"""

import json
import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.organization import Organization
from app.models.user import User
from app.services.auth_service import get_current_user
from app.services.cache_service import get_cache_service
from app.services.email_insights_service import EmailInsightsService
from app.services.insights_service import InsightsService
from app.services.mautic_client import MauticAuthError, MauticClient

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Response Models
# =============================================================================

class HotLead(BaseModel):
    """Hot lead data model"""
    id: str
    firstname: str = ""
    lastname: str = ""
    email: str = ""
    company: str = ""
    points: int = 0
    last_active: str | None = None


class CampaignInsight(BaseModel):
    """Campaign insight data model"""
    id: str
    name: str
    is_published: bool = False
    date_added: str | None = None
    date_modified: str | None = None


class SummaryStats(BaseModel):
    """CRM summary statistics"""
    total_contacts: int = 0
    total_emails: int = 0
    total_campaigns: int = 0
    total_segments: int = 0


class DailyInsightsResponse(BaseModel):
    """Complete daily insights response"""
    hot_leads: list[HotLead] = Field(default_factory=list)
    recent_contacts: list[HotLead] = Field(default_factory=list)
    stats: SummaryStats
    campaigns: list[CampaignInsight] = Field(default_factory=list)
    ai_insights: str = ""
    generated_at: str = Field(default_factory=lambda: datetime.utcnow().isoformat())
    mautic_connected: bool = True


# =============================================================================
# Helper Functions (Mautic — used by /insights/hot-leads and /insights/stats only)
# =============================================================================

async def get_mautic_client(
    mautic_url: str,
    organization_id: str | None,
    session: AsyncSession,
) -> MauticClient | None:
    """
    Get a MauticClient for the request.

    Tries organization_id first, then falls back to mautic_url lookup.
    """
    # Try by organization_id first
    if organization_id:
        try:
            return await MauticClient.from_organization(organization_id, session)
        except MauticAuthError:
            pass

    # Try by mautic_url
    if mautic_url:
        result = await session.execute(
            select(Organization).where(
                Organization.mautic_url == mautic_url.rstrip("/")
            )
        )
        org = result.scalar_one_or_none()

        if org and org.mautic_access_token:
            try:
                return await MauticClient.from_organization(
                    org.organization_id,
                    session,
                )
            except MauticAuthError:
                pass

    return None


# =============================================================================
# API Endpoints
# =============================================================================

def _seconds_until_midnight_utc() -> int:
    """Compute seconds remaining until midnight UTC."""
    now = datetime.utcnow()
    return 86400 - (now.hour * 3600 + now.minute * 60 + now.second)


@router.get("/insights/daily", response_model=DailyInsightsResponse)
async def get_daily_insights(
    current_user: User = Depends(get_current_user),
    session: AsyncSession = Depends(get_db),
):
    """
    Get daily insights for the AI Dashboard.

    Derived from the authenticated user's synced email activity
    (Unified Inbox) rather than Mautic. Returns hot leads (contacts
    awaiting a reply), recent contacts, summary stats, and an
    AI-synthesized recommendation.

    **Returns:**
    Complete daily insights data including:
    - Top 5 hot leads (contacts with the most recent unreplied inbound activity)
    - 5 most recently active contacts
    - CRM summary statistics
    - AI-generated recommendations
    """
    org_id = str(current_user.organization_id)
    cache_date = datetime.utcnow().strftime("%Y-%m-%d")
    cache_key = f"daily_insights:{org_id}:{cache_date}"

    # --- Redis cache check ---
    try:
        cache = await get_cache_service()
        cached_raw = await cache.redis_client.get(cache_key) if cache.redis_client else None
        if cached_raw:
            logger.debug(f"Cache hit for {cache_key}")
            cached_data = json.loads(cached_raw)
            return DailyInsightsResponse(**cached_data)
    except Exception as cache_err:
        logger.warning(f"Cache read error (continuing without cache): {cache_err}")

    try:
        service = EmailInsightsService(session, org_id)
        insights = await service.get_daily_insights()

        response = DailyInsightsResponse(
            hot_leads=[HotLead(**lead) for lead in insights["hot_leads"]],
            recent_contacts=[HotLead(**contact) for contact in insights["recent_contacts"]],
            stats=SummaryStats(**insights["stats"]),
            campaigns=[],
            ai_insights=insights["ai_insights"],
            generated_at=insights["generated_at"],
            mautic_connected=True,
        )

        # --- Store in Redis cache with TTL until midnight UTC ---
        try:
            cache = await get_cache_service()
            if cache.redis_client:
                ttl = _seconds_until_midnight_utc()
                await cache.redis_client.setex(
                    cache_key,
                    max(ttl, 60),  # at least 60s to avoid negative/zero TTL near midnight
                    json.dumps(response.model_dump(), default=str),
                )
                logger.debug(f"Cached {cache_key} for {ttl}s")
        except Exception as cache_err:
            logger.warning(f"Cache write error (result still returned): {cache_err}")

        return response

    except Exception as e:
        logger.exception(f"Error generating daily insights: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Failed to generate insights: {e!s}"
        )


@router.get("/insights/hot-leads")
async def get_hot_leads(
    mautic_url: str = Query(..., description="Mautic instance URL"),
    organization_id: str | None = Query(None, description="Organization ID"),
    limit: int = Query(5, ge=1, le=20, description="Max leads to return"),
    session: AsyncSession = Depends(get_db),
):
    """
    Get hot leads sorted by engagement score.

    **Parameters:**
    - `mautic_url`: The Mautic instance URL (required)
    - `organization_id`: Optional organization ID
    - `limit`: Maximum number of leads (1-20, default 5)
    """
    mautic_client = await get_mautic_client(mautic_url, organization_id, session)

    if not mautic_client:
        raise HTTPException(status_code=404, detail="Mautic not connected")

    service = InsightsService(mautic_client)
    hot_leads = await service.get_hot_leads(limit=limit)

    return {
        "hot_leads": hot_leads,
        "count": len(hot_leads),
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.get("/insights/stats")
async def get_crm_stats(
    mautic_url: str = Query(..., description="Mautic instance URL"),
    organization_id: str | None = Query(None, description="Organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """
    Get CRM summary statistics.

    **Parameters:**
    - `mautic_url`: The Mautic instance URL (required)
    - `organization_id`: Optional organization ID
    """
    mautic_client = await get_mautic_client(mautic_url, organization_id, session)

    if not mautic_client:
        raise HTTPException(status_code=404, detail="Mautic not connected")

    service = InsightsService(mautic_client)
    stats = await service.get_summary_stats()

    return {
        "stats": stats,
        "generated_at": datetime.utcnow().isoformat(),
    }
