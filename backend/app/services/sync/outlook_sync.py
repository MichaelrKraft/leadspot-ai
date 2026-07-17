"""
Outlook Mail Sync Service

Pulls inbound messages from Microsoft Graph into email_messages, matches them
to contacts and open leasing deals, and runs deal-status inference over new
messages. Unlike GmailSyncService, this service refreshes the access token
itself — Microsoft access tokens expire in ~1 hour, so sync must handle
refresh-on-expiry rather than assume a valid token.
"""

import logging
from datetime import datetime, timedelta
from typing import Any, Optional

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.models.contact import Contact
from app.models.deal import Deal
from app.models.email_message import EmailMessage
from app.models.oauth_connection import OAuthConnection
from app.services.encryption import get_encryption_service
from app.services.inference.deal_status_agent import analyze_source_for_deal_status

logger = logging.getLogger(__name__)

GRAPH_MESSAGES_URL = "https://graph.microsoft.com/v1.0/me/messages"


class OutlookSyncService:
    """Syncs inbound mail from Microsoft Graph."""

    DEFAULT_SYNC_DAYS = 14
    PAGE_SIZE = 50

    def __init__(self):
        self.encryption_service = get_encryption_service()

    async def _ensure_access_token(
        self, connection: OAuthConnection, db: AsyncSession, force_refresh: bool = False
    ) -> str:
        """Return a usable access token, refreshing (and persisting) if expired."""
        expired = (
            force_refresh
            or connection.expires_at is None
            or connection.expires_at <= datetime.utcnow() + timedelta(minutes=2)
        )
        if not expired:
            return self.encryption_service.decrypt(connection.access_token)

        if not connection.refresh_token:
            raise RuntimeError("Access token expired and no refresh token available")

        from app.services.oauth.microsoft import MicrosoftOAuthProvider

        provider = MicrosoftOAuthProvider(
            client_id=settings.MICROSOFT_CLIENT_ID,
            client_secret=settings.MICROSOFT_CLIENT_SECRET,
            redirect_uri=f"{settings.API_BASE_URL}/oauth/microsoft/callback",
        )
        decrypted_refresh = self.encryption_service.decrypt(connection.refresh_token)
        new_access_token, new_expires_at = await provider.refresh_access_token(decrypted_refresh)

        connection.access_token = self.encryption_service.encrypt(new_access_token)
        connection.expires_at = new_expires_at
        connection.updated_at = datetime.utcnow()
        await db.commit()
        logger.info(f"outlook_sync: refreshed access token for connection {connection.connection_id}")
        return new_access_token

    async def _fetch_messages(
        self, access_token: str, since: datetime, max_messages: int
    ) -> list[dict[str, Any]]:
        """Fetch messages received since `since`, newest first, following pagination."""
        since_iso = since.strftime("%Y-%m-%dT%H:%M:%SZ")
        url: Optional[str] = (
            f"{GRAPH_MESSAGES_URL}"
            f"?$filter=receivedDateTime ge {since_iso}"
            f"&$orderby=receivedDateTime desc"
            f"&$top={self.PAGE_SIZE}"
            f"&$select=id,subject,bodyPreview,from,toRecipients,receivedDateTime"
        )
        messages: list[dict[str, Any]] = []
        async with httpx.AsyncClient(timeout=30) as client:
            while url and len(messages) < max_messages:
                response = await client.get(
                    url, headers={"Authorization": f"Bearer {access_token}"}
                )
                response.raise_for_status()
                data = response.json()
                messages.extend(data.get("value", []))
                url = data.get("@odata.nextLink")
        return messages[:max_messages]

    async def _match_contact_and_deal(
        self, db: AsyncSession, org_id: str, addresses: list[str]
    ) -> tuple[Optional[str], Optional[str]]:
        """Match any of the given addresses to a contact, then to one open leasing deal."""
        addresses = [a.lower() for a in addresses if a]
        if not addresses:
            return None, None

        contact = (
            await db.execute(
                select(Contact).where(
                    Contact.organization_id == org_id,
                    Contact.email.in_(addresses),
                )
            )
        ).scalars().first()
        if not contact:
            return None, None

        deal = (
            await db.execute(
                select(Deal).where(
                    Deal.org_id == org_id,
                    Deal.pipeline == "leasing",
                    Deal.contact_id == contact.id,
                    Deal.stage.notin_(["signed", "lost"]),
                )
            )
        ).scalars().first()
        return contact.id, (deal.id if deal else None)

    async def sync_connection(
        self,
        connection: OAuthConnection,
        db: AsyncSession,
        max_messages: int = 100,
        sync_days: int = None,
        run_inference: bool = True,
    ) -> dict[str, Any]:
        """Sync inbound Outlook mail for a connection."""
        results: dict[str, Any] = {
            "provider": "microsoft",
            "connection_id": connection.connection_id,
            "messages_synced": 0,
            "messages_skipped": 0,
            "suggestions_created": 0,
            "errors": [],
        }
        org_id = connection.organization_id

        since = connection.last_sync_at or (
            datetime.utcnow() - timedelta(days=sync_days or self.DEFAULT_SYNC_DAYS)
        )

        try:
            access_token = await self._ensure_access_token(connection, db)
            try:
                raw_messages = await self._fetch_messages(access_token, since, max_messages)
            except httpx.HTTPStatusError as e:
                if e.response.status_code == 401:
                    # Token rejected despite expiry check — force refresh and retry once
                    access_token = await self._ensure_access_token(
                        connection, db, force_refresh=True
                    )
                    raw_messages = await self._fetch_messages(access_token, since, max_messages)
                else:
                    raise
        except Exception as e:
            logger.error(f"outlook_sync: fetch failed: {e}")
            connection.last_sync_status = "error"
            await db.commit()
            results["errors"].append(str(e))
            return results

        new_message_ids: list[str] = []
        for raw in raw_messages:
            graph_id = raw.get("id")
            if not graph_id:
                continue

            existing = (
                await db.execute(
                    select(EmailMessage.id).where(
                        EmailMessage.org_id == org_id,
                        EmailMessage.provider_message_id == graph_id,
                    )
                )
            ).scalar_one_or_none()
            if existing:
                results["messages_skipped"] += 1
                continue

            from_address = (
                raw.get("from", {}).get("emailAddress", {}).get("address", "") or ""
            )
            to_addresses = [
                r.get("emailAddress", {}).get("address", "")
                for r in raw.get("toRecipients", [])
            ]
            received_raw = raw.get("receivedDateTime", "")
            try:
                received_at = datetime.strptime(received_raw, "%Y-%m-%dT%H:%M:%SZ")
            except ValueError:
                received_at = datetime.utcnow()

            contact_id, deal_id = await self._match_contact_and_deal(
                db, org_id, [from_address, *to_addresses]
            )

            message = EmailMessage(
                org_id=org_id,
                provider="outlook",
                provider_message_id=graph_id,
                from_address=from_address,
                to_addresses=",".join(a for a in to_addresses if a),
                subject=raw.get("subject"),
                body_preview=raw.get("bodyPreview"),
                received_at=received_at,
                contact_id=contact_id,
                deal_id=deal_id,
            )
            db.add(message)
            await db.flush()
            new_message_ids.append(message.id)
            results["messages_synced"] += 1

        connection.last_sync_at = datetime.utcnow()
        connection.last_sync_status = "success"
        connection.documents_synced = (connection.documents_synced or 0) + results["messages_synced"]
        await db.commit()

        if run_inference and new_message_ids:
            for msg_id in new_message_ids:
                message = (
                    await db.execute(select(EmailMessage).where(EmailMessage.id == msg_id))
                ).scalar_one()
                text = f"From: {message.from_address}\nSubject: {message.subject}\n\n{message.body_preview or ''}"
                try:
                    suggestion = await analyze_source_for_deal_status(
                        db, org_id, "email", message.id, text
                    )
                    if suggestion:
                        results["suggestions_created"] += 1
                except Exception as e:
                    logger.error(f"outlook_sync: inference failed for {msg_id}: {e}")
                    results["errors"].append(f"inference:{msg_id}:{e}")
                message.analyzed_at = datetime.utcnow()
            await db.commit()

        logger.info(
            f"outlook_sync: {results['messages_synced']} synced, "
            f"{results['messages_skipped']} skipped, "
            f"{results['suggestions_created']} suggestions"
        )
        return results
