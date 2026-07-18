"""
Deal suggestions router — list / accept / reject AI-proposed stage changes.
"""

from datetime import datetime
from typing import Optional

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
from app.services.inference.manual_ingest import ingest_manual_email

router = APIRouter()


class AnalyzeEmailRequest(BaseModel):
    body: str
    subject: str | None = None
    from_address: str | None = None


class AnalyzeEmailResponse(BaseModel):
    message_id: str
    outcome: str  # suggestion_created | no_change
    suggestion: Optional["SuggestionResponse"] = None


class SuggestionSource(BaseModel):
    subject: str | None = None
    from_address: str | None = None
    body_preview: str | None = None
    received_at: datetime | None = None


class SuggestionResponse(BaseModel):
    id: str
    deal_id: str
    deal_title: str | None
    property_name: str | None
    current_stage: str
    suggested_stage: str
    confidence: int
    evidence: str | None
    source_type: str
    source: SuggestionSource | None
    status: str
    created_at: datetime


AnalyzeEmailResponse.model_rebuild()


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


@router.post("/deals/suggestions/analyze", tags=["deal-suggestions"])
async def analyze_email(
    data: AnalyzeEmailRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
) -> AnalyzeEmailResponse:
    """Analyze a pasted/forwarded message against open leasing deals.

    Stores it as a manual email_message, runs deal-status inference, and
    returns the created suggestion (if any). The suggestion still requires
    human accept/reject — this never moves a deal by itself.
    """
    if not data.body.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Email body is required",
        )

    message, suggestion = await ingest_manual_email(
        db,
        str(current_user.organization_id),
        body=data.body,
        subject=data.subject,
        from_address=data.from_address,
    )

    return AnalyzeEmailResponse(
        message_id=message.id,
        outcome="suggestion_created" if suggestion else "no_change",
        suggestion=await _to_response(suggestion, db) if suggestion else None,
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
    suggestions: list[DealSuggestion] = result.scalars().all()
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
