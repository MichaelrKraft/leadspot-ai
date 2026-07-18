"""
Manual email ingestion — the production path for feeding a single message
(forwarded email, voicemail transcript, meeting note) into deal-status
inference without a mailbox sync. Used by the analyze endpoint and the
Command Center's analyze_email tool.
"""

import logging
import uuid
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.deal_suggestion import DealSuggestion
from app.models.email_message import EmailMessage
from app.services.inference.deal_status_agent import analyze_source_for_deal_status

logger = logging.getLogger(__name__)


async def ingest_manual_email(
    db: AsyncSession,
    org_id: str,
    body: str,
    subject: str | None = None,
    from_address: str | None = None,
    client=None,
) -> tuple[EmailMessage, DealSuggestion | None]:
    """Store a manually provided message and run deal-status inference on it.

    Returns (message, suggestion). suggestion is None when no open leasing
    deal matched or no stage change was implied.
    """
    now = datetime.utcnow()
    message = EmailMessage(
        org_id=org_id,
        provider="manual",
        provider_message_id=f"manual-{uuid.uuid4()}",
        from_address=from_address or "manual@entry",
        to_addresses=None,
        subject=subject,
        body_preview=body[:4000],
        received_at=now,
        analyzed_at=now,
    )
    db.add(message)
    await db.flush()

    # Same text shape the Outlook sync feeds the agent
    text = f"From: {message.from_address}\nSubject: {message.subject or ''}\n\n{body}"
    suggestion = await analyze_source_for_deal_status(
        db, org_id, "email", message.id, text, client=client
    )

    if suggestion and suggestion.deal_id:
        message.deal_id = suggestion.deal_id
    await db.commit()
    await db.refresh(message)
    return message, suggestion
