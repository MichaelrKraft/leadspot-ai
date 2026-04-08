"""Email suppression list API endpoints"""
import logging
from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException
from typing import Optional
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.models.suppression import EmailSuppression

logger = logging.getLogger(__name__)
router = APIRouter()


class SuppressionCreate(BaseModel):
    email: str
    reason: str  # 'hard_bounce', 'spam_complaint', 'unsubscribed', 'manual'
    source: Optional[str] = None


@router.get("/suppressions/{email}")
async def check_suppression(email: str, db: AsyncSession = Depends(get_db)):
    """Check if an email is suppressed. Returns suppression record or 404."""
    result = await db.execute(
        select(EmailSuppression).where(EmailSuppression.email == email.lower().strip())
    )
    suppression = result.scalar_one_or_none()
    if not suppression:
        raise HTTPException(status_code=404, detail="Email not suppressed")
    return {
        "email": suppression.email,
        "reason": suppression.reason,
        "source": suppression.source,
        "suppressed_at": suppression.suppressed_at.isoformat() if suppression.suppressed_at else None,
    }


@router.post("/suppressions")
async def add_suppression(data: SuppressionCreate, db: AsyncSession = Depends(get_db)):
    """Add an email to the suppression list. Idempotent — updates reason if already exists."""
    email = data.email.lower().strip()
    result = await db.execute(
        select(EmailSuppression).where(EmailSuppression.email == email)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.reason = data.reason
        existing.source = data.source
        existing.suppressed_at = datetime.utcnow()
    else:
        suppression = EmailSuppression(
            email=email,
            reason=data.reason,
            source=data.source,
        )
        db.add(suppression)
    await db.commit()
    return {"status": "suppressed", "email": email}
