"""SharePoint connector for syncing files via Microsoft Graph API"""

from datetime import datetime

import httpx

from .base import BaseConnector, Document


class SharePointConnector(BaseConnector):
    """Connector for Microsoft SharePoint files via Graph API"""

    BASE_URL = "https://graph.microsoft.com/v1.0"

    def __init__(self, access_token: str, site_id: str | None = None):
        """
        Initialize SharePoint connector.

        Args:
            access_token: OAuth access token
            site_id: Optional specific SharePoint site ID
        """
        super().__init__(access_token)
        self.site_id = site_id

    @property
    def connector_name(self) -> str:
        return "Microsoft SharePoint"

    async def list_sites(self) -> list[dict]:
        """
        List all accessible SharePoint sites.

        Returns:
            List of site metadata
        """
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/sites?search=*",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("value", [])

    async def list_drives(self, site_id: str | None = None) -> list[dict]:
        """
        List document libraries (drives) in a SharePoint site.

        Args:
            site_id: SharePoint site ID (uses default if not provided)

        Returns:
            List of drive metadata
        """
        site_id = site_id or self.site_id
        if not site_id:
            raise ValueError("site_id must be provided")

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/sites/{site_id}/drives",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            response.raise_for_status()
            data = response.json()
            return data.get("value", [])

    async def list_files(
        self,
        folder_id: str | None = None,
        recursive: bool = True,
        max_results: int | None = None,
    ) -> list[dict]:
        """
        List files from SharePoint.

        Args:
            folder_id: Optional drive ID (if None, lists from all drives)
            recursive: Whether to recursively list subdirectories
            max_results: Maximum number of results to return

        Returns:
            List of file metadata dictionaries
        """
        files = []

        # If no folder_id, list from all drives
        if not folder_id:
            drives = await self.list_drives()
            for drive in drives:
                drive_files = await self._list_drive_files(
                    drive["id"], recursive=recursive
                )
                files.extend(drive_files)
                if max_results and len(files) >= max_results:
                    break
        else:
            files = await self._list_drive_files(folder_id, recursive=recursive)

        return files[: max_results] if max_results else files

    async def _list_drive_files(
        self, drive_id: str, item_id: str = "root", recursive: bool = True
    ) -> list[dict]:
        """
        List files from a specific drive.

        Args:
            drive_id: Drive ID
            item_id: Item ID to list from (default: root)
            recursive: Whether to recursively list subdirectories

        Returns:
            List of file metadata
        """
        files = []

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.BASE_URL}/drives/{drive_id}/items/{item_id}/children",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            response.raise_for_status()
            data = response.json()

            items = data.get("value", [])

            for item in items:
                # Add file to list
                files.append(
                    {
                        "id": item["id"],
                        "name": item["name"],
                        "mimeType": item.get("file", {}).get("mimeType", ""),
                        "drive_id": drive_id,
                        "webUrl": item.get("webUrl"),
                        "size": item.get("size"),
                        "createdDateTime": item.get("createdDateTime"),
                        "lastModifiedDateTime": item.get("lastModifiedDateTime"),
                        "is_folder": "folder" in item,
                    }
                )

                # Recursively list folders
                if recursive and "folder" in item:
                    subfolder_files = await self._list_drive_files(
                        drive_id, item["id"], recursive=True
                    )
                    files.extend(subfolder_files)

        return files

    async def get_file_content(self, file_id: str, drive_id: str | None = None) -> Document:
        """
        Get content of a specific SharePoint file.

        Args:
            file_id: File ID
            drive_id: Drive ID (required if file_id is not a full path)

        Returns:
            Document object with content and metadata
        """
        if not drive_id:
            raise ValueError("drive_id must be provided")

        async with httpx.AsyncClient(timeout=30.0) as client:
            # Get file metadata
            metadata_response = await client.get(
                f"{self.BASE_URL}/drives/{drive_id}/items/{file_id}",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            metadata_response.raise_for_status()
            metadata = metadata_response.json()

            # Download file content
            content_response = await client.get(
                f"{self.BASE_URL}/drives/{drive_id}/items/{file_id}/content",
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            content_response.raise_for_status()
            content = content_response.text

        return Document(
            id=file_id,
            name=metadata.get("name", ""),
            content=content,
            mime_type=metadata.get("file", {}).get("mimeType", ""),
            source_url=metadata.get("webUrl"),
            modified_at=self._parse_datetime(metadata.get("lastModifiedDateTime")),
            created_at=self._parse_datetime(metadata.get("createdDateTime")),
            size_bytes=metadata.get("size"),
            metadata={**metadata, "drive_id": drive_id},
        )

    async def get_delta_changes(
        self, drive_id: str, delta_token: str | None = None
    ) -> dict:
        """
        Get changes since last sync using delta query.

        Args:
            drive_id: Drive ID
            delta_token: Optional delta token from previous sync

        Returns:
            Dictionary with changes and new delta token
        """
        async with httpx.AsyncClient() as client:
            if delta_token:
                url = delta_token  # Delta token is a full URL
            else:
                url = f"{self.BASE_URL}/drives/{drive_id}/root/delta"

            response = await client.get(
                url,
                headers={"Authorization": f"Bearer {self.access_token}"},
            )
            response.raise_for_status()
            data = response.json()

            return {
                "changes": data.get("value", []),
                "delta_token": data.get("@odata.deltaLink"),
                "next_link": data.get("@odata.nextLink"),
            }

    def _parse_datetime(self, datetime_str: str | None) -> datetime | None:
        """Parse ISO datetime string to datetime object"""
        if not datetime_str:
            return None
        try:
            return datetime.fromisoformat(datetime_str.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            return None
