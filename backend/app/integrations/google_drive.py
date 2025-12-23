"""
Google Drive Integration Connector

Connects to Google Drive via OAuth 2.0 to sync documents.
Supports both real API mode (with credentials) and demo mode (without).

Features:
- Full sync of all accessible files
- Incremental sync using change tokens
- Support for Google Docs, Sheets, Slides, PDFs, and more
- Respects file permissions
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
from app.integrations.demo_data import get_google_drive_demo_docs

logger = logging.getLogger(__name__)


class GoogleDriveConnector(BaseConnector):
    """
    Google Drive connector for syncing documents.

    Supports:
    - Google Docs (exported as plain text)
    - Google Sheets (exported as CSV)
    - Google Slides (exported as plain text)
    - PDFs, Word docs, and other file types
    """

    config = IntegrationConfig(
        provider="google_drive",
        name="Google Drive",
        description="Sync documents from Google Drive including Docs, Sheets, and uploaded files",
        icon="google-drive",
        color="#4285F4",
        scopes=[
            "https://www.googleapis.com/auth/drive.readonly",
            "https://www.googleapis.com/auth/drive.metadata.readonly",
        ],
        supports_webhooks=True,
        supports_incremental_sync=True,
        demo_available=True,
    )

    # Google API endpoints
    AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth"
    TOKEN_URL = "https://oauth2.googleapis.com/token"
    API_BASE = "https://www.googleapis.com/drive/v3"

    # MIME type mappings for export
    EXPORT_MIME_TYPES = {
        "application/vnd.google-apps.document": "text/plain",
        "application/vnd.google-apps.spreadsheet": "text/csv",
        "application/vnd.google-apps.presentation": "text/plain",
    }

    # File types we can index
    INDEXABLE_MIME_TYPES = [
        "application/vnd.google-apps.document",
        "application/vnd.google-apps.spreadsheet",
        "application/vnd.google-apps.presentation",
        "application/pdf",
        "text/plain",
        "text/markdown",
        "text/csv",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ]

    @classmethod
    def get_config(cls) -> IntegrationConfig:
        return cls.config

    @classmethod
    def is_configured(cls) -> bool:
        """Check if Google OAuth credentials are configured"""
        return bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)

    async def get_oauth_url(self, redirect_uri: str, state: str) -> str:
        """Generate Google OAuth authorization URL"""
        if self._demo_mode:
            return f"/api/integrations/google_drive/demo-callback?state={state}"

        params = {
            "client_id": settings.GOOGLE_CLIENT_ID,
            "redirect_uri": redirect_uri,
            "response_type": "code",
            "scope": " ".join(self.config.scopes),
            "access_type": "offline",
            "prompt": "consent",
            "state": state,
        }
        query = "&".join(f"{k}={v}" for k, v in params.items())
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
            logger.error(f"Google OAuth token exchange failed: {e}")
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
            logger.error(f"Google OAuth token refresh failed: {e}")
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
                    f"{self.API_BASE}/about",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params={"fields": "user"},
                )
                if response.status_code == 200:
                    self._status = ConnectorStatus.CONNECTED
                    return True
                else:
                    self._status = ConnectorStatus.ERROR
                    return False

        except Exception as e:
            logger.error(f"Google Drive connection validation failed: {e}")
            self._status = ConnectorStatus.ERROR
            return False

    async def sync_all(self) -> AsyncIterator[SyncedDocument]:
        """Sync all documents from Google Drive"""
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

                while True:
                    # Build query for indexable files
                    mime_query = " or ".join(
                        f"mimeType='{mt}'" for mt in self.INDEXABLE_MIME_TYPES
                    )
                    query = f"({mime_query}) and trashed=false"

                    params = {
                        "q": query,
                        "fields": "nextPageToken,files(id,name,mimeType,size,webViewLink,owners,createdTime,modifiedTime)",
                        "pageSize": 100,
                    }
                    if page_token:
                        params["pageToken"] = page_token

                    response = await client.get(
                        f"{self.API_BASE}/files",
                        headers={"Authorization": f"Bearer {self.access_token}"},
                        params=params,
                    )
                    response.raise_for_status()
                    data = response.json()

                    for file in data.get("files", []):
                        doc = await self._process_file(client, file)
                        if doc:
                            count += 1
                            self._log_sync_progress(count)
                            yield doc

                    page_token = data.get("nextPageToken")
                    if not page_token:
                        break

            self._status = ConnectorStatus.CONNECTED
            logger.info(f"Google Drive sync completed: {count} documents")

        except Exception as e:
            self._handle_error(e, "Full sync failed")
            raise

    async def sync_incremental(
        self,
        since: datetime | None = None,
        sync_token: str | None = None
    ) -> AsyncIterator[SyncedDocument]:
        """Sync only changed documents"""
        if self._demo_mode:
            # In demo mode, return a subset of documents as "changed"
            docs = get_google_drive_demo_docs()
            for doc in docs[:3]:  # Return first 3 as "changed"
                yield doc
            return

        # For real mode, use Google's changes API
        self._status = ConnectorStatus.SYNCING

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                if sync_token:
                    # Use the changes API with the token
                    params = {
                        "pageToken": sync_token,
                        "fields": "nextPageToken,newStartPageToken,changes(fileId,file(id,name,mimeType,size,webViewLink,owners,createdTime,modifiedTime))",
                    }
                    response = await client.get(
                        f"{self.API_BASE}/changes",
                        headers={"Authorization": f"Bearer {self.access_token}"},
                        params=params,
                    )
                    response.raise_for_status()
                    data = response.json()

                    for change in data.get("changes", []):
                        file = change.get("file")
                        if file and file.get("mimeType") in self.INDEXABLE_MIME_TYPES:
                            doc = await self._process_file(client, file)
                            if doc:
                                yield doc

                else:
                    # Fall back to modified time query
                    if since:
                        query = f"modifiedTime > '{since.isoformat()}Z' and trashed=false"
                    else:
                        query = "trashed=false"

                    params = {
                        "q": query,
                        "fields": "files(id,name,mimeType,size,webViewLink,owners,createdTime,modifiedTime)",
                        "pageSize": 100,
                    }
                    response = await client.get(
                        f"{self.API_BASE}/files",
                        headers={"Authorization": f"Bearer {self.access_token}"},
                        params=params,
                    )
                    response.raise_for_status()
                    data = response.json()

                    for file in data.get("files", []):
                        if file.get("mimeType") in self.INDEXABLE_MIME_TYPES:
                            doc = await self._process_file(client, file)
                            if doc:
                                yield doc

            self._status = ConnectorStatus.CONNECTED

        except Exception as e:
            self._handle_error(e, "Incremental sync failed")
            raise

    async def get_document(self, source_id: str) -> SyncedDocument | None:
        """Get a single document by ID"""
        if self._demo_mode:
            docs = get_google_drive_demo_docs()
            for doc in docs:
                if doc.source_id == source_id:
                    return doc
            return None

        try:
            import httpx

            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"{self.API_BASE}/files/{source_id}",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params={
                        "fields": "id,name,mimeType,size,webViewLink,owners,createdTime,modifiedTime"
                    },
                )
                if response.status_code == 404:
                    return None
                response.raise_for_status()
                file = response.json()
                return await self._process_file(client, file)

        except Exception as e:
            logger.error(f"Failed to get document {source_id}: {e}")
            return None

    async def _process_file(self, client, file: dict) -> SyncedDocument | None:
        """Process a single file and extract its content"""
        file_id = file["id"]
        mime_type = file.get("mimeType", "")

        try:
            # Get file content
            content = await self._get_file_content(client, file_id, mime_type)
            if not content:
                return None

            # Extract owner info
            owners = file.get("owners", [])
            author = owners[0].get("displayName") if owners else None

            # Parse timestamps
            created_at = None
            modified_at = None
            if file.get("createdTime"):
                created_at = datetime.fromisoformat(file["createdTime"].replace("Z", "+00:00"))
            if file.get("modifiedTime"):
                modified_at = datetime.fromisoformat(file["modifiedTime"].replace("Z", "+00:00"))

            return SyncedDocument(
                source_id=file_id,
                title=file.get("name", "Untitled"),
                content=content,
                mime_type=mime_type,
                file_size=int(file.get("size", 0)),
                source_url=file.get("webViewLink"),
                author=author,
                created_at=created_at,
                modified_at=modified_at,
                metadata={
                    "drive_id": file_id,
                    "original_mime_type": mime_type,
                },
            )

        except Exception as e:
            logger.error(f"Failed to process file {file_id}: {e}")
            return None

    async def _get_file_content(self, client, file_id: str, mime_type: str) -> str | None:
        """Get the text content of a file"""
        try:
            # Google Workspace files need to be exported
            if mime_type in self.EXPORT_MIME_TYPES:
                export_mime = self.EXPORT_MIME_TYPES[mime_type]
                response = await client.get(
                    f"{self.API_BASE}/files/{file_id}/export",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params={"mimeType": export_mime},
                )
            else:
                # Regular files can be downloaded directly
                response = await client.get(
                    f"{self.API_BASE}/files/{file_id}",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params={"alt": "media"},
                )

            if response.status_code == 200:
                content = response.text
                # Truncate very long content
                if len(content) > 100000:
                    content = content[:100000] + "\n\n[Content truncated...]"
                return content

            return None

        except Exception as e:
            logger.error(f"Failed to get content for file {file_id}: {e}")
            return None

    async def _generate_demo_documents(self) -> AsyncIterator[SyncedDocument]:
        """Generate demo documents for Google Drive"""
        docs = get_google_drive_demo_docs()
        for doc in docs:
            yield doc

    def _get_demo_tokens(self) -> dict[str, Any]:
        """Return fake tokens for demo mode"""
        return {
            "access_token": "demo_access_token_google_drive",
            "refresh_token": "demo_refresh_token_google_drive",
            "expires_at": datetime.utcnow() + timedelta(hours=1),
            "token_type": "Bearer",
            "scope": " ".join(self.config.scopes),
        }
