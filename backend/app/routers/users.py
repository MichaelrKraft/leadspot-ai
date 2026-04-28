"""Users router — self-service profile fields.

Mounted at prefix `/api`.

PATCH /users/me/timezone — set the IANA timezone string used by the
Ghostlog morning-digest scheduler.

Why a dedicated router (vs adding to auth.py): /auth/me returns the user
object but auth.py is otherwise about session lifecycle. Profile mutations
are a separate concern; keeping them here makes the router boundaries
clean.
"""

import logging
from typing import Annotated
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)


router = APIRouter()


# =============================================================================
# Schemas
# =============================================================================

class TimezoneUpdateRequest(BaseModel):
    timezone: Annotated[str, Field(min_length=1, max_length=64)]


class TimezoneUpdateResponse(BaseModel):
    timezone: str


# =============================================================================
# Endpoints
# =============================================================================

@router.patch("/users/me/timezone", response_model=TimezoneUpdateResponse)
async def update_my_timezone(
    body: TimezoneUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update the current user's IANA timezone string.

    Validates the TZ name with stdlib `zoneinfo` so we don't accidentally
    persist a typo that would later silently fall back to UTC in the digest
    scheduler.
    """
    tz_name = body.timezone.strip()
    try:
        ZoneInfo(tz_name)
    except ZoneInfoNotFoundError:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unknown IANA timezone: {tz_name}",
        ) from None

    current_user.timezone = tz_name
    await db.commit()
    await db.refresh(current_user)

    return TimezoneUpdateResponse(timezone=current_user.timezone)
