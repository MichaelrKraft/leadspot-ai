"""
Request ID middleware for tracking requests across the application.
"""
import uuid
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import clear_request_context, set_request_context


class RequestIDMiddleware(BaseHTTPMiddleware):
    """Middleware to generate and track unique request IDs."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and add unique request ID.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            HTTP response with request ID header
        """
        # Generate or extract request ID
        request_id = request.headers.get('X-Request-ID', str(uuid.uuid4()))

        # Set in logging context
        set_request_context(request_id=request_id)

        # Store in request state for access in route handlers
        request.state.request_id = request_id

        try:
            # Process request
            response = await call_next(request)

            # Add request ID to response headers
            response.headers['X-Request-ID'] = request_id

            return response
        finally:
            # Clear logging context
            clear_request_context()


def get_request_id(request: Request) -> str:
    """
    Get request ID from request state.

    Args:
        request: FastAPI request object

    Returns:
        Request ID string
    """
    return getattr(request.state, 'request_id', 'unknown')
