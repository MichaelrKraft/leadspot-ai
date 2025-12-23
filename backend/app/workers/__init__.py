"""
Background Workers Package

Handles asynchronous tasks:
- Document sync from external sources
- Batch ingestion operations
- Scheduled maintenance tasks
"""

from .sync_worker import SyncWorker

__all__ = ["SyncWorker"]
