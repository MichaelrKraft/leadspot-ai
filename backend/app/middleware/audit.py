"""
Audit Logging Middleware

Automatically logs HTTP requests to the audit trail for security and compliance.
Captures user context, request details, and response status.
"""

import time
import uuid
from collections.abc import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from app.database import async_session_maker
from app.services.admin.audit_service import AuditService


class AuditMiddleware(BaseHTTPMiddleware):
    """
    Middleware for automatic audit logging of HTTP requests.

    Logs:
    - All administrative actions (POST, PUT, PATCH, DELETE)
    - User authentication events
    - Sensitive data access
    """

    # Paths that should be audited
    AUDIT_PATHS = [
        "/api/admin",      # Admin panel
        "/api/users",      # User management
        "/api/auth",       # Authentication
        "/api/documents",  # Document operations (DELETE only)
    ]

    # Actions to exclude from audit (too noisy)
    EXCLUDE_PATHS = [
        "/api/health",
        "/api/docs",
        "/api/openapi.json",
        "/metrics",
    ]

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        """
        Process request and log to audit trail if applicable.

        Args:
            request: FastAPI request object
            call_next: Next middleware in chain

        Returns:
            Response from downstream handlers
        """
        # Skip non-auditable paths
        if not self._should_audit(request):
            return await call_next(request)

        # Capture request start time
        start_time = time.time()

        # Extract user context from request state (set by auth dependency)
        user_id = None
        organization_id = None

        # Try to get user from request state
        if hasattr(request.state, "user"):
            user_id = request.state.user.get("id")
            organization_id = request.state.user.get("organization_id")

        # Get client info
        ip_address = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent")

        # Determine action and resource from path and method
        action, resource_type = self._parse_action(request)

        # Execute request
        response = await call_next(request)

        # Calculate response time
        duration_ms = int((time.time() - start_time) * 1000)

        # Determine status
        status = "success" if response.status_code < 400 else "failure"
        error_message = None if status == "success" else f"HTTP {response.status_code}"

        # Log to audit trail
        if organization_id:  # Only log if we have organization context
            try:
                async with async_session_maker() as db:
                    audit_service = AuditService(db)
                    await audit_service.log_action(
                        organization_id=uuid.UUID(organization_id) if organization_id else None,
                        user_id=uuid.UUID(user_id) if user_id else None,
                        action=action,
                        resource_type=resource_type,
                        details={
                            "method": request.method,
                            "path": str(request.url.path),
                            "duration_ms": duration_ms,
                            "status_code": response.status_code,
                        },
                        ip_address=ip_address,
                        user_agent=user_agent,
                        status=status,
                        error_message=error_message
                    )
                    await db.commit()
            except Exception as e:
                # Don't fail the request if audit logging fails
                print(f"Audit logging error: {e}")

        return response

    def _should_audit(self, request: Request) -> bool:
        """
        Determine if a request should be audited.

        Args:
            request: FastAPI request object

        Returns:
            True if request should be audited
        """
        path = str(request.url.path)

        # Exclude certain paths
        if any(path.startswith(exclude) for exclude in self.EXCLUDE_PATHS):
            return False

        # Only audit specific paths
        if not any(path.startswith(audit_path) for audit_path in self.AUDIT_PATHS):
            return False

        # Only audit mutating operations (and auth)
        if request.method in ["POST", "PUT", "PATCH", "DELETE"]:
            return True

        # Audit GET requests to sensitive endpoints
        if "/api/admin" in path or "/api/auth" in path:
            return True

        return False

    def _parse_action(self, request: Request) -> tuple[str, str]:
        """
        Parse action and resource type from request path and method.

        Args:
            request: FastAPI request object

        Returns:
            Tuple of (action, resource_type)
        """
        path = str(request.url.path)
        method = request.method

        # Mapping of method to action verb
        method_to_action = {
            "POST": "create",
            "PUT": "update",
            "PATCH": "update",
            "DELETE": "delete",
            "GET": "read",
        }

        # Extract resource from path
        resource_type = "unknown"

        if "/users" in path:
            resource_type = "user"
        elif "/organizations" in path or "/organization" in path:
            resource_type = "organization"
        elif "/documents" in path:
            resource_type = "document"
        elif "/queries" in path or "/query" in path:
            resource_type = "query"
        elif "/auth/login" in path:
            return "auth.login", "auth"
        elif "/auth/register" in path:
            return "auth.register", "auth"
        elif "/auth/logout" in path:
            return "auth.logout", "auth"
        elif "/admin" in path:
            resource_type = "admin"

        # Construct action string
        action_verb = method_to_action.get(method, "unknown")
        action = f"{resource_type}.{action_verb}"

        return action, resource_type

    def _get_client_ip(self, request: Request) -> str:
        """
        Get client IP address from request, handling proxies.

        Args:
            request: FastAPI request object

        Returns:
            Client IP address
        """
        # Check X-Forwarded-For header (for proxies)
        forwarded = request.headers.get("x-forwarded-for")
        if forwarded:
            # Take first IP in the chain
            return forwarded.split(",")[0].strip()

        # Check X-Real-IP header
        real_ip = request.headers.get("x-real-ip")
        if real_ip:
            return real_ip

        # Fall back to direct client
        if request.client:
            return request.client.host

        return "unknown"
