"""Google Drive connector for syncing files"""

from datetime import datetime

import httpx

from .base import BaseConnector, Document


class GoogleDriveConnector(BaseConnector):
    """Connector for Google Drive files"""

    BASE_URL = "https://www.googleapis.com/drive/v3"

    @property
    def connector_name(self) -> str:
        return "Google Drive"

    async def list_files(
        self,
        folder_id: str | None = None,
        recursive: bool = True,
        max_results: int | None = None,
    ) -> list[dict]:
        """
        List files from Google Drive.

        Args:
            folder_id: Optional folder ID to list from (default: root)
            recursive: Whether to recursively list subdirectories
            max_results: Maximum number of results to return

        Returns:
            List of file metadata dictionaries
        """
        files = []
        page_token = None

        # Build query
        query_parts = ["trashed = false"]
        if folder_id:
            query_parts.append(f"'{folder_id}' in parents")

        query = " and ".join(query_parts)

        async with httpx.AsyncClient() as client:
            while True:
                params = {
                    "q": query,
                    "fields": "nextPageToken, files(id, name, mimeType, modifiedTime, createdTime, size, webViewLink, parents)",
                    "pageSize": min(max_results or 100, 1000),
                }

                if page_token:
                    params["pageToken"] = page_token

                response = await client.get(
                    f"{self.BASE_URL}/files",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params=params,
                )
                response.raise_for_status()
                data = response.json()

                batch_files = data.get("files", [])
                files.extend(batch_files)

                # Handle recursive folder listing
                if recursive:
                    for file in batch_files:
                        if file.get("mimeType") == "application/vnd.google-apps.folder":
                            subfolder_files = await self.list_files(
                                folder_id=file["id"],
                                recursive=True,
                                max_results=max_results,
                            )
                            files.extend(subfolder_files)

                page_token = data.get("nextPageToken")
                if not page_token or (max_results and len(files) >= max_results):
                    break

        return files[: max_results] if max_results else files

    async def get_file_content(self, file_id: str) -> Document:
        """
        Get content of a specific Google Drive file.

        Args:
            file_id: Google Drive file ID

        Returns:
            Document object with content and metadata
        """
        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get file metadata
            metadata_response = await client.get(
                f"{self.BASE_URL}/files/{file_id}",
                headers={"Authorization": f"Bearer {self.access_token}"},
                params={
                    "fields": "id, name, mimeType, modifiedTime, createdTime, size, webViewLink"
                },
            )
            metadata_response.raise_for_status()
            metadata = metadata_response.json()

            mime_type = metadata.get("mimeType", "")
            content = ""

            # Handle different file types
            if "vnd.google-apps" in mime_type:
                # Export Google Workspace files
                export_mime_type = self._get_export_mime_type(mime_type)
                if export_mime_type:
                    content_response = await client.get(
                        f"{self.BASE_URL}/files/{file_id}/export",
                        headers={"Authorization": f"Bearer {self.access_token}"},
                        params={"mimeType": export_mime_type},
                    )
                    content_response.raise_for_status()
                    content = content_response.text
            else:
                # Download regular files
                content_response = await client.get(
                    f"{self.BASE_URL}/files/{file_id}",
                    headers={"Authorization": f"Bearer {self.access_token}"},
                    params={"alt": "media"},
                )
                content_response.raise_for_status()
                content = content_response.text

        return Document(
            id=file_id,
            name=metadata.get("name", ""),
            content=content,
            mime_type=mime_type,
            source_url=metadata.get("webViewLink"),
            modified_at=self._parse_datetime(metadata.get("modifiedTime")),
            created_at=self._parse_datetime(metadata.get("createdTime")),
            size_bytes=int(metadata.get("size", 0)) if metadata.get("size") else None,
            metadata=metadata,
        )

    async def setup_webhook(self, webhook_url: str, channel_id: str) -> dict:
        """
        Set up a webhook for real-time file change notifications.

        Args:
            webhook_url: URL to receive webhook notifications
            channel_id: Unique channel identifier

        Returns:
            Webhook configuration details
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.BASE_URL}/changes/watch",
                headers={
                    "Authorization": f"Bearer {self.access_token}",
                    "Content-Type": "application/json",
                },
                json={
                    "id": channel_id,
                    "type": "web_hook",
                    "address": webhook_url,
                },
            )
            response.raise_for_status()
            return response.json()

    def _get_export_mime_type(self, google_mime_type: str) -> str | None:
        """
        Get appropriate export MIME type for Google Workspace files.

        Args:
            google_mime_type: Google Workspace MIME type

        Returns:
            Export MIME type or None if not exportable
        """
        export_map = {
            "application/vnd.google-apps.document": "text/plain",
            "application/vnd.google-apps.spreadsheet": "text/csv",
            "application/vnd.google-apps.presentation": "text/plain",
            "application/vnd.google-apps.drawing": "image/png",
        }
        return export_map.get(google_mime_type)

    def _parse_datetime(self, datetime_str: str | None) -> datetime | None:
        """Parse ISO datetime string to datetime object"""
        if not datetime_str:
            return None
        try:
            return datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None
