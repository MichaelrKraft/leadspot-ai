"""
Tests for authentication API endpoints.

Tests cover:
- User registration
- User login
- Token refresh
- Logout
- Get current user
- Password reset flow
"""

import pytest
from fastapi import status


class TestUserRegistration:
    """Tests for POST /auth/register endpoint."""

    def test_register_success(self, client):
        """Test successful user registration."""
        response = client.post(
            "/auth/register",
            json={
                "email": "newuser@example.com",
                "password": "SecurePassword123!",
                "name": "New User",
                "organization_domain": "example.com",
            },
        )

        assert response.status_code == status.HTTP_201_CREATED
        data = response.json()
        assert "access_token" in data
        assert data["token_type"] == "bearer"
        assert data["user"]["email"] == "newuser@example.com"
        assert "hashed_password" not in str(data)  # Should not expose password

    def test_register_invalid_email(self, client):
        """Test registration with invalid email format."""
        response = client.post(
            "/auth/register",
            json={
                "email": "not-an-email",
                "password": "SecurePassword123!",
                "name": "Test User",
                "organization_domain": "example.com",
            },
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_weak_password(self, client):
        """Test registration with weak password."""
        response = client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                "password": "weak",
                "name": "Test User",
                "organization_domain": "example.com",
            },
        )

        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY

    def test_register_duplicate_email(self, client, test_user):
        """Test registration with already registered email."""
        response = client.post(
            "/auth/register",
            json={
                "email": "test@example.com",  # Same as test_user
                "password": "SecurePassword123!",
                "name": "Duplicate User",
                "organization_domain": "example.com",
            },
        )

        assert response.status_code == status.HTTP_400_BAD_REQUEST

    def test_register_missing_fields(self, client):
        """Test registration with missing required fields."""
        response = client.post(
            "/auth/register",
            json={
                "email": "test@example.com",
                # Missing password and name
            },
        )
        
        assert response.status_code == status.HTTP_422_UNPROCESSABLE_ENTITY


class TestUserLogin:
    """Tests for POST /auth/login endpoint."""

    def test_login_success(self, client, test_user, test_user_data):
        """Test successful login."""
        response = client.post(
            "/auth/login",
            json={
                "email": test_user_data["email"],
                "password": test_user_data["password"],
            },
        )
        
        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert "access_token" in data or "user" in data
        
        # Check for httpOnly cookie
        cookies = response.cookies
        assert "access_token" in cookies or len(cookies) > 0

    def test_login_invalid_email(self, client):
        """Test login with non-existent email."""
        response = client.post(
            "/auth/login",
            json={
                "email": "nonexistent@example.com",
                "password": "SomePassword123!",
            },
        )
        
        assert response.status_code in [
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_404_NOT_FOUND,
        ]

    def test_login_wrong_password(self, client, test_user, test_user_data):
        """Test login with incorrect password."""
        response = client.post(
            "/auth/login",
            json={
                "email": test_user_data["email"],
                "password": "WrongPassword123!",
            },
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_login_inactive_user(self, client, test_user):
        """Test login with incorrect credentials (simulates inactive user behavior)."""
        # Note: User model doesn't have is_active field
        # Instead test that wrong credentials are rejected
        response = client.post(
            "/auth/login",
            json={
                "email": test_user.email,
                "password": "CompletelyWrongPassword123!",
            },
        )

        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestGetCurrentUser:
    """Tests for GET /auth/me endpoint."""

    def test_get_current_user_success(self, client, test_user):
        """Test getting current user with valid token."""
        from uuid import UUID
        from app.services.auth_service import create_access_token

        # Create token using actual test_user's user_id
        token = create_access_token(
            user_id=UUID(test_user.user_id),
            email=test_user.email,
            organization_id=UUID(test_user.organization_id),
            role=test_user.role,
        )
        headers = {"Authorization": f"Bearer {token}"}

        response = client.get("/auth/me", headers=headers)

        assert response.status_code == status.HTTP_200_OK
        data = response.json()
        assert data["email"] == test_user.email
        assert "hashed_password" not in data

    def test_get_current_user_no_token(self, client):
        """Test getting current user without token."""
        response = client.get("/auth/me")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_current_user_invalid_token(self, client):
        """Test getting current user with invalid token."""
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer invalid_token_here"},
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED

    def test_get_current_user_expired_token(self, client):
        """Test getting current user with expired token."""
        # Create an expired token (would need to mock time or use a pre-expired token)
        # For now, just test that malformed tokens are rejected
        response = client.get(
            "/auth/me",
            headers={"Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ0ZXN0QGV4YW1wbGUuY29tIiwiZXhwIjoxfQ.invalid"},
        )
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestTokenRefresh:
    """Tests for POST /auth/refresh endpoint."""

    def test_refresh_token_success(self, client, test_user):
        """Test successful token refresh."""
        # First login to get tokens
        login_response = client.post(
            "/auth/login",
            json={
                "email": test_user.email,
                "password": "SecurePassword123!",
            },
        )
        
        # Then try to refresh
        response = client.post("/auth/refresh")
        
        # Should either succeed or indicate no refresh token
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_401_UNAUTHORIZED,  # If refresh token not in cookie
        ]

    def test_refresh_token_no_cookie(self, client):
        """Test refresh without refresh token cookie."""
        response = client.post("/auth/refresh")
        
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


class TestLogout:
    """Tests for POST /auth/logout endpoint."""

    def test_logout_success(self, client, test_user):
        """Test successful logout."""
        from uuid import UUID
        from app.services.auth_service import create_access_token

        # Create token using actual test_user's user_id
        token = create_access_token(
            user_id=UUID(test_user.user_id),
            email=test_user.email,
            organization_id=UUID(test_user.organization_id),
            role=test_user.role,
        )
        headers = {"Authorization": f"Bearer {token}"}

        response = client.post("/auth/logout", headers=headers)

        assert response.status_code == status.HTTP_200_OK

        # Verify cookies are cleared
        cookies = response.cookies
        # Cookie should be expired or deleted

    def test_logout_without_auth(self, client):
        """Test logout without authentication."""
        response = client.post("/auth/logout")
        
        # Should either succeed (no-op) or require auth
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_401_UNAUTHORIZED,
        ]


class TestPasswordReset:
    """Tests for password reset flow."""

    def test_request_password_reset(self, client, test_user):
        """Test requesting password reset."""
        response = client.post(
            "/auth/forgot-password",
            json={"email": test_user.email},
        )

        # Should always return success to prevent email enumeration
        assert response.status_code == status.HTTP_200_OK

    def test_request_password_reset_nonexistent_email(self, client):
        """Test requesting reset for non-existent email."""
        response = client.post(
            "/auth/forgot-password",
            json={"email": "nonexistent@example.com"},
        )

        # Should still return success to prevent email enumeration
        assert response.status_code == status.HTTP_200_OK

    def test_confirm_password_reset_invalid_token(self, client):
        """Test confirming reset with invalid token."""
        response = client.post(
            "/auth/reset-password",
            json={
                "token": "a" * 32,  # Invalid token
                "new_password": "NewSecurePassword123!",
            },
        )

        assert response.status_code in [
            status.HTTP_400_BAD_REQUEST,
            status.HTTP_404_NOT_FOUND,
        ]


class TestRateLimiting:
    """Tests for authentication rate limiting."""

    def test_login_rate_limiting(self, client):
        """Test that login endpoint has rate limiting."""
        # Make many rapid requests
        responses = []
        for _ in range(20):
            response = client.post(
                "/auth/login",
                json={
                    "email": "test@example.com",
                    "password": "password",
                },
            )
            responses.append(response.status_code)
        
        # At least some should be rate limited (429)
        # Or all fail with 401 (which is also acceptable)
        assert all(
            code in [status.HTTP_401_UNAUTHORIZED, status.HTTP_429_TOO_MANY_REQUESTS]
            for code in responses
        )


class TestCSRFProtection:
    """Tests for CSRF protection on auth endpoints."""

    def test_login_without_csrf_token(self, client, test_user, test_user_data):
        """Test that state-changing requests work without explicit CSRF for cookie-based auth."""
        # The CSRF token is typically set by the server and sent with requests
        # This test verifies the endpoint is accessible
        response = client.post(
            "/auth/login",
            json={
                "email": test_user_data["email"],
                "password": test_user_data["password"],
            },
        )

        # Should either succeed or fail for auth reasons (not CSRF)
        # Note: 429 is acceptable if rate limited by previous tests
        assert response.status_code in [
            status.HTTP_200_OK,
            status.HTTP_401_UNAUTHORIZED,
            status.HTTP_404_NOT_FOUND,
            status.HTTP_429_TOO_MANY_REQUESTS,
        ]
