"""
Mautic CRM Connector

Connects to user's Mautic instance for CRM data sync and actions.
Supports OAuth2 authentication and full contact/campaign management.
"""

import logging
import os
from collections.abc import AsyncIterator
from datetime import datetime, timedelta
from typing import Any

import httpx

from app.integrations.base import (
    BaseConnector,
    ConnectorStatus,
    IntegrationConfig,
    SyncedDocument,
)

logger = logging.getLogger(__name__)


class MauticConnector(BaseConnector):
    """
    Mautic CRM connector for LeadSpot.ai.

    Syncs contacts, emails, and campaigns from user's Mautic instance.
    Supports both live OAuth2 authentication and demo mode.
    """

    config = IntegrationConfig(
        provider="mautic",
        name="Mautic CRM",
        description="Connect your Mautic CRM to sync contacts and manage campaigns",
        icon="mautic",
        color="#4e5e9e",  # Mautic purple
        scopes=["full_access"],  # Mautic uses simple OAuth2
        supports_webhooks=True,
        supports_incremental_sync=True,
        demo_available=True,
    )

    def __init__(
        self,
        organization_id: str,
        access_token: str | None = None,
        refresh_token: str | None = None,
        demo_mode: bool = False,
        mautic_url: str | None = None,
        client_id: str | None = None,
        client_secret: str | None = None,
    ):
        super().__init__(organization_id, access_token, refresh_token, demo_mode)
        self.mautic_url = mautic_url.rstrip("/") if mautic_url else None
        self.client_id = client_id
        self.client_secret = client_secret

    @classmethod
    def get_config(cls) -> IntegrationConfig:
        """Return the configuration for this connector"""
        return cls.config

    @classmethod
    def is_configured(cls) -> bool:
        """
        Check if Mautic credentials are configured.

        Note: For Mautic, configuration is per-organization, not global.
        This returns True if the default/demo credentials exist.
        """
        # Mautic is configured per-organization, so we check for demo availability
        return cls.config.demo_available

    async def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        """
        Generate OAuth authorization URL for Mautic.

        Args:
            redirect_uri: Where to redirect after OAuth
            state: CSRF protection state parameter

        Returns:
            Authorization URL to redirect user to
        """
        if not self.mautic_url or not self.client_id:
            raise ValueError("Mautic URL and client_id must be set")

        params = {
            "client_id": self.client_id,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "state": state,
        }

        query_string = "&".join(f"{k}={v}" for k, v in params.items())
        return f"{self.mautic_url}/oauth/v2/authorize?{query_string}"

    async def exchange_code(self, code: str, redirect_uri: str) -> dict[str, Any]:
        """
        Exchange OAuth authorization code for tokens.

        Args:
            code: Authorization code from OAuth callback
            redirect_uri: Must match the redirect_uri used in get_oauth_url

        Returns:
            Dictionary with access_token, refresh_token, expires_at, etc.
        """
        if not self.mautic_url or not self.client_id or not self.client_secret:
            raise ValueError("Mautic URL, client_id, and client_secret must be set")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.mautic_url}/oauth/v2/token",
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                    "redirect_uri": redirect_uri,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                logger.error(f"Mautic OAuth error: {response.text}")
                raise Exception(f"Failed to exchange code: {response.status_code}")

            data = response.json()

            # Calculate expiration time
            expires_in = data.get("expires_in", 3600)
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

            self.access_token = data["access_token"]
            self.refresh_token = data.get("refresh_token")
            self._status = ConnectorStatus.CONNECTED

            return {
                "access_token": data["access_token"],
                "refresh_token": data.get("refresh_token"),
                "expires_at": expires_at,
                "token_type": data.get("token_type", "Bearer"),
            }

    async def refresh_access_token(self) -> dict[str, Any]:
        """
        Refresh the access token using the refresh token.

        Returns:
            Dictionary with new access_token, expires_at, etc.
        """
        if not self.mautic_url or not self.client_id or not self.client_secret:
            raise ValueError("Mautic URL, client_id, and client_secret must be set")

        if not self.refresh_token:
            raise ValueError("No refresh token available")

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.mautic_url}/oauth/v2/token",
                data={
                    "grant_type": "refresh_token",
                    "refresh_token": self.refresh_token,
                    "client_id": self.client_id,
                    "client_secret": self.client_secret,
                },
                headers={"Content-Type": "application/x-www-form-urlencoded"},
            )

            if response.status_code != 200:
                logger.error(f"Mautic token refresh error: {response.text}")
                self._status = ConnectorStatus.ERROR
                raise Exception(f"Failed to refresh token: {response.status_code}")

            data = response.json()

            expires_in = data.get("expires_in", 3600)
            expires_at = datetime.utcnow() + timedelta(seconds=expires_in)

            self.access_token = data["access_token"]
            self.refresh_token = data.get("refresh_token", self.refresh_token)
            self._status = ConnectorStatus.CONNECTED

            return {
                "access_token": data["access_token"],
                "refresh_token": self.refresh_token,
                "expires_at": expires_at,
            }

    async def validate_connection(self) -> bool:
        """
        Validate that the current tokens are valid.

        Returns:
            True if connection is valid, False otherwise
        """
        if self._demo_mode:
            return True

        if not self.access_token or not self.mautic_url:
            return False

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.mautic_url}/api/contacts",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params={"limit": 1},
                )

                if response.status_code == 200:
                    self._status = ConnectorStatus.CONNECTED
                    return True
                elif response.status_code == 401:
                    # Try to refresh token
                    try:
                        await self.refresh_access_token()
                        return True
                    except Exception:
                        self._status = ConnectorStatus.ERROR
                        return False
                else:
                    self._status = ConnectorStatus.ERROR
                    return False

        except Exception as e:
            logger.error(f"Mautic connection validation error: {e}")
            self._status = ConnectorStatus.ERROR
            return False

    async def sync_all(self) -> AsyncIterator[SyncedDocument]:
        """
        Perform a full sync of all contacts.

        Yields:
            SyncedDocument objects one at a time (memory efficient)
        """
        if self._demo_mode:
            async for doc in self._generate_demo_documents():
                yield doc
            return

        self._status = ConnectorStatus.SYNCING

        try:
            # Sync contacts
            async for doc in self._sync_contacts():
                yield doc

            self._status = ConnectorStatus.CONNECTED

        except Exception as e:
            self._handle_error(e, "sync_all")
            raise

    async def sync_incremental(
        self,
        since: datetime | None = None,
        sync_token: str | None = None
    ) -> AsyncIterator[SyncedDocument]:
        """
        Perform incremental sync of changed contacts.

        Args:
            since: Only sync contacts modified after this time
            sync_token: Not used for Mautic (uses date-based filtering)

        Yields:
            SyncedDocument objects one at a time
        """
        if self._demo_mode:
            async for doc in self._generate_demo_documents():
                yield doc
            return

        self._status = ConnectorStatus.SYNCING

        try:
            async for doc in self._sync_contacts(since=since):
                yield doc

            self._status = ConnectorStatus.CONNECTED

        except Exception as e:
            self._handle_error(e, "sync_incremental")
            raise

    async def get_document(self, source_id: str) -> SyncedDocument | None:
        """
        Get a single contact by its Mautic ID.

        Args:
            source_id: The Mautic contact ID

        Returns:
            SyncedDocument or None if not found
        """
        if self._demo_mode:
            return self._create_demo_contact(source_id)

        if not self.access_token or not self.mautic_url:
            return None

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.mautic_url}/api/contacts/{source_id}",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                )

                if response.status_code != 200:
                    return None

                data = response.json()
                contact = data.get("contact", {})

                return self._contact_to_document(contact)

        except Exception as e:
            logger.error(f"Error getting contact {source_id}: {e}")
            return None

    # =========================================================================
    # Mautic-Specific API Methods
    # =========================================================================

    async def get_contacts(
        self,
        limit: int = 100,
        offset: int = 0,
        search: str | None = None
    ) -> dict[str, Any]:
        """
        Get contacts from Mautic.

        Args:
            limit: Maximum number of contacts to return
            offset: Starting offset for pagination
            search: Optional search query

        Returns:
            Dictionary with contacts data
        """
        if self._demo_mode:
            return self._generate_demo_contacts_response(limit)

        if not self.access_token or not self.mautic_url:
            raise ValueError("Not connected to Mautic")

        params = {"limit": limit, "start": offset}
        if search:
            params["search"] = search

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.mautic_url}/api/contacts",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params=params,
            )

            if response.status_code != 200:
                raise Exception(f"Failed to get contacts: {response.status_code}")

            return response.json()

    async def get_contact_activity(self, contact_id: str) -> list[dict]:
        """
        Get activity timeline for a specific contact.

        Args:
            contact_id: Mautic contact ID

        Returns:
            List of activity events
        """
        if self._demo_mode:
            return self._generate_demo_activity()

        if not self.access_token or not self.mautic_url:
            raise ValueError("Not connected to Mautic")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.mautic_url}/api/contacts/{contact_id}/activity",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )

            if response.status_code != 200:
                return []

            return response.json().get("events", [])

    # =========================================================================
    # Private Helper Methods
    # =========================================================================

    async def _sync_contacts(
        self,
        since: datetime | None = None
    ) -> AsyncIterator[SyncedDocument]:
        """Sync all contacts from Mautic."""
        if not self.access_token or not self.mautic_url:
            return

        page = 0
        page_size = 100
        count = 0

        async with httpx.AsyncClient() as client:
            while True:
                params = {
                    "start": page * page_size,
                    "limit": page_size,
                }

                if since:
                    # Mautic uses dateModified filter
                    params["search"] = f"dateModified:>={since.strftime('%Y-%m-%d')}"

                response = await client.get(
                    f"{self.mautic_url}/api/contacts",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params,
                )

                if response.status_code != 200:
                    logger.error(f"Mautic API error: {response.status_code}")
                    break

                data = response.json()
                contacts = data.get("contacts", {})

                if not contacts:
                    break

                for contact_id, contact in contacts.items():
                    doc = self._contact_to_document(contact)
                    if doc:
                        yield doc
                        count += 1
                        if count % 100 == 0:
                            self._log_sync_progress(count)

                page += 1

                # Check if we've reached the end
                total = data.get("total", 0)
                if count >= total:
                    break

        logger.info(f"[mautic] Completed sync: {count} contacts")

    def _contact_to_document(self, contact: dict) -> SyncedDocument | None:
        """Convert Mautic contact to searchable document."""
        if not contact:
            return None

        fields = contact.get("fields", {}).get("all", {})
        if not fields:
            # Try direct field access (depends on Mautic version)
            fields = contact.get("fields", contact)

        firstname = fields.get("firstname", "") or ""
        lastname = fields.get("lastname", "") or ""
        email = fields.get("email", "") or ""
        company = fields.get("company", "") or ""
        phone = fields.get("phone", "") or ""

        # Get tags
        tags = []
        if "tags" in contact:
            tags = [t.get("tag", t) if isinstance(t, dict) else t for t in contact.get("tags", [])]

        # Build searchable content
        content_parts = [
            f"Name: {firstname} {lastname}".strip(),
            f"Email: {email}",
            f"Company: {company}" if company else "",
            f"Phone: {phone}" if phone else "",
            f"Tags: {', '.join(tags)}" if tags else "",
            f"Points: {contact.get('points', 0)}",
            f"Last Active: {contact.get('lastActive', 'Never')}",
        ]

        # Add custom fields
        for key, value in fields.items():
            if key not in ["firstname", "lastname", "email", "company", "phone"] and value:
                content_parts.append(f"{key}: {value}")

        content = "\n".join(part for part in content_parts if part)

        # Parse dates
        created_at = None
        modified_at = None
        if contact.get("dateAdded"):
            try:
                created_at = datetime.fromisoformat(contact["dateAdded"].replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass
        if contact.get("dateModified"):
            try:
                modified_at = datetime.fromisoformat(contact["dateModified"].replace("Z", "+00:00"))
            except (ValueError, AttributeError):
                pass

        return SyncedDocument(
            source_id=str(contact.get("id", "")),
            title=f"{firstname} {lastname}".strip() or email or "Unknown Contact",
            content=content,
            mime_type="application/vnd.mautic.contact",
            file_size=len(content),
            source_url=f"{self.mautic_url}/s/contacts/view/{contact.get('id')}" if self.mautic_url else None,
            author=None,
            created_at=created_at,
            modified_at=modified_at,
            metadata={
                "email": email,
                "company": company,
                "tags": tags,
                "points": contact.get("points", 0),
                "contact_id": str(contact.get("id", "")),
            }
        )

    # =========================================================================
    # Demo Mode Methods
    # =========================================================================

    async def _generate_demo_documents(self) -> AsyncIterator[SyncedDocument]:
        """Generate realistic demo contacts."""
        demo_contacts = [
            {
                "id": 1,
                "fields": {"all": {
                    "firstname": "John",
                    "lastname": "Smith",
                    "email": "john.smith@example.com",
                    "company": "Acme Corp",
                    "phone": "+1-555-0101",
                }},
                "tags": [{"tag": "hot-lead"}, {"tag": "enterprise"}],
                "points": 85,
                "lastActive": "2025-12-20T14:30:00Z",
                "dateAdded": "2025-11-15T09:00:00Z",
                "dateModified": "2025-12-20T14:30:00Z",
            },
            {
                "id": 2,
                "fields": {"all": {
                    "firstname": "Sarah",
                    "lastname": "Johnson",
                    "email": "sarah.j@techstartup.io",
                    "company": "TechStartup",
                    "phone": "+1-555-0102",
                }},
                "tags": [{"tag": "newsletter"}, {"tag": "webinar-attended"}],
                "points": 42,
                "lastActive": "2025-12-18T10:15:00Z",
                "dateAdded": "2025-10-01T12:00:00Z",
                "dateModified": "2025-12-18T10:15:00Z",
            },
            {
                "id": 3,
                "fields": {"all": {
                    "firstname": "Mike",
                    "lastname": "Davis",
                    "email": "mike.davis@bigcorp.com",
                    "company": "BigCorp International",
                    "phone": "+1-555-0103",
                }},
                "tags": [{"tag": "demo-requested"}, {"tag": "decision-maker"}],
                "points": 120,
                "lastActive": "2025-12-22T09:00:00Z",
                "dateAdded": "2025-09-20T15:30:00Z",
                "dateModified": "2025-12-22T09:00:00Z",
            },
        ]

        for contact in demo_contacts:
            doc = self._contact_to_document(contact)
            if doc:
                yield doc

    def _create_demo_contact(self, source_id: str) -> SyncedDocument:
        """Create a demo contact for a specific ID."""
        return SyncedDocument(
            source_id=source_id,
            title="Demo Contact",
            content="Name: Demo User\nEmail: demo@example.com\nCompany: Demo Company",
            mime_type="application/vnd.mautic.contact",
            file_size=100,
            source_url=None,
            author=None,
            created_at=datetime.utcnow(),
            modified_at=datetime.utcnow(),
            metadata={
                "email": "demo@example.com",
                "company": "Demo Company",
                "tags": ["demo"],
                "points": 50,
                "contact_id": source_id,
            }
        )

    def _generate_demo_contacts_response(self, limit: int) -> dict[str, Any]:
        """Generate demo response for get_contacts."""
        return {
            "total": 3,
            "contacts": {
                "1": {
                    "id": 1,
                    "fields": {"all": {
                        "firstname": "John",
                        "lastname": "Smith",
                        "email": "john.smith@example.com",
                    }},
                    "points": 85,
                },
                "2": {
                    "id": 2,
                    "fields": {"all": {
                        "firstname": "Sarah",
                        "lastname": "Johnson",
                        "email": "sarah.j@techstartup.io",
                    }},
                    "points": 42,
                },
                "3": {
                    "id": 3,
                    "fields": {"all": {
                        "firstname": "Mike",
                        "lastname": "Davis",
                        "email": "mike.davis@bigcorp.com",
                    }},
                    "points": 120,
                },
            }
        }

    def _generate_demo_activity(self) -> list[dict]:
        """Generate demo activity timeline."""
        return [
            {
                "event": "email.read",
                "timestamp": "2025-12-20T14:30:00Z",
                "details": {"email": "Welcome Email"},
            },
            {
                "event": "page.hit",
                "timestamp": "2025-12-19T10:15:00Z",
                "details": {"page": "Pricing Page"},
            },
            {
                "event": "form.submit",
                "timestamp": "2025-12-15T09:00:00Z",
                "details": {"form": "Contact Form"},
            },
        ]
