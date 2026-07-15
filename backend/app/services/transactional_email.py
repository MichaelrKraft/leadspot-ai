"""
Transactional email sender (Resend REST API).

Used for one-off system emails such as password resets. Sends via Resend's
HTTP API using httpx (already a dependency) so no new package is required.
Fails soft: if RESEND_API_KEY is unset, logs a warning and returns False so
callers can decide how to degrade — it never raises into a request path.
"""

import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

RESEND_ENDPOINT = "https://api.resend.com/emails"


async def send_transactional_email(to: str, subject: str, html: str) -> bool:
    """
    Send a single transactional email. Returns True on success, False if the
    sender is not configured or the send failed. Never raises.
    """
    if not settings.RESEND_API_KEY:
        logger.warning(
            "RESEND_API_KEY not configured; transactional email to %s not sent",
            to,
        )
        return False

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                RESEND_ENDPOINT,
                headers={
                    "Authorization": f"Bearer {settings.RESEND_API_KEY}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": settings.TRANSACTIONAL_FROM_EMAIL,
                    "to": [to],
                    "subject": subject,
                    "html": html,
                },
            )
        if resp.status_code >= 400:
            logger.error(
                "Transactional email send failed (%s): %s",
                resp.status_code,
                resp.text[:200],
            )
            return False
        return True
    except httpx.HTTPError as exc:
        logger.error("Transactional email send error: %s", exc)
        return False
