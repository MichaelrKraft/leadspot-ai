"""
Anthropic client resolution for inference services.

Prefers the organization's own key (BYOK, Settings -> API Keys) and falls
back to the global ANTHROPIC_API_KEY. Returns None when neither is set —
callers skip inference rather than fail the pipeline.
"""

import logging

import anthropic
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.claude_service import _get_api_key

logger = logging.getLogger(__name__)


async def get_anthropic_client(
    db: AsyncSession, org_id: str
) -> anthropic.AsyncAnthropic | None:
    from app.models.organization import Organization

    org = (
        await db.execute(
            select(Organization).where(Organization.organization_id == org_id)
        )
    ).scalar_one_or_none()

    api_key = (org.anthropic_api_key if org else None) or _get_api_key()
    if not api_key:
        return None
    return anthropic.AsyncAnthropic(api_key=api_key)
