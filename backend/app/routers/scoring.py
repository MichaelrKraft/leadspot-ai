"""
Lead Scoring API Routes

Provides endpoints for calculating and managing lead engagement scores.
"""

import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.organization import Organization
from app.services.lead_scoring_service import LeadScoringService
from app.services.mautic_client import MauticClient, MauticAuthError

logger = logging.getLogger(__name__)

router = APIRouter()


# =============================================================================
# Response Models
# =============================================================================

class ActivityBreakdown(BaseModel):
    """Breakdown of activity scoring"""
    count: int
    points: int


class ScoreResult(BaseModel):
    """Lead score result"""
    contact_id: int
    final_score: int
    base_points: int
    activity_score: int
    recency_multiplier: float
    recency_category: str
    tier: str
    breakdown: dict[str, ActivityBreakdown] = Field(default_factory=dict)
    calculated_at: str


class ScoreAndTagResult(BaseModel):
    """Combined score and tag result"""
    contact_id: int
    final_score: int
    base_points: int
    activity_score: int
    recency_multiplier: float
    recency_category: str
    tier: str
    tag_applied: Optional[str] = None
    tagging_success: bool
    calculated_at: str


class BatchScoreResult(BaseModel):
    """Batch scoring result"""
    total_scored: int
    errors: int
    tier_summary: dict[str, int]


# =============================================================================
# Helper Functions
# =============================================================================

async def get_mautic_client(
    mautic_url: str,
    organization_id: Optional[str],
    session: AsyncSession,
) -> Optional[MauticClient]:
    """Get a MauticClient for the request."""
    if organization_id:
        try:
            return await MauticClient.from_organization(organization_id, session)
        except MauticAuthError:
            pass

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

@router.get("/scoring/calculate/{contact_id}", response_model=ScoreResult)
async def calculate_lead_score(
    contact_id: int,
    mautic_url: str = Query(..., description="Mautic instance URL"),
    organization_id: Optional[str] = Query(None, description="Organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """
    Calculate engagement score for a single contact.

    Analyzes the contact's activity history and combines it with their
    Mautic points to generate a comprehensive engagement score.

    **Parameters:**
    - `contact_id`: Mautic contact ID
    - `mautic_url`: The Mautic instance URL
    - `organization_id`: Optional organization ID

    **Returns:**
    Score breakdown including:
    - Final calculated score
    - Base Mautic points
    - Activity-based score
    - Recency multiplier applied
    - Lead tier (hot/warm/cold)
    """
    mautic_client = await get_mautic_client(mautic_url, organization_id, session)

    if not mautic_client:
        raise HTTPException(status_code=404, detail="Mautic not connected")

    try:
        service = LeadScoringService(mautic_client)
        result = await service.calculate_score(contact_id)
        return ScoreResult(**result)
    except Exception as e:
        logger.exception(f"Error calculating score: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scoring/score-and-tag/{contact_id}", response_model=ScoreAndTagResult)
async def score_and_tag_contact(
    contact_id: int,
    mautic_url: str = Query(..., description="Mautic instance URL"),
    organization_id: Optional[str] = Query(None, description="Organization ID"),
    session: AsyncSession = Depends(get_db),
):
    """
    Calculate score and apply lead tier tag.

    Calculates the engagement score and automatically adds the appropriate
    tag (hot-lead, warm-lead, or cold-lead) to the contact.

    **Parameters:**
    - `contact_id`: Mautic contact ID
    - `mautic_url`: The Mautic instance URL
    - `organization_id`: Optional organization ID
    """
    mautic_client = await get_mautic_client(mautic_url, organization_id, session)

    if not mautic_client:
        raise HTTPException(status_code=404, detail="Mautic not connected")

    try:
        service = LeadScoringService(mautic_client)
        result = await service.score_and_tag(contact_id)
        return ScoreAndTagResult(**result)
    except Exception as e:
        logger.exception(f"Error scoring and tagging: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scoring/batch", response_model=BatchScoreResult)
async def batch_score_contacts(
    mautic_url: str = Query(..., description="Mautic instance URL"),
    organization_id: Optional[str] = Query(None, description="Organization ID"),
    limit: int = Query(50, ge=1, le=200, description="Max contacts to score"),
    auto_tag: bool = Query(True, description="Automatically apply tier tags"),
    session: AsyncSession = Depends(get_db),
):
    """
    Score multiple contacts in batch.

    Processes up to `limit` contacts, calculating their engagement scores
    and optionally applying tier tags.

    **Parameters:**
    - `mautic_url`: The Mautic instance URL
    - `organization_id`: Optional organization ID
    - `limit`: Maximum contacts to process (1-200)
    - `auto_tag`: Whether to apply hot/warm/cold tags

    **Returns:**
    Summary of scoring results including tier distribution.
    """
    mautic_client = await get_mautic_client(mautic_url, organization_id, session)

    if not mautic_client:
        raise HTTPException(status_code=404, detail="Mautic not connected")

    try:
        service = LeadScoringService(mautic_client)
        result = await service.batch_score_contacts(limit=limit, auto_tag=auto_tag)

        return BatchScoreResult(
            total_scored=result["total_scored"],
            errors=result["errors"],
            tier_summary=result["tier_summary"],
        )
    except Exception as e:
        logger.exception(f"Error in batch scoring: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/scoring/thresholds")
async def get_scoring_thresholds():
    """
    Get current scoring configuration.

    Returns the activity scores, page bonuses, and tier thresholds
    used in lead scoring calculations.
    """
    from app.services.lead_scoring_service import (
        ACTIVITY_SCORES,
        PAGE_BONUSES,
        RECENCY_MULTIPLIERS,
        SCORE_THRESHOLDS,
    )

    return {
        "activity_scores": ACTIVITY_SCORES,
        "page_bonuses": PAGE_BONUSES,
        "recency_multipliers": RECENCY_MULTIPLIERS,
        "tier_thresholds": SCORE_THRESHOLDS,
    }
