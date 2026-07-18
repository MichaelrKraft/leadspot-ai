"""
Gmail Inbox Sync Service — the Unified Inbox ingestion pipeline.

Cursor-based incremental sync over Gmail history.list (structure modeled on
outlook_sync.py, cursor logic ported from inbox-concierge). Per new message:
dedupe -> store EmailMessage (capped preview, never the full body) -> match
contact via normalized email + aliases -> run deal-status inference -> log a
TERMINAL EmailEvent. A message with no terminal event is retried on the next
cycle, so a crash mid-pipeline never silently drops work.

Cursor + pause + failure count live in OAuthConnection.provider_metadata JSON:
  {"history_id": "...", "paused": false, "consecutive_failures": 0}
"""

import json
import logging
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config.settings import settings
from app.models.contact import Contact
from app.models.email import Email
from app.models.email_alias import EmailAlias
from app.models.email_event import TERMINAL_ACTIONS, EmailEvent
from app.models.email_message import EmailMessage
from app.models.oauth_connection import ConnectionStatus, OAuthConnection
from app.services.connectors.gmail import STALE_CURSOR, GmailClient
from app.services.encryption import get_encryption_service
from app.services.inference.deal_status_agent import analyze_source_for_deal_status
from app.services.inference.email_classifier import classify_email
from app.services.inference.llm_client import get_anthropic_client
from app.services.inference.reply_drafter import (
    draft_reply,
    never_draft,
    under_daily_cap,
)
from app.utils.email_normalize import email_hash, normalize_email

logger = logging.getLogger(__name__)

BODY_PREVIEW_CAP = 4000
MAX_CONSECUTIVE_FAILURES = 5


def read_meta(connection: OAuthConnection) -> dict[str, Any]:
    try:
        return json.loads(connection.provider_metadata or "{}")
    except (TypeError, ValueError):
        return {}


def write_meta(connection: OAuthConnection, meta: dict[str, Any]) -> None:
    connection.provider_metadata = json.dumps(meta)


class GmailInboxSyncService:
    """Incremental Gmail ingestion for one poll cycle."""

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

        from app.services.oauth.gmail import GmailOAuthProvider

        provider = GmailOAuthProvider(
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            redirect_uri=f"{settings.API_BASE_URL}/api/oauth/gmail/callback",
        )
        decrypted_refresh = self.encryption_service.decrypt(connection.refresh_token)
        new_access_token, new_expires_at = await provider.refresh_access_token(decrypted_refresh)

        connection.access_token = self.encryption_service.encrypt(new_access_token)
        connection.expires_at = new_expires_at
        connection.updated_at = datetime.utcnow()
        await db.commit()
        logger.info(f"gmail_inbox_sync: refreshed access token for {connection.connection_id}")
        return new_access_token

    async def _match_contact(
        self, db: AsyncSession, org_id: str, addresses: list[str]
    ) -> tuple[str | None, str | None]:
        """Match addresses to a contact via aliases first, then Contact.email.

        Returns (contact_id, ambiguity_note). On duplicates, prefers the
        most-recently-updated contact and reports the ambiguity.
        """
        hashes = [email_hash(a) for a in addresses if a]
        hashes = [h for h in hashes if h]
        if not hashes:
            return None, None

        alias = (
            await db.execute(
                select(EmailAlias).where(
                    EmailAlias.organization_id == org_id,
                    EmailAlias.email_hash.in_(hashes),
                )
            )
        ).scalars().first()
        if alias:
            return alias.contact_id, None

        normalized = [normalize_email(a) for a in addresses if a]
        normalized = [n for n in normalized if n and "@" in n]
        if not normalized:
            return None, None

        # Case-insensitive fallback; Contact.email defaults to "" so exclude it.
        contacts = (
            await db.execute(
                select(Contact).where(
                    Contact.organization_id == org_id,
                    Contact.email != "",
                    func.lower(Contact.email).in_(normalized),
                )
            )
        ).scalars().all()
        if not contacts:
            return None, None
        if len(contacts) == 1:
            return contacts[0].id, None

        chosen = max(contacts, key=lambda c: c.updated_at or c.created_at or datetime.min)
        return chosen.id, f"ambiguous contact match ({len(contacts)} candidates)"

    async def _has_terminal_event(
        self, db: AsyncSession, org_id: str, provider_message_id: str
    ) -> bool:
        row = (
            await db.execute(
                select(EmailEvent.id).where(
                    EmailEvent.org_id == org_id,
                    EmailEvent.provider_message_id == provider_message_id,
                    EmailEvent.action.in_(TERMINAL_ACTIONS),
                )
            )
        ).scalar_one_or_none()
        return row is not None

    async def _log_event(
        self,
        db: AsyncSession,
        org_id: str,
        provider_message_id: str,
        action: str,
        detail: str = "",
        email_message_id: str | None = None,
        category: str | None = None,
    ) -> None:
        exists = (
            await db.execute(
                select(EmailEvent.id).where(
                    EmailEvent.org_id == org_id,
                    EmailEvent.provider_message_id == provider_message_id,
                    EmailEvent.action == action,
                )
            )
        ).scalar_one_or_none()
        if exists:
            return
        db.add(
            EmailEvent(
                org_id=org_id,
                provider_message_id=provider_message_id,
                email_message_id=email_message_id,
                category=category,
                action=action,
                detail=detail[:300],
            )
        )
        await db.commit()

    async def sync_connection(
        self,
        connection: OAuthConnection,
        db: AsyncSession,
        run_inference: bool = True,
        backfill_ids: list[str] | None = None,
    ) -> dict[str, Any]:
        """One incremental sync cycle (or a backfill batch when ids are given)."""
        results: dict[str, Any] = {
            "provider": "gmail",
            "connection_id": connection.connection_id,
            "messages_synced": 0,
            "messages_skipped": 0,
            "suggestions_created": 0,
            "errors": [],
        }
        org_id = connection.organization_id
        meta = read_meta(connection)

        if meta.get("paused"):
            results["paused"] = True
            return results

        access_token = await self._ensure_access_token(connection, db)
        client = GmailClient(access_token)

        if backfill_ids is not None:
            message_ids = backfill_ids
        else:
            cursor = meta.get("history_id")
            if not cursor:
                # First run: start from "now"; backlog is the backfill's job.
                meta["history_id"] = await client.current_history_id()
                write_meta(connection, meta)
                await db.commit()
                results["bootstrapped"] = True
                return results

            listed, new_cursor = await client.list_new_message_ids(cursor)
            if listed == STALE_CURSOR:
                meta["history_id"] = await client.current_history_id()
                write_meta(connection, meta)
                await db.commit()
                logger.warning(
                    f"gmail_inbox_sync: stale cursor for {connection.connection_id} — resynced to now"
                )
                results["resynced"] = True
                return results
            message_ids = listed
            # Cursor advances only after the batch completes (below), so a
            # crash mid-batch replays the window; per-message terminal events
            # and the (org_id, provider_message_id) dedupe make replay safe.
            meta["history_id_pending"] = new_cursor

        for message_id in message_ids:
            try:
                synced = await self._process_message(
                    client, connection, db, org_id, message_id, run_inference, results
                )
                if synced:
                    results["messages_synced"] += 1
                else:
                    results["messages_skipped"] += 1
            except Exception as e:
                logger.error(f"gmail_inbox_sync: message {message_id} failed: {e}")
                results["errors"].append(f"{message_id}:{e}")

        if backfill_ids is None and "history_id_pending" in meta:
            meta["history_id"] = meta.pop("history_id_pending")
            write_meta(connection, meta)

        connection.last_sync_at = datetime.utcnow()
        connection.last_sync_status = "success" if not results["errors"] else "partial"
        connection.documents_synced = (connection.documents_synced or 0) + results["messages_synced"]
        await db.commit()
        return results

    async def _process_message(
        self,
        client: GmailClient,
        connection: OAuthConnection,
        db: AsyncSession,
        org_id: str,
        message_id: str,
        run_inference: bool,
        results: dict[str, Any],
    ) -> bool:
        """Process one message. Returns True if newly synced."""
        # Terminal-event check (not mere row existence) keeps a crash between
        # ingestion and inference retryable instead of silently dropped.
        if await self._has_terminal_event(db, org_id, message_id):
            return False

        msg = await client.get_message(message_id)
        if msg is None or msg.is_draft:
            return False
        if not msg.is_inbox and not msg.is_sent:
            return False  # archived/spam/etc. — not inbox pipeline material

        existing = (
            await db.execute(
                select(EmailMessage).where(
                    EmailMessage.org_id == org_id,
                    EmailMessage.provider_message_id == message_id,
                )
            )
        ).scalar_one_or_none()

        direction = "outbound" if msg.is_sent else "inbound"
        match_addresses = msg.to_addresses if msg.is_sent else [msg.from_address]
        contact_id, ambiguity = await self._match_contact(db, org_id, match_addresses)

        if existing:
            record = existing
        else:
            record = EmailMessage(
                org_id=org_id,
                provider="gmail",
                provider_message_id=message_id,
                thread_id=msg.thread_id,
                direction=direction,
                from_address=msg.from_address,
                to_addresses=",".join(a for a in msg.to_addresses if a),
                subject=msg.subject,
                body_preview=(msg.body or msg.snippet)[:BODY_PREVIEW_CAP],
                received_at=msg.received_at or datetime.utcnow(),
                contact_id=contact_id,
            )
            db.add(record)
            await db.flush()
            await self._log_event(
                db, org_id, message_id, "ingested",
                ambiguity or direction, email_message_id=record.id,
            )

        if msg.is_sent:
            # Outgoing mail: thread now awaits the other side's reply. Terminal —
            # no classification or drafting applies to our own messages.
            record.category = "Awaiting Reply"
            await self._log_event(
                db, org_id, message_id, "no-draft-needed", "outgoing",
                email_message_id=record.id, category="Awaiting Reply",
            )
            return existing is None

        # Inbound reply on a thread we were awaiting -> that wait is over.
        if msg.thread_id:
            awaiting = (
                await db.execute(
                    select(EmailMessage).where(
                        EmailMessage.org_id == org_id,
                        EmailMessage.thread_id == msg.thread_id,
                        EmailMessage.direction == "outbound",
                        EmailMessage.category == "Awaiting Reply",
                    )
                )
            ).scalars().all()
            for out_msg in awaiting:
                out_msg.category = "Actioned"

        classification = None
        client = None
        if run_inference:
            client = await get_anthropic_client(db, org_id)

            # Triage classification (sender rules first, then Haiku).
            try:
                classification = await classify_email(
                    db, org_id, msg.from_address, msg.subject,
                    msg.body or msg.snippet, client=client,
                )
            except Exception as e:
                logger.error(f"gmail_inbox_sync: classify failed for {message_id}: {e}")
                results["errors"].append(f"classify:{message_id}:{e}")
                return existing is None  # no terminal event -> retried next cycle
            if classification:
                record.category = classification.category
                await self._log_event(
                    db, org_id, message_id, "classified", classification.reason,
                    email_message_id=record.id, category=classification.category,
                )

            # Deal-status inference. Full body in memory only — inference sees
            # more than the stored preview.
            text = f"From: {msg.from_address}\nSubject: {msg.subject}\n\n{msg.body or msg.snippet}"
            try:
                suggestion = await analyze_source_for_deal_status(
                    db, org_id, "email", record.id, text, client=client
                )
                if suggestion:
                    results["suggestions_created"] += 1
                    if suggestion.deal_id and not record.deal_id:
                        record.deal_id = suggestion.deal_id
            except Exception as e:
                logger.error(f"gmail_inbox_sync: inference failed for {message_id}: {e}")
                results["errors"].append(f"inference:{message_id}:{e}")
                return existing is None  # no terminal event -> retried next cycle
            record.analyzed_at = datetime.utcnow()

        # Draft decision — every path below logs a TERMINAL event.
        if (
            run_inference
            and classification
            and classification.drafts_enabled
            and client is not None
        ):
            if record.contact_id is None:
                await self._log_event(
                    db, org_id, message_id, "skipped", "sender not a CRM contact",
                    email_message_id=record.id, category=record.category,
                )
            elif await never_draft(db, org_id, msg.from_address):
                await self._log_event(
                    db, org_id, message_id, "skipped", "never-draft rule",
                    email_message_id=record.id, category=record.category,
                )
            elif not await under_daily_cap(db, org_id):
                await self._log_event(
                    db, org_id, message_id, "skipped", "daily draft cap",
                    email_message_id=record.id, category=record.category,
                )
            else:
                mailbox = connection.connected_user_email or ""
                draft_text = await draft_reply(
                    db, org_id, mailbox, msg.from_address, msg.subject,
                    msg.body or msg.snippet, client,
                )
                if draft_text is None:
                    # LLM failure: no terminal event -> retried next cycle.
                    results["errors"].append(f"draft:{message_id}:llm failure")
                    return existing is None
                db.add(
                    Email(
                        subject=f"Re: {msg.subject or ''}".strip(),
                        status="Draft",
                        from_addr=mailbox,
                        to_addr=msg.from_address,
                        body=draft_text,
                        email_type="Outbound",
                        contact_id=record.contact_id,
                        user_id=connection.user_id,
                    )
                )
                await self._log_event(
                    db, org_id, message_id, "drafted", "reply draft saved",
                    email_message_id=record.id, category=record.category,
                )
                results["drafts_created"] = results.get("drafts_created", 0) + 1
                await db.commit()
                return existing is None

        else:
            await self._log_event(
                db, org_id, message_id, "no-draft-needed",
                "category not draft-enabled" if classification else "not classified",
                email_message_id=record.id, category=record.category,
            )
        await db.commit()
        return existing is None

    async def record_cycle_outcome(
        self, connection: OAuthConnection, db: AsyncSession, ok: bool, error: str = ""
    ) -> bool:
        """Track consecutive failures; mark connection ERROR after the limit.

        Returns True when the connection was just moved to ERROR (caller alerts).
        """
        meta = read_meta(connection)
        if ok:
            meta["consecutive_failures"] = 0
            write_meta(connection, meta)
            await db.commit()
            return False

        failures = int(meta.get("consecutive_failures", 0)) + 1
        meta["consecutive_failures"] = failures
        write_meta(connection, meta)
        connection.last_sync_status = "error"
        tripped = failures >= MAX_CONSECUTIVE_FAILURES
        if tripped:
            connection.status = ConnectionStatus.ERROR
            logger.error(
                f"gmail_inbox_sync: connection {connection.connection_id} marked ERROR "
                f"after {failures} consecutive failures (last: {error[:200]})"
            )
        await db.commit()
        return tripped
