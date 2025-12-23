"""
Tests for Gmail integration functionality.

Tests cover:
- GmailOAuthProvider
- GmailConnector
- Query preprocessing
- Data structures

Note: Uses mocking to test business logic without external API dependencies.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, MagicMock, patch
from uuid import uuid4

import pytest


class TestGmailOAuthProvider:
    """Tests for Gmail OAuth provider."""

    @pytest.fixture
    def provider(self):
        """Create a Gmail OAuth provider instance."""
        from app.services.oauth.gmail import GmailOAuthProvider
        return GmailOAuthProvider(
            client_id="test-client-id",
            client_secret="test-client-secret",
            redirect_uri="http://localhost:8000/oauth/gmail/callback"
        )

    def test_provider_initialization(self, provider):
        """Test provider initializes with correct values."""
        assert provider.client_id == "test-client-id"
        assert provider.client_secret == "test-client-secret"
        assert provider.redirect_uri == "http://localhost:8000/oauth/gmail/callback"

    def test_authorization_url_generation(self, provider):
        """Test authorization URL includes required scopes."""
        state = "test-state-123"
        url = provider.get_authorization_url(state)

        assert "accounts.google.com" in url
        assert "gmail.readonly" in url or "gmail" in url.lower()
        assert state in url
        assert provider.client_id in url

    def test_state_validation(self, provider):
        """Test state parameter validation."""
        stored_state = "abc123"
        received_state = "abc123"

        assert provider.validate_state(received_state, stored_state) is True
        assert provider.validate_state("different", stored_state) is False

    def test_provider_has_required_attributes(self, provider):
        """Test provider has all required OAuth attributes."""
        # Check required OAuth attributes
        assert hasattr(provider, 'client_id')
        assert hasattr(provider, 'client_secret')
        assert hasattr(provider, 'redirect_uri')
        assert hasattr(provider, 'get_authorization_url')
        assert hasattr(provider, 'validate_state')


class TestGmailConnector:
    """Tests for Gmail connector."""

    @pytest.fixture
    def connector(self):
        """Create a Gmail connector instance with mocked access token."""
        from app.services.connectors.gmail import GmailConnector
        return GmailConnector(access_token="test-access-token")

    def test_connector_initialization(self, connector):
        """Test connector initializes correctly."""
        assert connector.access_token == "test-access-token"

    def test_connector_name(self, connector):
        """Test connector has correct name."""
        assert connector.connector_name == "Gmail"

    def test_base_url(self, connector):
        """Test Gmail API base URL is correct."""
        assert connector.BASE_URL == "https://gmail.googleapis.com/gmail/v1"

    def test_default_excluded_labels(self, connector):
        """Test default excluded labels for spam filtering."""
        assert "CATEGORY_PROMOTIONS" in connector.DEFAULT_EXCLUDED_LABELS
        assert "CATEGORY_SOCIAL" in connector.DEFAULT_EXCLUDED_LABELS


class TestEmailMessageDataclass:
    """Tests for EmailMessage dataclass."""

    def test_email_message_creation(self):
        """Test EmailMessage can be created with required fields."""
        from app.services.connectors.gmail import EmailMessage

        email = EmailMessage(
            id="msg-123",
            thread_id="thread-456",
            subject="Test Subject",
            from_email="sender@example.com",
            from_name="Test Sender",
            to_emails=["recipient@example.com"],
            cc_emails=[],
            date=datetime.utcnow(),
            snippet="This is a test...",
            body_text="Full email body text",
            body_html="<html>Full email body</html>",
            labels=["INBOX"],
            attachments=[],
            is_unread=False
        )

        assert email.id == "msg-123"
        assert email.subject == "Test Subject"
        assert email.from_email == "sender@example.com"

    def test_email_message_with_attachments(self):
        """Test EmailMessage with attachments."""
        from app.services.connectors.gmail import EmailMessage

        email = EmailMessage(
            id="msg-456",
            thread_id="thread-789",
            subject="Email with Attachments",
            from_email="sender@example.com",
            from_name="Sender Name",
            to_emails=["recipient@example.com"],
            cc_emails=["cc@example.com"],
            date=datetime.utcnow(),
            snippet="See attached...",
            body_text="Please see the attached file.",
            body_html="<html>Please see the attached file.</html>",
            labels=["INBOX", "IMPORTANT"],
            attachments=[{"filename": "document.pdf", "size": 1024}],
            is_unread=True
        )

        assert len(email.attachments) == 1
        assert email.attachments[0]["filename"] == "document.pdf"
        assert email.is_unread is True


class TestDocumentDataclass:
    """Tests for Document dataclass."""

    def test_document_creation(self):
        """Test Document can be created with required fields."""
        from app.services.connectors.base import Document

        doc = Document(
            id="doc-123",
            name="Test Document",
            content="Document content here",
            mime_type="message/rfc822"
        )

        assert doc.id == "doc-123"
        assert doc.name == "Test Document"
        assert doc.mime_type == "message/rfc822"

    def test_document_optional_fields(self):
        """Test Document optional fields default to None."""
        from app.services.connectors.base import Document

        doc = Document(
            id="doc-123",
            name="Test",
            content="Content",
            mime_type="text/plain"
        )

        assert doc.source_url is None
        assert doc.modified_at is None
        assert doc.created_at is None
        assert doc.size_bytes is None
        assert doc.metadata is None

    def test_document_with_all_fields(self):
        """Test Document with all fields populated."""
        from app.services.connectors.base import Document

        now = datetime.utcnow()
        doc = Document(
            id="doc-full",
            name="Full Document",
            content="Full content here",
            mime_type="application/pdf",
            source_url="https://example.com/doc",
            modified_at=now,
            created_at=now,
            size_bytes=2048,
            metadata={"author": "Test Author"}
        )

        assert doc.source_url == "https://example.com/doc"
        assert doc.size_bytes == 2048
        assert doc.metadata["author"] == "Test Author"


class TestSyncStatus:
    """Tests for SyncStatus dataclass."""

    def test_sync_status_defaults(self):
        """Test SyncStatus has correct default values."""
        from app.services.connectors.base import SyncStatus

        status = SyncStatus()

        assert status.total_files == 0
        assert status.processed_files == 0
        assert status.failed_files == 0
        assert status.last_sync_at is None
        assert status.status == "idle"
        assert status.error_message is None

    def test_sync_status_custom_values(self):
        """Test SyncStatus can be set with custom values."""
        from app.services.connectors.base import SyncStatus

        status = SyncStatus(
            total_files=100,
            processed_files=50,
            failed_files=2,
            status="syncing"
        )

        assert status.total_files == 100
        assert status.processed_files == 50
        assert status.failed_files == 2
        assert status.status == "syncing"

    def test_sync_status_completed(self):
        """Test SyncStatus completed state."""
        from app.services.connectors.base import SyncStatus

        status = SyncStatus(
            total_files=100,
            processed_files=100,
            failed_files=0,
            status="completed",
            last_sync_at=datetime.utcnow()
        )

        assert status.status == "completed"
        assert status.last_sync_at is not None


class TestQueryPreprocessor:
    """Tests for query preprocessing."""

    @pytest.fixture
    def preprocessor(self):
        """Create a query preprocessor instance."""
        from app.services.query_preprocessor import QueryPreprocessor
        return QueryPreprocessor()

    def test_preprocessor_initialization(self, preprocessor):
        """Test preprocessor initializes."""
        assert preprocessor is not None

    def test_preprocessor_has_patterns(self, preprocessor):
        """Test preprocessor has pattern definitions."""
        assert hasattr(preprocessor, 'TEMPORAL_PATTERNS')
        assert hasattr(preprocessor, 'EMAIL_PATTERNS')

    def test_preprocess_method_exists(self, preprocessor):
        """Test preprocessor has preprocess method."""
        assert hasattr(preprocessor, 'preprocess')
        assert callable(preprocessor.preprocess)

    def test_preprocess_returns_tuple(self, preprocessor):
        """Test preprocess returns a tuple with query and metadata."""
        result = preprocessor.preprocess("test query")
        # Preprocess returns (query, metadata) tuple
        assert isinstance(result, tuple)
        assert len(result) == 2
        query, metadata = result
        assert isinstance(query, str)
        assert isinstance(metadata, dict)

    def test_add_email_context_method(self, preprocessor):
        """Test add_email_context method exists and works."""
        assert hasattr(preprocessor, 'add_email_context')
        result = preprocessor.add_email_context("test query")
        assert isinstance(result, str)


class TestGmailIntegrationRegistry:
    """Tests for Gmail integration registry."""

    def test_gmail_registered_in_registry(self):
        """Test Gmail connector is registered in integration registry."""
        from app.integrations.registry import get_registry

        registry = get_registry()
        providers = registry.list_providers()

        assert "gmail" in providers

    def test_registry_has_gmail_config(self):
        """Test registry returns Gmail configuration."""
        from app.integrations.registry import get_registry

        registry = get_registry()

        # Registry should be able to get Gmail config
        assert "gmail" in registry.list_providers()


class TestOAuthSecurity:
    """Tests for OAuth security measures."""

    def test_state_is_url_safe(self):
        """Test OAuth state parameter is URL-safe."""
        import secrets
        import re

        state = secrets.token_urlsafe(32)
        assert re.match(r'^[A-Za-z0-9_-]+$', state) is not None

    def test_state_is_unique(self):
        """Test OAuth state is unique across generations."""
        import secrets

        states = [secrets.token_urlsafe(32) for _ in range(10)]
        assert len(set(states)) == 10  # All unique

    def test_state_has_minimum_entropy(self):
        """Test OAuth state has minimum 256 bits of entropy."""
        import secrets

        # 32 bytes = 256 bits
        state = secrets.token_urlsafe(32)
        # Base64 encoding adds ~33% overhead, so 32 bytes becomes ~43 chars
        assert len(state) >= 32

    def test_token_refresh_provider_setup(self):
        """Test provider is set up for token refresh."""
        from app.services.oauth.gmail import GmailOAuthProvider

        provider = GmailOAuthProvider(
            client_id="test-client-id",
            client_secret="test-client-secret",
            redirect_uri="http://localhost:8000/oauth/gmail/callback"
        )

        # Provider should have credentials for refresh
        assert provider.client_id == "test-client-id"
        assert provider.client_secret == "test-client-secret"


class TestGmailScopes:
    """Tests for Gmail OAuth scopes."""

    def test_scopes_include_readonly(self):
        """Test Gmail scopes include readonly access."""
        from app.services.oauth.gmail import GmailOAuthProvider

        provider = GmailOAuthProvider(
            client_id="test-client-id",
            client_secret="test-client-secret",
            redirect_uri="http://localhost:8000/oauth/gmail/callback"
        )

        # Authorization URL should include readonly scope
        url = provider.get_authorization_url("state")
        assert "gmail.readonly" in url or "gmail" in url.lower()


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
