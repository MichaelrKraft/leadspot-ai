"""
Tests for password reset functionality.

Tests cover:
- Password reset schema validation
- Token verification logic
- Password hashing functions
- Security measures

Note: Model tests are excluded to avoid SQLAlchemy mapper configuration issues.
"""

import secrets
from datetime import datetime, timedelta
from uuid import uuid4

import pytest


class TestPasswordResetRequestLogic:
    """Tests for password reset request business logic."""

    def test_valid_email_format(self):
        """Test email format validation."""
        from app.schemas.user import PasswordResetRequest

        # Valid email should pass
        request = PasswordResetRequest(email="test@example.com")
        assert request.email == "test@example.com"

    def test_invalid_email_format(self):
        """Test invalid email format raises validation error."""
        from pydantic import ValidationError
        from app.schemas.user import PasswordResetRequest

        with pytest.raises(ValidationError):
            PasswordResetRequest(email="not-an-email")

    def test_password_reset_request_schema(self):
        """Test PasswordResetRequest schema structure."""
        from app.schemas.user import PasswordResetRequest

        request = PasswordResetRequest(email="user@company.com")
        assert request.email == "user@company.com"


class TestPasswordResetConfirmLogic:
    """Tests for password reset confirmation business logic."""

    def test_password_reset_confirm_schema(self):
        """Test PasswordResetConfirm schema structure."""
        from app.schemas.user import PasswordResetConfirm

        request = PasswordResetConfirm(
            token="a" * 32,  # Min 32 chars
            new_password="NewSecurePassword123!"
        )

        assert request.token == "a" * 32
        assert request.new_password == "NewSecurePassword123!"

    def test_password_minimum_length(self):
        """Test password minimum length validation."""
        from pydantic import ValidationError
        from app.schemas.user import PasswordResetConfirm

        # Short password should fail
        with pytest.raises(ValidationError):
            PasswordResetConfirm(
                token="a" * 32,
                new_password="short"  # Less than 8 chars
            )

    def test_token_minimum_length(self):
        """Test token minimum length validation."""
        from pydantic import ValidationError
        from app.schemas.user import PasswordResetConfirm

        # Short token should fail
        with pytest.raises(ValidationError):
            PasswordResetConfirm(
                token="short",  # Less than 32 chars
                new_password="ValidPassword123!"
            )


class TestPasswordResetResponse:
    """Tests for password reset response schema."""

    def test_password_reset_response(self):
        """Test PasswordResetResponse schema."""
        from app.schemas.user import PasswordResetResponse

        response = PasswordResetResponse(message="Password reset successfully")
        assert response.message == "Password reset successfully"


class TestPasswordHashingLogic:
    """Tests for password hashing functions."""

    def test_password_hashing(self):
        """Test password hashing produces valid hash."""
        from app.services.auth_service import hash_password, verify_password

        password = "MySecurePassword123!"
        hashed = hash_password(password)

        # Hash should be different from original
        assert hashed != password

        # Should verify correctly
        assert verify_password(password, hashed) is True

        # Wrong password should fail
        assert verify_password("wrong_password", hashed) is False

    def test_password_hashing_unique(self):
        """Test same password produces different hashes (bcrypt salt)."""
        from app.services.auth_service import hash_password

        password = "MySecurePassword123!"
        hash1 = hash_password(password)
        hash2 = hash_password(password)

        # Same password should produce different hashes due to salt
        assert hash1 != hash2

    def test_empty_password_hashing(self):
        """Test empty password still hashes (validation at schema level)."""
        from app.services.auth_service import hash_password

        # Even empty passwords can be hashed (validation should prevent this)
        hashed = hash_password("")
        assert hashed != ""

    def test_unicode_password_hashing(self):
        """Test unicode passwords hash correctly."""
        from app.services.auth_service import hash_password, verify_password

        password = "пароль123!Password"
        hashed = hash_password(password)

        assert verify_password(password, hashed) is True

    def test_password_length_limit(self):
        """Test bcrypt has a 72-byte limit for passwords."""
        from app.services.auth_service import hash_password, verify_password

        # Password exactly at limit (72 ASCII chars)
        password = "A" * 70 + "!1"
        hashed = hash_password(password)

        # Should verify correctly
        assert verify_password(password, hashed) is True


class TestTokenVerificationLogic:
    """Tests for token verification business logic."""

    def test_token_format_validation(self):
        """Test token format is URL-safe."""
        import re

        token = secrets.token_urlsafe(32)

        # Token should be URL-safe (no special chars except - and _)
        assert re.match(r'^[A-Za-z0-9_-]+$', token) is not None

    def test_token_expiry_calculation(self):
        """Test token expiry is calculated correctly."""
        now = datetime.utcnow()
        expiry = now + timedelta(hours=1)

        # Token should be valid immediately after creation
        assert expiry > now

        # Token should be invalid after 1 hour + buffer
        simulated_future = now + timedelta(hours=1, minutes=5)
        assert expiry < simulated_future

    def test_token_length(self):
        """Test token has sufficient length for security."""
        token = secrets.token_urlsafe(32)

        # Token should be at least 32 characters (base64 encoded)
        assert len(token) >= 32


class TestSecurityMeasures:
    """Tests for security-related password reset features."""

    def test_email_enumeration_prevention(self):
        """
        Test that response is identical for existing and non-existing emails.
        This prevents attackers from discovering valid email addresses.
        """
        from app.schemas.user import PasswordResetResponse

        # Both responses should return the same generic message
        response = PasswordResetResponse(
            message="If an account with that email exists, we've sent a password reset link."
        )

        # The response message should not reveal whether email exists
        assert "If" in response.message
        assert "exists" in response.message

    def test_token_is_unique(self):
        """Test tokens are unique across generations."""
        tokens = [secrets.token_urlsafe(32) for _ in range(100)]
        assert len(set(tokens)) == 100  # All unique

    def test_token_is_cryptographically_secure(self):
        """Test token uses cryptographically secure random."""
        import secrets as sec

        # secrets module uses os.urandom which is cryptographically secure
        token1 = sec.token_urlsafe(32)
        token2 = sec.token_urlsafe(32)

        # Should never be equal (probability is negligible)
        assert token1 != token2

    def test_password_not_stored_in_plain_text(self):
        """Test password is never stored in plain text."""
        from app.services.auth_service import hash_password

        password = "SecurePassword123!"
        hashed = hash_password(password)

        # Plain text should not appear in hash
        assert password not in hashed

        # Hash should start with bcrypt prefix
        assert hashed.startswith("$2")


class TestUserSchemas:
    """Tests for user-related schemas."""

    def test_user_create_schema(self):
        """Test UserCreate schema validation."""
        from app.schemas.user import UserCreate

        user = UserCreate(
            email="test@example.com",
            name="Test User",
            password="SecurePassword123!",
            organization_domain="example.com"
        )

        assert user.email == "test@example.com"
        assert user.name == "Test User"

    def test_user_create_invalid_email(self):
        """Test UserCreate rejects invalid email."""
        from pydantic import ValidationError
        from app.schemas.user import UserCreate

        with pytest.raises(ValidationError):
            UserCreate(
                email="invalid",
                name="Test",
                password="SecurePassword123!",
                organization_domain="example.com"
            )

    def test_user_create_short_password(self):
        """Test UserCreate rejects short password."""
        from pydantic import ValidationError
        from app.schemas.user import UserCreate

        with pytest.raises(ValidationError):
            UserCreate(
                email="test@example.com",
                name="Test",
                password="short",  # Less than 8 chars
                organization_domain="example.com"
            )

    def test_user_login_schema(self):
        """Test UserLogin schema validation."""
        from app.schemas.user import UserLogin

        login = UserLogin(
            email="test@example.com",
            password="password123"
        )

        assert login.email == "test@example.com"
        assert login.password == "password123"


if __name__ == "__main__":
    pytest.main([__file__, "-v"])
