"""
Gmail Sync Service

Syncs emails from Gmail to InnoSynth.ai.
Fetches emails, extracts content, and indexes them for semantic search.
"""

import logging
import uuid
from datetime import datetime, timedelta
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document
from app.models.oauth_connection import OAuthConnection
from app.services import local_embedding_service, local_vector_store
from app.services.connectors.gmail import EmailMessage, GmailConnector
from app.services.encryption import get_encryption_service

logger = logging.getLogger(__name__)


class GmailSyncService:
    """Syncs emails from Gmail."""

    # Default sync configuration
    DEFAULT_SYNC_DAYS = 365  # 1 year
    DEFAULT_MAX_EMAILS = 500
    DEFAULT_EXCLUDED_LABELS = ["CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "SPAM", "TRASH"]

    # Supported attachment types for indexing
    SUPPORTED_ATTACHMENT_TYPES = {
        "application/pdf",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/msword",
        "text/plain",
        "text/csv",
    }

    def __init__(self):
        self.encryption_service = get_encryption_service()

    async def sync_connection(
        self,
        connection: OAuthConnection,
        db: AsyncSession,
        max_emails: int = None,
        sync_days: int = None,
        exclude_labels: list[str] = None,
        include_attachments: bool = True,
        group_threads: bool = True,
    ) -> dict[str, Any]:
        """
        Sync emails from a Gmail connection.

        Args:
            connection: The OAuth connection to sync
            db: Database session
            max_emails: Maximum number of emails to sync
            sync_days: Number of days back to sync
            exclude_labels: Labels to exclude from sync
            include_attachments: Whether to index attachments
            group_threads: Whether to group emails by thread

        Returns:
            Sync results dictionary
        """
        max_emails = max_emails or self.DEFAULT_MAX_EMAILS
        sync_days = sync_days or self.DEFAULT_SYNC_DAYS
        exclude_labels = exclude_labels or self.DEFAULT_EXCLUDED_LABELS

        logger.info(f"Starting Gmail sync for connection {connection.connection_id}")

        results = {
            "connection_id": connection.connection_id,
            "started_at": datetime.utcnow().isoformat(),
            "emails_found": 0,
            "emails_synced": 0,
            "emails_skipped": 0,
            "threads_synced": 0,
            "attachments_synced": 0,
            "errors": [],
        }

        try:
            # Decrypt access token
            access_token = self.encryption_service.decrypt(connection.access_token)

            # Create Gmail connector
            connector = GmailConnector(access_token=access_token)

            # Calculate since date
            since_date = datetime.utcnow() - timedelta(days=sync_days)

            # List messages
            messages = await connector.list_messages(
                max_results=max_emails,
                since_date=since_date,
                exclude_labels=exclude_labels,
            )
            results["emails_found"] = len(messages)

            # Track synced threads to avoid duplicates when grouping
            synced_threads = set()

            # Process each message
            for msg_info in messages:
                try:
                    msg_id = msg_info.get("id")
                    thread_id = msg_info.get("threadId")

                    # If grouping threads, sync entire thread at once
                    if group_threads and thread_id in synced_threads:
                        results["emails_skipped"] += 1
                        continue

                    if group_threads:
                        success = await self._sync_thread(
                            connector=connector,
                            thread_id=thread_id,
                            connection=connection,
                            db=db,
                            include_attachments=include_attachments,
                        )
                        if success:
                            synced_threads.add(thread_id)
                            results["threads_synced"] += 1
                            results["emails_synced"] += 1
                        else:
                            results["emails_skipped"] += 1
                    else:
                        success = await self._sync_message(
                            connector=connector,
                            message_id=msg_id,
                            connection=connection,
                            db=db,
                            include_attachments=include_attachments,
                        )
                        if success:
                            results["emails_synced"] += 1
                        else:
                            results["emails_skipped"] += 1

                except Exception as e:
                    logger.error(f"Error syncing message {msg_info.get('id')}: {e}")
                    results["errors"].append({
                        "message_id": msg_info.get("id"),
                        "error": str(e),
                    })
                    results["emails_skipped"] += 1

            # Update connection sync status
            connection.last_sync_at = datetime.utcnow()
            connection.last_sync_status = "success" if not results["errors"] else "partial"

            # Get total document count for this connection (not just this sync)
            from sqlalchemy import func
            total_count_result = await db.execute(
                select(func.count(Document.document_id)).where(
                    Document.organization_id == connection.organization_id,
                    Document.source_system == "gmail",
                )
            )
            connection.documents_synced = total_count_result.scalar() or 0
            await db.commit()

            results["completed_at"] = datetime.utcnow().isoformat()
            logger.info(
                f"Gmail sync completed: {results['emails_synced']} synced, "
                f"{results['emails_skipped']} skipped, {results['threads_synced']} threads"
            )

        except Exception as e:
            logger.error(f"Gmail sync failed: {e}")
            connection.last_sync_status = "error"
            await db.commit()
            results["error"] = str(e)

        return results

    async def _sync_thread(
        self,
        connector: GmailConnector,
        thread_id: str,
        connection: OAuthConnection,
        db: AsyncSession,
        include_attachments: bool,
    ) -> bool:
        """
        Sync an entire email thread as a single document.

        Returns True if synced, False if skipped.
        """
        # Check if already synced
        existing = await db.execute(
            select(Document).where(
                Document.organization_id == connection.organization_id,
                Document.source_system == "gmail",
                Document.source_id == thread_id,
            )
        )
        existing_doc = existing.scalar_one_or_none()

        # Get all messages in thread
        messages = await connector.get_thread(thread_id)
        if not messages:
            return False

        # Get the latest message date
        latest_date = max(msg.date for msg in messages if msg.date)

        # Check if thread was modified since last sync
        if existing_doc and existing_doc.last_modified:
            if existing_doc.last_modified >= latest_date:
                logger.debug(f"Skipping unchanged thread: {thread_id}")
                return False

        # Build combined thread content for indexing
        thread_content = self._build_thread_content(messages)
        primary_subject = messages[0].subject if messages else "Email Thread"

        # Create or update document
        if existing_doc:
            existing_doc.content = self.encryption_service.encrypt(thread_content)
            existing_doc.last_modified = latest_date
            existing_doc.title = primary_subject
        else:
            doc = Document(
                document_id=str(uuid.uuid4()),
                organization_id=connection.organization_id,
                user_id=connection.user_id,
                title=primary_subject,
                filename=f"thread_{thread_id}.txt",
                content=self.encryption_service.encrypt(thread_content),
                mime_type="message/rfc822",
                source_system="gmail",
                source_id=thread_id,
                source_url=f"https://mail.google.com/mail/u/0/#inbox/{thread_id}",
                file_size=len(thread_content.encode("utf-8")),
                status="uploaded",
                created_at=messages[0].date if messages else datetime.utcnow(),
                last_modified=latest_date,
            )
            db.add(doc)

        await db.commit()

        # Index for search
        try:
            doc_to_index = existing_doc if existing_doc else doc
            await self._index_document(doc_to_index, thread_content)
        except Exception as e:
            logger.error(f"Failed to index thread {thread_id}: {e}")

        return True

    async def _sync_message(
        self,
        connector: GmailConnector,
        message_id: str,
        connection: OAuthConnection,
        db: AsyncSession,
        include_attachments: bool,
    ) -> bool:
        """
        Sync a single email message.

        Returns True if synced, False if skipped.
        """
        # Check if already synced
        existing = await db.execute(
            select(Document).where(
                Document.organization_id == connection.organization_id,
                Document.source_system == "gmail",
                Document.source_id == message_id,
            )
        )
        existing_doc = existing.scalar_one_or_none()

        # Get message content
        message = await connector.get_message(message_id)

        # Check if modified since last sync
        if existing_doc and existing_doc.last_modified:
            if message.date and existing_doc.last_modified >= message.date:
                logger.debug(f"Skipping unchanged message: {message_id}")
                return False

        # Build document content
        content = self._build_message_content(message)

        # Create or update document
        if existing_doc:
            existing_doc.content = self.encryption_service.encrypt(content)
            existing_doc.last_modified = message.date
            existing_doc.title = message.subject
        else:
            doc = Document(
                document_id=str(uuid.uuid4()),
                organization_id=connection.organization_id,
                user_id=connection.user_id,
                title=message.subject,
                filename=f"email_{message_id}.txt",
                content=self.encryption_service.encrypt(content),
                mime_type="message/rfc822",
                source_system="gmail",
                source_id=message_id,
                source_url=f"https://mail.google.com/mail/u/0/#inbox/{message_id}",
                file_size=len(content.encode("utf-8")),
                status="uploaded",
                created_at=message.date,
                last_modified=message.date,
            )
            db.add(doc)

        await db.commit()

        # Index for search
        try:
            doc_to_index = existing_doc if existing_doc else doc
            await self._index_document(doc_to_index, content)
        except Exception as e:
            logger.error(f"Failed to index message {message_id}: {e}")

        return True

    def _build_message_content(self, message: EmailMessage) -> str:
        """Build searchable content from a single message."""
        # Strip HTML from body if needed
        body = message.body_text
        if not body and message.body_html:
            import re
            from html import unescape
            body = re.sub(r'<[^>]+>', ' ', message.body_html)
            body = unescape(body)
            body = re.sub(r'\s+', ' ', body).strip()

        date_str = message.date.strftime('%B %d, %Y at %I:%M %p') if message.date else 'Unknown date'

        return f"""Email
Subject: {message.subject}
From: {message.from_name} <{message.from_email}>
To: {', '.join(message.to_emails)}
Date: {date_str}

{body}
"""

    def _build_thread_content(self, messages: list[EmailMessage]) -> str:
        """Build searchable content from an email thread."""
        if not messages:
            return ""

        # Sort by date (oldest first)
        sorted_messages = sorted(messages, key=lambda m: m.date or datetime.min)

        # Get thread subject
        subject = sorted_messages[0].subject
        participants = list(set(
            [msg.from_email for msg in sorted_messages] +
            [email for msg in sorted_messages for email in msg.to_emails]
        ))

        parts = [
            f"Email Thread: {subject}",
            f"Participants: {', '.join(participants)}",
            f"Messages: {len(messages)}",
            "=" * 50,
            "",
        ]

        for msg in sorted_messages:
            body = msg.body_text
            if not body and msg.body_html:
                import re
                from html import unescape
                body = re.sub(r'<[^>]+>', ' ', msg.body_html)
                body = unescape(body)
                body = re.sub(r'\s+', ' ', body).strip()

            date_str = msg.date.strftime('%B %d, %Y at %I:%M %p') if msg.date else 'Unknown'

            parts.extend([
                f"From: {msg.from_name} <{msg.from_email}>",
                f"Date: {date_str}",
                "",
                body or "(No content)",
                "",
                "-" * 30,
                "",
            ])

        return "\n".join(parts)

    async def _index_document(self, doc: Document, content: str):
        """Index document content for semantic search."""
        if not local_embedding_service.is_available():
            logger.warning("Embedding service not available, skipping indexing")
            return

        # Add to vector store
        local_vector_store.index_document(
            document_id=str(doc.document_id),
            organization_id=doc.organization_id,
            title=doc.title,
            content=content,
            metadata={
                "filename": doc.filename,
                "source_system": doc.source_system,
                "source_id": doc.source_id,
                "type": "email",
            }
        )

        # Update document status
        doc.status = "indexed"
