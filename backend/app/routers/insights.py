"""
Daily Insights API Routes

Provides endpoints for the Daily AI Dashboard feature.
Returns hot leads, campaign insights, and AI-synthesized recommendations.
"""

import json
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.organization import Organization
from app.services.cache_service import get_cache_service
from app.services.insights_service import InsightsService
from app.services.mautic_client import MauticClient, MauticAuthError

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
    last_active: Optional[str] = None


class CampaignInsight(BaseModel):
    """Campaign insight data model"""
    id: str
    name: str
    is_published: bool = False
    date_added: Optional[str] = None
    date_modified: Optional[str] = None


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
# Helper Functions
# =============================================================================

async def get_mautic_client(
    mautic_url: str,
    organization_id: Optional[str],
    session: AsyncSession,
) -> Optional[MauticClient]:
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
    mautic_url: str = Query(..., description="Mautic instance URL"),
    organization_id: Optional[str] = Query(None, description="Organization ID"),
    session: AsyncSession = Depends(get_db),
    x_space_agent_key: Optional[str] = Header(None, alias="X-Space-Agent-Key"),
    x_space_org_id: Optional[str] = Header(None, alias="X-Space-Org-Id"),
):
    """
    Get daily insights for the AI Dashboard.

    Returns hot leads, recent contacts, campaign insights, summary stats,
    and AI-generated recommendations.

    **Parameters:**
    - `mautic_url`: The Mautic instance URL (required)
    - `organization_id`: Optional organization ID for faster lookup

    **Headers (Space Agent path):**
    - `X-Space-Agent-Key`: Space Agent shared secret (bypasses user auth)
    - `X-Space-Org-Id`: Organization ID supplied by Space Agent

    **Returns:**
    Complete daily insights data including:
    - Top 5 hot leads (by engagement points)
    - 5 most recent contacts
    - CRM summary statistics
    - Recent campaign insights
    - AI-synthesized recommendations
    """
    # Space Agent alternative auth path — validate the shared key
    space_agent_authed = (
        x_space_agent_key
        and settings.SPACE_AGENT_API_KEY
        and x_space_agent_key in (
            settings.SPACE_AGENT_API_KEY,
            settings.SPACE_AGENT_API_KEY_PREVIOUS,
        )
    )

    # Resolve the org_id to use for the cache key (Space Agent may supply via header)
    cache_org_id = x_space_org_id or organization_id or "default"
    cache_date = datetime.utcnow().strftime("%Y-%m-%d")
    cache_key = f"daily_insights:{cache_org_id}:{cache_date}"

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
        # Get Mautic client
        mautic_client = await get_mautic_client(mautic_url, organization_id, session)

        if not mautic_client:
            logger.warning(f"No Mautic connection for URL: {mautic_url}")
            return DailyInsightsResponse(
                stats=SummaryStats(),
                ai_insights="Connect your Mautic CRM to see personalized insights.",
                mautic_connected=False,
            )

        # Generate insights
        service = InsightsService(mautic_client)
        insights = await service.get_daily_insights()

        response = DailyInsightsResponse(
            hot_leads=[HotLead(**lead) for lead in insights["hot_leads"]],
            recent_contacts=[HotLead(**contact) for contact in insights["recent_contacts"]],
            stats=SummaryStats(**insights["stats"]),
            campaigns=[CampaignInsight(**c) for c in insights["campaigns"]],
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
            detail=f"Failed to generate insights: {str(e)}"
        )


@router.get("/insights/hot-leads")
async def get_hot_leads(
    mautic_url: str = Query(..., description="Mautic instance URL"),
    organization_id: Optional[str] = Query(None, description="Organization ID"),
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
    organization_id: Optional[str] = Query(None, description="Organization ID"),
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
