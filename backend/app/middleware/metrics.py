"""
Metrics middleware for collecting request metrics.
"""
import time
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.logging import get_logger
from app.core.metrics import record_error, record_request

logger = get_logger(__name__)


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware to collect request metrics."""

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Collect metrics for each request.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        # Start timer
        start_time = time.time()

        # Get method and path
        method = request.method
        path = request.url.path

        # Normalize path for metrics (replace IDs with placeholders)
        normalized_path = self._normalize_path(path)

        try:
            # Process request
            response = await call_next(request)

            # Calculate duration
            duration = time.time() - start_time

            # Record metrics
            record_request(
                method=method,
                endpoint=normalized_path,
                status=response.status_code,
                duration=duration
            )

            # Log slow requests
            if duration > 5.0:  # 5 seconds threshold
                logger.warning(
                    f"Slow request detected: {method} {path}",
                    extra_fields={
                        'duration': duration,
                        'status': response.status_code,
                        'path': path
                    }
                )

            return response

        except Exception as e:
            # Calculate duration
            duration = time.time() - start_time

            # Record error
            error_type = type(e).__name__
            record_error(error_type=error_type, endpoint=normalized_path)

            # Record failed request
            record_request(
                method=method,
                endpoint=normalized_path,
                status=500,
                duration=duration
            )

            # Re-raise exception
            raise

    @staticmethod
    def _normalize_path(path: str) -> str:
        """
        Normalize URL path for metrics by replacing IDs with placeholders.

        Args:
            path: Original URL path

        Returns:
            Normalized path with ID placeholders
        """
        import re

        # Replace UUIDs
        path = re.sub(
            r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
            '{uuid}',
            path,
            flags=re.IGNORECASE
        )

        # Replace numeric IDs
        path = re.sub(r'/\d+(/|$)', r'/{id}\1', path)

        return path
