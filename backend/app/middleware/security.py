"""
Security middleware for InnoSynth.ai.

Provides:
- Security headers (HSTS, X-Frame-Options, etc.)
- CSRF protection for cookie-based auth
- Request size limits
"""

import secrets
from collections.abc import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """
    Adds security headers to all responses.
    """

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        response = await call_next(request)

        # Prevent clickjacking
        response.headers["X-Frame-Options"] = "DENY"

        # Prevent MIME type sniffing
        response.headers["X-Content-Type-Options"] = "nosniff"

        # Enable XSS filter in browsers
        response.headers["X-XSS-Protection"] = "1; mode=block"

        # Referrer policy - don't leak URLs
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"

        # Content Security Policy - restrictive by default
        # Adjust as needed for your frontend
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' 'unsafe-inline'; "
            "style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data: https:; "
            "font-src 'self' https:; "
            "connect-src 'self' https:; "
            "frame-ancestors 'none';"
        )

        # Permissions Policy - disable unnecessary browser features
        response.headers["Permissions-Policy"] = (
            "accelerometer=(), camera=(), geolocation=(), gyroscope=(), "
            "magnetometer=(), microphone=(), payment=(), usb=()"
        )

        return response


class CSRFMiddleware(BaseHTTPMiddleware):
    """
    CSRF protection middleware for cookie-based authentication.

    For state-changing requests (POST, PUT, DELETE, PATCH),
    validates that the X-CSRF-Token header matches the csrf_token cookie.
    """

    SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}
    CSRF_COOKIE_NAME = "csrf_token"
    CSRF_HEADER_NAME = "X-CSRF-Token"

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Skip CSRF check for safe methods
        if request.method in self.SAFE_METHODS:
            response = await call_next(request)
            # Set CSRF token cookie on GET requests if not present
            if request.method == "GET" and self.CSRF_COOKIE_NAME not in request.cookies:
                csrf_token = secrets.token_urlsafe(32)
                response.set_cookie(
                    key=self.CSRF_COOKIE_NAME,
                    value=csrf_token,
                    httponly=False,  # Must be readable by JavaScript
                    samesite="lax",
                    secure=True,  # Only send over HTTPS
                    max_age=86400  # 24 hours
                )
            return response

        # For state-changing methods, validate CSRF token
        csrf_cookie = request.cookies.get(self.CSRF_COOKIE_NAME)
        csrf_header = request.headers.get(self.CSRF_HEADER_NAME)

        # If using cookie-based auth (has access_token cookie), require CSRF
        if "access_token" in request.cookies:
            if not csrf_cookie or not csrf_header:
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "csrf_token_missing",
                        "message": "CSRF token is required for this request"
                    }
                )

            if not secrets.compare_digest(csrf_cookie, csrf_header):
                return JSONResponse(
                    status_code=403,
                    content={
                        "error": "csrf_token_invalid",
                        "message": "CSRF token validation failed"
                    }
                )

        return await call_next(request)


class RequestSizeLimitMiddleware(BaseHTTPMiddleware):
    """
    Limits request body size to prevent memory exhaustion attacks.
    """

    # 10 MB default limit
    MAX_CONTENT_LENGTH = 10 * 1024 * 1024

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        content_length = request.headers.get("content-length")

        if content_length:
            content_length = int(content_length)
            if content_length > self.MAX_CONTENT_LENGTH:
                return JSONResponse(
                    status_code=413,
                    content={
                        "error": "request_too_large",
                        "message": f"Request body too large. Maximum size is {self.MAX_CONTENT_LENGTH // (1024*1024)}MB",
                        "max_size_bytes": self.MAX_CONTENT_LENGTH
                    }
                )

        return await call_next(request)
