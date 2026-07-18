"""Sync services for external integrations.

Provider imports are individually guarded: a provider whose dependencies are
missing (e.g. gmail_sync's connectors module) must not break the package for
the providers that do work.
"""

import logging

logger = logging.getLogger(__name__)

__all__ = []

try:
    from .gmail_sync import GmailSyncService
    __all__.append("GmailSyncService")
except ImportError as e:  # pragma: no cover
    logger.warning(f"GmailSyncService unavailable: {e}")

try:
    from .google_drive_sync import GoogleDriveSyncService
    __all__.append("GoogleDriveSyncService")
except ImportError as e:  # pragma: no cover
    logger.warning(f"GoogleDriveSyncService unavailable: {e}")

try:
    from .outlook_sync import OutlookSyncService
    __all__.append("OutlookSyncService")
except ImportError as e:  # pragma: no cover
    logger.warning(f"OutlookSyncService unavailable: {e}")

try:
    from .salesforce_sync import SalesforceSyncService
    __all__.append("SalesforceSyncService")
except ImportError as e:  # pragma: no cover
    logger.warning(f"SalesforceSyncService unavailable: {e}")
