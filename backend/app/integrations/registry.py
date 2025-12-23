"""
Integration Registry

Central registry for all available integration connectors.
Handles connector registration, discovery, and instantiation.
"""

import logging
from typing import Optional

from app.integrations.base import BaseConnector, ConnectorStatus

logger = logging.getLogger(__name__)

# Singleton registry instance
_registry: Optional["IntegrationRegistry"] = None


class IntegrationRegistry:
    """
    Registry for integration connectors.

    Usage:
        registry = get_registry()
        connectors = registry.list_available()
        connector = registry.get_connector("google_drive", org_id)
    """

    def __init__(self):
        self._connectors: dict[str, type[BaseConnector]] = {}
        self._initialized = False

    def register(self, connector_class: type[BaseConnector]) -> None:
        """
        Register a connector class.

        Args:
            connector_class: The connector class to register
        """
        config = connector_class.get_config()
        provider = config.provider
        self._connectors[provider] = connector_class
        logger.info(f"Registered integration: {provider}")

    def get_connector_class(self, provider: str) -> type[BaseConnector] | None:
        """Get a connector class by provider name"""
        return self._connectors.get(provider)

    def get_connector(
        self,
        provider: str,
        organization_id: str,
        access_token: str | None = None,
        refresh_token: str | None = None,
        force_demo: bool = False
    ) -> BaseConnector | None:
        """
        Get an instantiated connector for a provider.

        Args:
            provider: Provider name (e.g., "google_drive")
            organization_id: The organization ID
            access_token: OAuth access token (if already connected)
            refresh_token: OAuth refresh token (if already connected)
            force_demo: Force demo mode even if credentials available

        Returns:
            Instantiated connector or None if provider not found
        """
        connector_class = self._connectors.get(provider)
        if not connector_class:
            logger.warning(f"Unknown integration provider: {provider}")
            return None

        # Determine if we should run in demo mode
        demo_mode = force_demo or not connector_class.is_configured()

        return connector_class(
            organization_id=organization_id,
            access_token=access_token,
            refresh_token=refresh_token,
            demo_mode=demo_mode
        )

    def list_available(self) -> list[dict]:
        """
        List all available integrations with their status.

        Returns:
            List of integration info dictionaries
        """
        integrations = []

        for provider, connector_class in self._connectors.items():
            config = connector_class.get_config()
            is_configured = connector_class.is_configured()

            integrations.append({
                "provider": config.provider,
                "name": config.name,
                "description": config.description,
                "icon": config.icon,
                "color": config.color,
                "is_configured": is_configured,
                "demo_available": config.demo_available,
                "supports_webhooks": config.supports_webhooks,
                "status": ConnectorStatus.NOT_CONFIGURED.value if not is_configured else ConnectorStatus.DISCONNECTED.value
            })

        return integrations

    def list_providers(self) -> list[str]:
        """Get list of registered provider names"""
        return list(self._connectors.keys())

    def _initialize(self) -> None:
        """Initialize the registry with all available connectors"""
        if self._initialized:
            return

        # Import and register all connectors
        # Mautic connector will be registered here once implemented
        try:
            from app.integrations.mautic import MauticConnector
            self.register(MauticConnector)
        except ImportError as e:
            logger.debug(f"Mautic connector not yet available: {e}")

        self._initialized = True
        logger.info(f"Integration registry initialized with {len(self._connectors)} connectors")


def get_registry() -> IntegrationRegistry:
    """Get the singleton registry instance"""
    global _registry
    if _registry is None:
        _registry = IntegrationRegistry()
        _registry._initialize()
    return _registry
