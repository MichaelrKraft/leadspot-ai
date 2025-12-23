"""
Custom exception classes for InnoSynth.ai application.
"""
from typing import Any


class BaseAPIException(Exception):
    """Base exception class for all API exceptions."""

    def __init__(
        self,
        message: str,
        status_code: int = 500,
        error_code: str | None = None,
        details: dict[str, Any] | None = None
    ):
        self.message = message
        self.status_code = status_code
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)

    def to_dict(self) -> dict[str, Any]:
        """Convert exception to dictionary for JSON response."""
        result = {
            'error': {
                'message': self.message,
                'code': self.error_code,
                'status': self.status_code,
            }
        }
        if self.details:
            result['error']['details'] = self.details
        return result


class NotFoundError(BaseAPIException):
    """Resource not found exception."""

    def __init__(
        self,
        resource: str,
        identifier: str | None = None,
        details: dict[str, Any] | None = None
    ):
        message = f"{resource} not found"
        if identifier:
            message = f"{resource} with identifier '{identifier}' not found"
        super().__init__(
            message=message,
            status_code=404,
            error_code="NOT_FOUND",
            details=details
        )


class ValidationError(BaseAPIException):
    """Data validation exception."""

    def __init__(
        self,
        message: str = "Validation failed",
        field_errors: dict[str, str] | None = None,
        details: dict[str, Any] | None = None
    ):
        final_details = details or {}
        if field_errors:
            final_details['field_errors'] = field_errors
        super().__init__(
            message=message,
            status_code=422,
            error_code="VALIDATION_ERROR",
            details=final_details
        )


class AuthenticationError(BaseAPIException):
    """Authentication failed exception."""

    def __init__(
        self,
        message: str = "Authentication failed",
        details: dict[str, Any] | None = None
    ):
        super().__init__(
            message=message,
            status_code=401,
            error_code="AUTHENTICATION_ERROR",
            details=details
        )


class AuthorizationError(BaseAPIException):
    """Authorization/permission denied exception."""

    def __init__(
        self,
        message: str = "Permission denied",
        required_permission: str | None = None,
        details: dict[str, Any] | None = None
    ):
        final_details = details or {}
        if required_permission:
            final_details['required_permission'] = required_permission
        super().__init__(
            message=message,
            status_code=403,
            error_code="AUTHORIZATION_ERROR",
            details=final_details
        )


class RateLimitError(BaseAPIException):
    """Rate limit exceeded exception."""

    def __init__(
        self,
        message: str = "Rate limit exceeded",
        retry_after: int | None = None,
        limit: int | None = None,
        details: dict[str, Any] | None = None
    ):
        final_details = details or {}
        if retry_after:
            final_details['retry_after'] = retry_after
        if limit:
            final_details['limit'] = limit
        super().__init__(
            message=message,
            status_code=429,
            error_code="RATE_LIMIT_EXCEEDED",
            details=final_details
        )


class ExternalServiceError(BaseAPIException):
    """External service call failed exception."""

    def __init__(
        self,
        service: str,
        message: str = "External service error",
        original_error: str | None = None,
        details: dict[str, Any] | None = None
    ):
        final_details = details or {}
        final_details['service'] = service
        if original_error:
            final_details['original_error'] = original_error
        super().__init__(
            message=message,
            status_code=502,
            error_code="EXTERNAL_SERVICE_ERROR",
            details=final_details
        )


class DatabaseError(BaseAPIException):
    """Database operation failed exception."""

    def __init__(
        self,
        message: str = "Database operation failed",
        operation: str | None = None,
        details: dict[str, Any] | None = None
    ):
        final_details = details or {}
        if operation:
            final_details['operation'] = operation
        super().__init__(
            message=message,
            status_code=500,
            error_code="DATABASE_ERROR",
            details=final_details
        )


class ConflictError(BaseAPIException):
    """Resource conflict exception."""

    def __init__(
        self,
        message: str = "Resource conflict",
        conflicting_field: str | None = None,
        details: dict[str, Any] | None = None
    ):
        final_details = details or {}
        if conflicting_field:
            final_details['conflicting_field'] = conflicting_field
        super().__init__(
            message=message,
            status_code=409,
            error_code="CONFLICT",
            details=final_details
        )


class ServiceUnavailableError(BaseAPIException):
    """Service temporarily unavailable exception."""

    def __init__(
        self,
        message: str = "Service temporarily unavailable",
        retry_after: int | None = None,
        details: dict[str, Any] | None = None
    ):
        final_details = details or {}
        if retry_after:
            final_details['retry_after'] = retry_after
        super().__init__(
            message=message,
            status_code=503,
            error_code="SERVICE_UNAVAILABLE",
            details=final_details
        )


class BusinessLogicError(BaseAPIException):
    """Business logic validation failed exception."""

    def __init__(
        self,
        message: str,
        rule: str | None = None,
        details: dict[str, Any] | None = None
    ):
        final_details = details or {}
        if rule:
            final_details['violated_rule'] = rule
        super().__init__(
            message=message,
            status_code=400,
            error_code="BUSINESS_LOGIC_ERROR",
            details=final_details
        )
