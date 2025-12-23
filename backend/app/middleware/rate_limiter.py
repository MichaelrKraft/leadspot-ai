"""
Rate limiting middleware using SlowAPI.

Provides protection against brute force attacks and API abuse.
Uses in-memory storage by default (works without Redis).
"""

from fastapi import Request
from fastapi.responses import JSONResponse
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address


def get_client_ip(request: Request) -> str:
    """
    Get client IP address from request.
    Handles X-Forwarded-For header for proxied requests (Render, etc.)
    """
    # Check for forwarded IP (when behind proxy/load balancer)
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        # X-Forwarded-For can contain multiple IPs, take the first one
        return forwarded.split(",")[0].strip()

    # Check for real IP header
    real_ip = request.headers.get("X-Real-IP")
    if real_ip:
        return real_ip

    # Fall back to direct client IP
    return get_remote_address(request)


# Create limiter instance with in-memory storage
# For production with multiple workers, consider using Redis:
# limiter = Limiter(key_func=get_client_ip, storage_uri="redis://localhost:6379")
limiter = Limiter(key_func=get_client_ip)


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    """
    Custom handler for rate limit exceeded errors.
    Returns a JSON response with retry information.
    """
    return JSONResponse(
        status_code=429,
        content={
            "error": "rate_limit_exceeded",
            "message": "Too many requests. Please slow down.",
            "detail": str(exc.detail),
            "retry_after": getattr(exc, "retry_after", 60)
        },
        headers={
            "Retry-After": str(getattr(exc, "retry_after", 60)),
            "X-RateLimit-Limit": str(getattr(exc, "limit", "unknown")),
        }
    )


# Rate limit configurations for different endpoint types
class RateLimits:
    """
    Centralized rate limit configurations.

    Auth endpoints have stricter limits to prevent brute force attacks.
    API endpoints have higher limits for normal usage.
    """

    # Authentication endpoints - strict limits to prevent brute force
    AUTH_LOGIN = "5/minute"  # 5 login attempts per minute per IP
    AUTH_REGISTER = "3/minute"  # 3 registration attempts per minute
    AUTH_PASSWORD_RESET = "3/minute"  # 3 password reset requests per minute

    # API endpoints - more generous limits
    API_QUERY = "30/minute"  # 30 queries per minute (AI-intensive)
    API_DOCUMENTS = "60/minute"  # 60 document operations per minute
    API_GENERAL = "100/minute"  # 100 requests per minute for general endpoints

    # Health/status endpoints - no practical limit
    HEALTH = "1000/minute"
