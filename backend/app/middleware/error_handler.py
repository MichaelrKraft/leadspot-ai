"""
Global error handling middleware.
"""
import traceback
from collections.abc import Callable

from fastapi import Request, Response
from fastapi.responses import JSONResponse
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.exceptions import BaseAPIException
from app.core.logging import get_logger
from app.core.metrics import record_exception
from app.middleware.request_id import get_request_id

logger = get_logger(__name__)


class ErrorHandlerMiddleware(BaseHTTPMiddleware):
    """Middleware for global error handling."""

    def __init__(self, app, debug: bool = False):
        super().__init__(app)
        self.debug = debug

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Handle errors globally.

        Args:
            request: Incoming HTTP request
            call_next: Next middleware in chain

        Returns:
            HTTP response
        """
        try:
            response = await call_next(request)
            return response

        except BaseAPIException as e:
            # Handle known API exceptions
            return await self._handle_api_exception(request, e)

        except Exception as e:
            # Handle unexpected exceptions
            return await self._handle_unexpected_exception(request, e)

    async def _handle_api_exception(
        self,
        request: Request,
        exc: BaseAPIException
    ) -> JSONResponse:
        """
        Handle known API exceptions.

        Args:
            request: HTTP request
            exc: API exception

        Returns:
            JSON error response
        """
        # Record exception metric
        record_exception(exc.error_code)

        # Get request ID
        request_id = get_request_id(request)

        # Log error
        logger.error(
            f"API error: {exc.message}",
            extra_fields={
                'error_code': exc.error_code,
                'status_code': exc.status_code,
                'details': exc.details,
                'path': request.url.path,
                'method': request.method
            }
        )

        # Build response
        response_data = exc.to_dict()
        response_data['error']['request_id'] = request_id

        return JSONResponse(
            status_code=exc.status_code,
            content=response_data
        )

    async def _handle_unexpected_exception(
        self,
        request: Request,
        exc: Exception
    ) -> JSONResponse:
        """
        Handle unexpected exceptions.

        Args:
            request: HTTP request
            exc: Exception

        Returns:
            JSON error response
        """
        # Record exception metric
        exception_type = type(exc).__name__
        record_exception(exception_type)

        # Get request ID
        request_id = get_request_id(request)

        # Log error with full traceback
        logger.error(
            f"Unexpected error: {exc!s}",
            extra_fields={
                'exception_type': exception_type,
                'path': request.url.path,
                'method': request.method,
                'traceback': traceback.format_exc()
            }
        )

        # Build response (hide internal details in production)
        if self.debug:
            error_message = str(exc)
            error_details = {
                'exception_type': exception_type,
                'traceback': traceback.format_exc().split('\n')
            }
        else:
            error_message = "An internal error occurred"
            error_details = None

        response_data = {
            'error': {
                'message': error_message,
                'code': 'INTERNAL_ERROR',
                'status': 500,
                'request_id': request_id
            }
        }

        if error_details:
            response_data['error']['details'] = error_details

        return JSONResponse(
            status_code=500,
            content=response_data
        )
