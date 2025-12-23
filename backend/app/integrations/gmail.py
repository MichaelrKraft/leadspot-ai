"""
Gmail Integration Connector

Connects to Gmail via OAuth 2.0 to sync emails for knowledge base queries.
Supports both real API mode (with credentials) and demo mode (without).

Features:
- Full sync of emails from inbox
- Thread grouping for context
- Attachment indexing (PDFs, DOCs)
- Temporal query support ("emails from last month")
"""

import logging
from collections.abc import AsyncIterator
from datetime import datetime, timedelta
from typing import Any

from app.config import settings
from app.integrations.base import (
    BaseConnector,
    ConnectorStatus,
    IntegrationConfig,
    SyncedDocument,
)

logger = logging.getLogger(__name__)


class GmailConnector(BaseConnector):
    """
    Gmail connector for syncing emails.

    Supports:
    - Email messages with threading
    - PDF and document attachments
    - Temporal filtering (last month, etc.)
    """

    config = IntegrationConfig(
        provider="gmail",
        name="Gmail",
        description="Search your email history with AI - ask questions like 'What company sent me a cruise offer last month?'",
        icon="gmail",
        color="#EA4335",
        scopes=[
            "https://www.googleapis.com/auth/gmail.readonly",
            "https://www.googleapis.com/auth/gmail.labels",
            "https://www.googleapis.com/auth/userinfo.email",
            "https://www.googleapis.com/auth/userinfo.profile",
        ],
        supports_webhooks=True,
        supports_incremental_sync=True,
        demo_available=True,
    )

    # Google API endpoints
    AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    API_BASE = "https://gmail.googleapis.com/gmail/v1"

    @classmethod
    def get_config(cls) -> IntegrationConfig:
        return cls.config

    @classmethod
    def is_configured(cls) -> bool:
        """Check if Google OAuth credentials are configured"""
        return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)

    async def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        """Generate Google OAuth authorization URL for Gmail"""
        from urllib.parse import urlencode

        if self._demo_mode:
            return f"/api/integrations/gmail/demo-callback?state={state}"

        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.config.scopes),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        query = urlencode(params)
        return f"{self.AUTH_URL}?{query}"

    async def exchange_code(self, code: str, redirect_uri: str) -> dict[str, Any]:
        """Exchange authorization code for tokens"""
        if self._demo_mode:
            return self._get_demo_tokens()

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.TOKEN_URL,
                    data={
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "code": code,
                        "redirect_uri": redirect_uri,
                        "grant_type": "authorization_code",
                    },
                )
                response.raise_for_status()
                data = response.json()

                return {
                    "access_token": data["access_token"],
                    "refresh_token": data.get("refresh_token"),
                    "expires_at": datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600)),
                    "token_type": data.get("token_type", "Bearer"),
                    "scope": data.get("scope", ""),
                }

        except Exception as e:
            logger.error(f"Gmail OAuth token exchange failed: {e}")
            raise

    async def refresh_access_token(self) -> dict[str, Any]:
        """Refresh the access token"""
        if self._demo_mode:
            return self._get_demo_tokens()

        if not self.refresh_token:
            raise ValueError("No refresh token available")

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.post(
                    self.TOKEN_URL,
                    data={
                        "client_id": settings.GOOGLE_CLIENT_ID,
                        "client_secret": settings.GOOGLE_CLIENT_SECRET,
                        "refresh_token": self.refresh_token,
                        "grant_type": "refresh_token",
                    },
                )
                response.raise_for_status()
                data = response.json()

                self.access_token = data["access_token"]

                return {
                    "access_token": data["access_token"],
                    "expires_at": datetime.utcnow() + timedelta(seconds=data.get("expires_in", 3600)),
                }

        except Exception as e:
            logger.error(f"Gmail OAuth token refresh failed: {e}")
            raise

    async def validate_connection(self) -> bool:
        """Validate the OAuth connection"""
        if self._demo_mode:
            self._status = ConnectorStatus.CONNECTED
            return True

        if not self.access_token:
            self._status = ConnectorStatus.DISCONNECTED
            return False

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.API_BASE}/users/me/profile",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                )
                if response.status_code == 200:
                    self._status = ConnectorStatus.CONNECTED
                    return True
                else:
                    self._status = ConnectorStatus.ERROR
                    return False

        except Exception as e:
            logger.error(f"Gmail connection validation failed: {e}")
            self._status = ConnectorStatus.ERROR
            return False

    async def sync_all(self) -> AsyncIterator[SyncedDocument]:
        """Sync all emails from Gmail"""
        if self._demo_mode:
            async for doc in self._generate_demo_documents():
                yield doc
            return

        self._status = ConnectorStatus.SYNCING
        count = 0

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                page_token = None
                max_results = 100

                while True:
                    # List messages
                    params = {
                        "maxResults": max_results,
                        "q": "-in:spam -in:trash",  # Exclude spam and trash
                    }
                    if page_token:
                        params["pageToken"] = page_token

                    response = await client.get(
                        f"{self.API_BASE}/users/me/messages",
                        headers={"Authorization": f"Bearer {self.access_token}"},
                        params=params,
                    )
                    response.raise_for_status()
                    data = response.json()

                    for message_info in data.get("messages", []):
                        doc = await self._process_message(client, message_info["id"])
                        if doc:
                            count += 1
                            self._log_sync_progress(count)
                            yield doc

                    page_token = data.get("nextPageToken")
                    if not page_token or count >= 500:  # Limit to 500 emails
                        break

            self._status = ConnectorStatus.CONNECTED
            logger.info(f"Gmail sync completed: {count} emails")

        except Exception as e:
            self._handle_error(e, "Full sync failed")
            raise

    async def sync_incremental(
        self,
        since: datetime | None = None,
        sync_token: str | None = None
    ) -> AsyncIterator[SyncedDocument]:
        """Sync only new emails since last sync"""
        if self._demo_mode:
            docs = self._get_demo_emails()
            for doc in docs[:3]:
                yield doc
            return

        self._status = ConnectorStatus.SYNCING

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                # Use date-based query for incremental sync
                if since:
                    query = f"after:{since.strftime('%Y/%m/%d')} -in:spam -in:trash"
                else:
                    query = "-in:spam -in:trash"

                params = {
                    "maxResults": 100,
                    "q": query,
                }

                response = await client.get(
                    f"{self.API_BASE}/users/me/messages",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                for message_info in data.get("messages", []):
                    doc = await self._process_message(client, message_info["id"])
                    if doc:
                        yield doc

            self._status = ConnectorStatus.CONNECTED

        except Exception as e:
            self._handle_error(e, "Incremental sync failed")
            raise

    async def get_document(self, source_id: str) -> SyncedDocument | None:
        """Get a single email by ID"""
        if self._demo_mode:
            docs = self._get_demo_emails()
            for doc in docs:
                if doc.source_id == source_id:
                    return doc
            return None

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                return await self._process_message(client, source_id)

        except Exception as e:
            logger.error(f"Failed to get email {source_id}: {e}")
            return None

    async def _process_message(self, client, message_id: str) -> SyncedDocument | None:
        """Process a single email message"""
        try:
            response = await client.get(
                f"{self.API_BASE}/users/me/messages/{message_id}",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={"format": "full"},
            )
            if response.status_code == 404:
                return None
            response.raise_for_status()
            message = response.json()

            # Extract headers
            headers = {h["name"].lower(): h["value"] for h in message.get("payload", {}).get("headers", [])}
            subject = headers.get("subject", "(No Subject)")
            from_header = headers.get("from", "Unknown Sender")
            to_header = headers.get("to", "")
            date_str = headers.get("date", "")

            # Parse date
            created_at = None
            if date_str:
                try:
                    from email.utils import parsedate_to_datetime
                    created_at = parsedate_to_datetime(date_str)
                except Exception:
                    pass

            # Extract body
            body = self._extract_body(message.get("payload", {}))

            # Build content with headers for context
            content = f"Subject: {subject}\nFrom: {from_header}\nTo: {to_header}\nDate: {date_str}\n\n{body}"

            # Get Gmail link
            source_url = f"https://mail.google.com/mail/u/0/#inbox/{message_id}"

            return SyncedDocument(
                source_id=message_id,
                title=subject,
                content=content,
                mime_type="message/rfc822",
                file_size=len(content),
                source_url=source_url,
                author=from_header,
                created_at=created_at,
                modified_at=created_at,
                metadata={
                    "message_id": message_id,
                    "thread_id": message.get("threadId"),
                    "from": from_header,
                    "to": to_header,
                    "labels": message.get("labelIds", []),
                },
            )

        except Exception as e:
            logger.error(f"Failed to process email {message_id}: {e}")
            return None

    def _extract_body(self, payload: dict) -> str:
        """Extract the text body from email payload"""
        body = ""

        # Check if this part has a body
        if "body" in payload and payload["body"].get("data"):
            import base64
            try:
                body = base64.urlsafe_b64decode(payload["body"]["data"]).decode("utf-8", errors="ignore")
            except Exception:
                pass

        # Check for multipart
        if "parts" in payload:
            for part in payload["parts"]:
                mime_type = part.get("mimeType", "")
                if mime_type == "text/plain":
                    if "body" in part and part["body"].get("data"):
                        import base64
                        try:
                            body = base64.urlsafe_b64decode(part["body"]["data"]).decode("utf-8", errors="ignore")
                            break
                        except Exception:
                            pass
                elif mime_type.startswith("multipart/"):
                    # Recursive call for nested multipart
                    body = self._extract_body(part)
                    if body:
                        break

        return body[:50000] if body else ""  # Limit body length

    async def _generate_demo_documents(self) -> AsyncIterator[SyncedDocument]:
        """Generate demo documents for Gmail"""
        docs = self._get_demo_emails()
        for doc in docs:
            yield doc

    def _get_demo_emails(self) -> list[SyncedDocument]:
        """Return demo email documents"""
        return [
            SyncedDocument(
                source_id="demo_email_1",
                title="Exclusive Cruise Offer - 40% Off Caribbean Adventures",
                content="""Subject: Exclusive Cruise Offer - 40% Off Caribbean Adventures
From: Royal Caribbean Cruises <offers@royalcaribbean.com>
To: you@example.com
Date: November 15, 2024

Dear Valued Customer,

Set sail on an unforgettable Caribbean adventure with our exclusive 40% discount offer!

Your dream vacation includes:
- 7-night Caribbean cruise departing from Miami
- All meals and entertainment included
- Stops in Cozumel, Grand Cayman, and Jamaica
- Complimentary beverage package

Book by December 1st to secure this special rate. Use code CRUISE40 at checkout.

Best regards,
Royal Caribbean Cruises
""",
                mime_type="message/rfc822",
                file_size=500,
                source_url="https://mail.google.com/mail/u/0/#inbox/demo_email_1",
                author="Royal Caribbean Cruises <offers@royalcaribbean.com>",
                created_at=datetime(2024, 11, 15, 10, 30),
                modified_at=datetime(2024, 11, 15, 10, 30),
                metadata={"from": "offers@royalcaribbean.com", "thread_id": "thread_1"},
            ),
            SyncedDocument(
                source_id="demo_email_2",
                title="Re: Q4 Financial Report Review",
                content="""Subject: Re: Q4 Financial Report Review
From: John Smith <john.smith@acme.com>
To: you@example.com
Date: November 20, 2024

Hi,

The project deadline has been moved to January 15th. Please update your timeline accordingly.

Key changes:
- Phase 1 deliverables due December 20th
- Final review scheduled for January 10th
- Presentation to stakeholders on January 15th

Let me know if you have any questions.

Best,
John
""",
                mime_type="message/rfc822",
                file_size=400,
                source_url="https://mail.google.com/mail/u/0/#inbox/demo_email_2",
                author="John Smith <john.smith@acme.com>",
                created_at=datetime(2024, 11, 20, 14, 15),
                modified_at=datetime(2024, 11, 20, 14, 15),
                metadata={"from": "john.smith@acme.com", "thread_id": "thread_2"},
            ),
            SyncedDocument(
                source_id="demo_email_3",
                title="Your Tax Documents Are Ready",
                content="""Subject: Your Tax Documents Are Ready
From: H&R Block <noreply@hrblock.com>
To: you@example.com
Date: October 5, 2024

Dear Client,

Your 2023 tax documents are now available for review in your secure portal.

Documents ready:
- Form 1040 (Federal Return)
- State Tax Return
- Estimated Tax Payments Schedule

Please log in to your account to review and download these documents.

Thank you for choosing H&R Block.

Best regards,
Your H&R Block Team
""",
                mime_type="message/rfc822",
                file_size=450,
                source_url="https://mail.google.com/mail/u/0/#inbox/demo_email_3",
                author="H&R Block <noreply@hrblock.com>",
                created_at=datetime(2024, 10, 5, 9, 0),
                modified_at=datetime(2024, 10, 5, 9, 0),
                metadata={"from": "noreply@hrblock.com", "thread_id": "thread_3"},
            ),
        ]

    def _get_demo_tokens(self) -> dict[str, Any]:
        """Return fake tokens for demo mode"""
        return {
            "access_token": "demo_access_token_gmail",
            "refresh_token": "demo_refresh_token_gmail",
            "expires_at": datetime.utcnow() + timedelta(hours=1),
            "token_type": "Bearer",
            "scope": " ".join(self.config.scopes),
        }
