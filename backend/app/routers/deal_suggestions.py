"""
Deal suggestions router — list / accept / reject AI-proposed stage changes.
"""

from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.deal import Deal
from app.models.deal_suggestion import DealSuggestion
from app.models.email_message import EmailMessage
from app.models.user import User
from app.services.auth_service import get_current_user

router = APIRouter()


class SuggestionSource(BaseModel):
    subject: Optional[str] = None
    from_address: Optional[str] = None
    body_preview: Optional[str] = None
    received_at: Optional[datetime] = None


class SuggestionResponse(BaseModel):
    id: str
    deal_id: str
    deal_title: Optional[str]
    property_name: Optional[str]
    current_stage: str
    suggested_stage: str
    confidence: int
    evidence: Optional[str]
    source_type: str
    source: Optional[SuggestionSource]
    status: str
    created_at: datetime


async def _get_suggestion(
    suggestion_id: str, org_id: str, db: AsyncSession
) -> DealSuggestion:
    result = await db.execute(
        select(DealSuggestion).where(
            DealSuggestion.id == suggestion_id,
            DealSuggestion.org_id == org_id,
        )
    )
    suggestion = result.scalar_one_or_none()
    if not suggestion:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Suggestion not found")
    return suggestion


async def _to_response(s: DealSuggestion, db: AsyncSession) -> SuggestionResponse:
    deal = (
        await db.execute(select(Deal).where(Deal.id == s.deal_id))
    ).scalar_one_or_none()

    source = None
    if s.source_type == "email":
        msg = (
            await db.execute(select(EmailMessage).where(EmailMessage.id == s.source_id))
        ).scalar_one_or_none()
        if msg:
            source = SuggestionSource(
                subject=msg.subject,
                from_address=msg.from_address,
                body_preview=msg.body_preview,
                received_at=msg.received_at,
            )

    return SuggestionResponse(
        id=s.id,
        deal_id=s.deal_id,
        deal_title=deal.title if deal else None,
        property_name=deal.property_name if deal else None,
        current_stage=s.current_stage,
        suggested_stage=s.suggested_stage,
        confidence=s.confidence,
        evidence=s.evidence,
        source_type=s.source_type,
        source=source,
        status=s.status,
        created_at=s.created_at,
    )


@router.get("/deals/suggestions", tags=["deal-suggestions"])
async def list_suggestions(
    status_filter: str = "pending",
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """List deal suggestions for the org, newest first."""
    result = await db.execute(
        select(DealSuggestion)
        .where(
            DealSuggestion.org_id == str(current_user.organization_id),
            DealSuggestion.status == status_filter,
        )
        .order_by(DealSuggestion.created_at.desc())
    )
    suggestions: List[DealSuggestion] = result.scalars().all()
    return {"suggestions": [await _to_response(s, db) for s in suggestions]}


@router.post("/deals/suggestions/{suggestion_id}/accept", tags=["deal-suggestions"])
async def accept_suggestion(
    suggestion_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuggestionResponse:
    """Accept a suggestion: move the deal to the suggested stage."""
    suggestion = await _get_suggestion(suggestion_id, str(current_user.organization_id), db)
    if suggestion.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Suggestion already {suggestion.status}",
        )

    deal = (
        await db.execute(
            select(Deal).where(
                Deal.id == suggestion.deal_id,
                Deal.org_id == str(current_user.organization_id),
            )
        )
    ).scalar_one_or_none()
    if not deal:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Deal not found")

    deal.stage = suggestion.suggested_stage
    deal.stage_changed_at = datetime.utcnow()
    deal.updated_at = datetime.utcnow()

    suggestion.status = "accepted"
    suggestion.resolved_at = datetime.utcnow()
    suggestion.resolved_by = str(current_user.user_id)

    await db.commit()
    await db.refresh(suggestion)
    return await _to_response(suggestion, db)


@router.post("/deals/suggestions/{suggestion_id}/reject", tags=["deal-suggestions"])
async def reject_suggestion(
    suggestion_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> SuggestionResponse:
    """Reject a suggestion: leave the deal untouched."""
    suggestion = await _get_suggestion(suggestion_id, str(current_user.organization_id), db)
    if suggestion.status != "pending":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Suggestion already {suggestion.status}",
        )

    suggestion.status = "rejected"
    suggestion.resolved_at = datetime.utcnow()
    suggestion.resolved_by = str(current_user.user_id)

    await db.commit()
    await db.refresh(suggestion)
    return await _to_response(suggestion, db)
