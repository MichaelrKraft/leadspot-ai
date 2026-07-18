"""
Google Drive Sync Service

Syncs documents from Google Drive to InnoSynth.ai.
Downloads files, extracts text, and indexes them for search.
"""

import logging
import os
import tempfile
import uuid
from datetime import datetime
from typing import Any

import httpx
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models import Document
from app.models.oauth_connection import OAuthConnection
from app.services import local_embedding_service, local_vector_store
from app.services.document_service import DocumentService
from app.services.encryption import get_encryption_service

logger = logging.getLogger(__name__)


class GoogleDriveSyncService:
    """Syncs documents from Google Drive."""

    # Supported file types for sync
    SUPPORTED_MIME_TYPES = {
        'application/pdf': '.pdf',
        'application/vnd.google-apps.document': '.gdoc',  # Export as docx
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'text/plain': '.txt',
        'text/markdown': '.md',
        'application/vnd.google-apps.spreadsheet': '.gsheet',  # Export as xlsx
    }

    # Google export formats for native types
    EXPORT_FORMATS = {
        'application/vnd.google-apps.document': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.google-apps.spreadsheet': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }

    def __init__(self):
        self.encryption_service = get_encryption_service()
        self.document_service = DocumentService()

    async def sync_connection(
        self,
        connection: OAuthConnection,
        db: AsyncSession,
        max_files: int = 100,
    ) -> dict[str, Any]:
        """
        Sync documents from a Google Drive connection.

        Args:
            connection: The OAuth connection to sync
            db: Database session
            max_files: Maximum number of files to sync

        Returns:
            Sync results dictionary
        """
        logger.info(f"Starting Google Drive sync for connection {connection.connection_id}")

        results = {
            "connection_id": connection.connection_id,
            "started_at": datetime.utcnow().isoformat(),
            "files_found": 0,
            "files_synced": 0,
            "files_skipped": 0,
            "errors": [],
        }

        try:
            # Decrypt access token
            access_token = self.encryption_service.decrypt(connection.access_token)

            # List files from Drive
            files = await self._list_files(access_token, max_files)
            results["files_found"] = len(files)

            # Process each file
            for file_info in files:
                try:
                    success = await self._sync_file(
                        file_info=file_info,
                        access_token=access_token,
                        connection=connection,
                        db=db,
                    )
                    if success:
                        results["files_synced"] += 1
                    else:
                        results["files_skipped"] += 1
                except Exception as e:
                    logger.error(f"Error syncing file {file_info.get('name')}: {e}")
                    results["errors"].append({
                        "file": file_info.get("name"),
                        "error": str(e),
                    })
                    results["files_skipped"] += 1

            # Update connection sync status
            connection.last_sync_at = datetime.utcnow()
            connection.last_sync_status = "success" if not results["errors"] else "partial"

            # Get total document count for this connection (not just this sync)
            from sqlalchemy import func
            total_count_result = await db.execute(
                select(func.count(Document.document_id)).where(
                    Document.organization_id == connection.organization_id,
                    Document.source_system == "google_drive",
                )
            )
            connection.documents_synced = total_count_result.scalar() or 0
            await db.commit()

            results["completed_at"] = datetime.utcnow().isoformat()
            logger.info(
                f"Google Drive sync completed: {results['files_synced']} synced, "
                f"{results['files_skipped']} skipped"
            )

        except Exception as e:
            logger.error(f"Google Drive sync failed: {e}")
            connection.last_sync_status = "error"
            await db.commit()
            results["error"] = str(e)

        return results

    async def _list_files(
        self,
        access_token: str,
        max_files: int = 100,
    ) -> list[dict[str, Any]]:
        """List files from Google Drive."""
        files = []
        page_token = None

        async with httpx.AsyncClient() as client:
            while len(files) < max_files:
                params = {
                    "pageSize": min(100, max_files - len(files)),
                    "fields": "nextPageToken, files(id, name, mimeType, modifiedTime, size, webViewLink)",
                    "q": "mimeType != 'application/vnd.google-apps.folder'",  # Exclude folders
                }
                if page_token:
                    params["pageToken"] = page_token

                response = await client.get(
                    "https://www.googleapis.com/drive/v3/files",
                    headers={"Authorization": f"Bearer {access_token}"},
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                files.extend(data.get("files", []))
                page_token = data.get("nextPageToken")

                if not page_token:
                    break

        return files

    async def _sync_file(
        self,
        file_info: dict[str, Any],
        access_token: str,
        connection: OAuthConnection,
        db: AsyncSession,
    ) -> bool:
        """
        Sync a single file from Google Drive.

        Returns True if file was synced, False if skipped.
        """
        file_id = file_info["id"]
        file_name = file_info["name"]
        mime_type = file_info["mimeType"]

        # Check if we support this file type
        if mime_type not in self.SUPPORTED_MIME_TYPES:
            logger.debug(f"Skipping unsupported file type: {mime_type} for {file_name}")
            return False

        # Check if already synced (by provider file ID)
        existing = await db.execute(
            select(Document).where(
                Document.organization_id == connection.organization_id,
                Document.source_system == "google_drive",
                Document.source_id == file_id,
            )
        )
        existing_doc = existing.scalar_one_or_none()

        # Check modification time
        remote_modified = datetime.fromisoformat(
            file_info["modifiedTime"].replace("Z", "+00:00")
        )

        if existing_doc:
            # Skip if not modified since last sync
            if existing_doc.last_modified and existing_doc.last_modified >= remote_modified:
                logger.debug(f"Skipping unchanged file: {file_name}")
                return False

        # Download file content
        content = await self._download_file(file_id, mime_type, access_token)
        if not content:
            logger.warning(f"Failed to download file: {file_name}")
            return False

        # Create or update document
        if existing_doc:
            # Update existing document
            existing_doc.content = self.encryption_service.encrypt(content)
            existing_doc.last_modified = remote_modified
        else:
            # Create new document
            doc = Document(
                document_id=str(uuid.uuid4()),
                organization_id=connection.organization_id,
                user_id=connection.user_id,
                title=file_name,
                filename=file_name,
                content=self.encryption_service.encrypt(content),
                mime_type=mime_type,
                source_system="google_drive",
                source_id=file_id,
                source_url=file_info.get("webViewLink"),
                file_size=int(file_info.get("size", 0)),
                status="uploaded",
                created_at=datetime.utcnow(),
                last_modified=remote_modified,
            )
            db.add(doc)

        await db.commit()

        # Index for search
        try:
            doc_to_index = existing_doc if existing_doc else doc
            await self._index_document(doc_to_index, content)
        except Exception as e:
            logger.error(f"Failed to index document {file_name}: {e}")

        return True

    async def _download_file(
        self,
        file_id: str,
        mime_type: str,
        access_token: str,
    ) -> str | None:
        """Download file content from Google Drive."""
        async with httpx.AsyncClient() as client:
            # Check if we need to export (for Google Docs native types)
            if mime_type in self.EXPORT_FORMATS:
                # Export as compatible format
                export_mime = self.EXPORT_FORMATS[mime_type]
                url = f"https://www.googleapis.com/drive/v3/files/{file_id}/export"
                params = {"mimeType": export_mime}
            else:
                # Direct download
                url = f"https://www.googleapis.com/drive/v3/files/{file_id}"
                params = {"alt": "media"}

            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {access_token}"},
                params=params,
            )

            if response.status_code != 200:
                logger.error(f"Failed to download file {file_id}: {response.status_code}")
                return None

            # For text files, return content directly
            if mime_type in ['text/plain', 'text/markdown']:
                return response.text

            # For binary files, save temporarily and extract text
            with tempfile.NamedTemporaryFile(delete=False, suffix=self.SUPPORTED_MIME_TYPES.get(mime_type, '.bin')) as f:
                f.write(response.content)
                temp_path = f.name

            try:
                # Use document service to extract text
                content = self.document_service.extract_text(temp_path, mime_type)
                return content
            finally:
                os.unlink(temp_path)

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
            }
        )

        # Update document status
        doc.status = "indexed"
