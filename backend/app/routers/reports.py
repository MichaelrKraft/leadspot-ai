"""
Reports router — summary analytics endpoint
"""

import logging
from typing import List, Optional

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.campaign import Campaign
from app.models.deal import Deal
from app.models.segment import Segment
from app.models.user import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class CampaignPerformance(BaseModel):
    name: str
    leads: int
    opened: int
    replied: int
    open_rate: float


class TopSegment(BaseModel):
    name: str
    contacts: int


class ReportsSummary(BaseModel):
    total_contacts: int
    active_campaigns: int
    total_deals: int
    pipeline_value: float
    campaigns_performance: List[CampaignPerformance]
    top_segments: List[TopSegment]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------

@router.get("/reports/summary", response_model=ReportsSummary, tags=["reports"])
async def get_reports_summary(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> ReportsSummary:
    """Return aggregated summary stats for the Reports page."""
    user_id = str(current_user.id)
    org_id = str(current_user.organization_id)

    # --- total_contacts: count contacts via raw SQL (Mautic-backed, table may not exist) ---
    total_contacts = 0
    try:
        result = await db.execute(
            text("SELECT COUNT(*) FROM contacts WHERE user_id = :uid"),
            {"uid": user_id},
        )
        total_contacts = result.scalar() or 0
    except Exception:
        total_contacts = 0

    # --- active_campaigns ---
    active_campaigns = 0
    try:
        result = await db.execute(
            select(func.count(Campaign.id)).where(
                Campaign.user_id == user_id,
                Campaign.status == "Active",
            )
        )
        active_campaigns = result.scalar() or 0
    except Exception:
        active_campaigns = 0

    # --- total_deals + pipeline_value ---
    total_deals = 0
    pipeline_value = 0.0
    try:
        result = await db.execute(
            select(func.count(Deal.id), func.coalesce(func.sum(Deal.value), 0.0)).where(
                Deal.org_id == org_id
            )
        )
        row = result.one()
        total_deals = row[0] or 0
        pipeline_value = float(row[1] or 0.0)
    except Exception:
        total_deals = 0
        pipeline_value = 0.0

    # --- campaigns_performance: all campaigns for user ---
    campaigns_performance: List[CampaignPerformance] = []
    try:
        result = await db.execute(
            select(Campaign).where(Campaign.user_id == user_id)
        )
        campaigns = result.scalars().all()
        for c in campaigns:
            open_rate = round(c.opened / c.leads * 100, 1) if c.leads > 0 else 0.0
            campaigns_performance.append(
                CampaignPerformance(
                    name=c.name,
                    leads=c.leads,
                    opened=c.opened,
                    replied=c.replied,
                    open_rate=open_rate,
                )
            )
    except Exception:
        campaigns_performance = []

    # --- top_segments ---
    top_segments: List[TopSegment] = []
    try:
        result = await db.execute(
            select(Segment)
            .where(Segment.user_id == user_id)
            .order_by(Segment.contact_count.desc())
            .limit(5)
        )
        segments = result.scalars().all()
        top_segments = [
            TopSegment(name=s.name, contacts=s.contact_count) for s in segments
        ]
    except Exception:
        top_segments = []

    return ReportsSummary(
        total_contacts=total_contacts,
        active_campaigns=active_campaigns,
        total_deals=total_deals,
        pipeline_value=pipeline_value,
        campaigns_performance=campaigns_performance,
        top_segments=top_segments,
    )
