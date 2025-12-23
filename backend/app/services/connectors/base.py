"""Base connector class for data source integrations"""

import asyncio
from abc import ABC, abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass
from datetime import datetime


@dataclass
class Document:
    """Represents a document from an external source"""

    id: str
    name: str
    content: str
    mime_type: str
    source_url: str | None = None
    modified_at: datetime | None = None
    created_at: datetime | None = None
    size_bytes: int | None = None
    metadata: dict | None = None


@dataclass
class SyncStatus:
    """Represents sync status for a connector"""

    total_files: int = 0
    processed_files: int = 0
    failed_files: int = 0
    last_sync_at: datetime | None = None
    status: str = "idle"  # idle, syncing, completed, error
    error_message: str | None = None


class BaseConnector(ABC):
    """Abstract base class for data source connectors"""

    def __init__(self, access_token: str):
        """
        Initialize connector with access token.

        Args:
            access_token: OAuth access token for API calls
        """
        self.access_token = access_token
        self.sync_status = SyncStatus()
        self._rate_limit_delay = 0.1  # Delay between API calls in seconds

    @property
    @abstractmethod
    def connector_name(self) -> str:
        """Human-readable connector name"""
        pass

    @abstractmethod
    async def list_files(
        self,
        folder_id: str | None = None,
        recursive: bool = True,
        max_results: int | None = None,
    ) -> list[dict]:
        """
        List files from the data source.

        Args:
            folder_id: Optional folder/directory ID to list from
            recursive: Whether to recursively list subdirectories
            max_results: Maximum number of results to return

        Returns:
            List of file metadata dictionaries
        """
        pass

    @abstractmethod
    async def get_file_content(self, file_id: str) -> Document:
        """
        Get content of a specific file.

        Args:
            file_id: Unique file identifier

        Returns:
            Document object with content and metadata
        """
        pass

    async def sync_all(
        self,
        folder_id: str | None = None,
        batch_size: int = 10,
    ) -> AsyncIterator[Document]:
        """
        Sync all files from the source in batches.

        Args:
            folder_id: Optional folder to sync from
            batch_size: Number of files to process in parallel

        Yields:
            Document objects as they are processed
        """
        self.sync_status.status = "syncing"
        self.sync_status.last_sync_at = datetime.utcnow()

        try:
            # Get list of all files
            files = await self.list_files(folder_id=folder_id)
            self.sync_status.total_files = len(files)

            # Process files in batches
            for i in range(0, len(files), batch_size):
                batch = files[i : i + batch_size]

                # Process batch in parallel
                tasks = [self.get_file_content(file["id"]) for file in batch]
                results = await asyncio.gather(*tasks, return_exceptions=True)

                for result in results:
                    if isinstance(result, Exception):
                        self.sync_status.failed_files += 1
                    else:
                        self.sync_status.processed_files += 1
                        yield result

                # Rate limiting
                await asyncio.sleep(self._rate_limit_delay)

            self.sync_status.status = "completed"

        except Exception as e:
            self.sync_status.status = "error"
            self.sync_status.error_message = str(e)
            raise

    def get_sync_status(self) -> SyncStatus:
        """
        Get current sync status.

        Returns:
            SyncStatus object
        """
        return self.sync_status

    async def test_connection(self) -> bool:
        """
        Test if the connection is valid.

        Returns:
            True if connection is valid, False otherwise
        """
        try:
            files = await self.list_files(max_results=1)
            return True
        except Exception:
            return False

    def _handle_rate_limit(self, retry_after: int | None = None):
        """
        Handle rate limiting by adjusting delay.

        Args:
            retry_after: Optional seconds to wait before retrying
        """
        if retry_after:
            self._rate_limit_delay = max(self._rate_limit_delay, retry_after)
        else:
            self._rate_limit_delay = min(self._rate_limit_delay * 2, 60)  # Max 60s
