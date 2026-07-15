"""
Agent Service Proxy Router

Proxies all /api/agent/* requests to the agent-service running on a separate port.
This allows the frontend to talk to a single backend URL while the agent-service
runs as an independent process.
"""

import logging
import os

import httpx
from fastapi import APIRouter, Depends, Request, Response

from app.config import settings
from app.models.user import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()

AGENT_SERVICE_URL = os.environ.get("AGENT_SERVICE_URL", "http://localhost:3008")


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_to_agent_service(
    path: str,
    request: Request,
    current_user: User = Depends(get_current_user),
) -> Response:
    """
    Forward requests to the agent-service on behalf of an authenticated user.

    Client headers are NOT forwarded. The proxy sends the internal service
    key plus the user's organization so agent-service can enforce org scoping.
    """
    target_url = f"{AGENT_SERVICE_URL}/api/agent/{path}"

    # Forward query parameters
    if request.query_params:
        target_url += f"?{request.query_params}"

    # Read request body for methods that may have one
    body = await request.body() if request.method in ("POST", "PUT", "PATCH") else None

    forward_headers = {
        "Content-Type": request.headers.get("content-type", "application/json"),
        "X-Internal-Api-Key": settings.INTERNAL_API_KEY,
        "X-Organization-Id": str(current_user.organization_id),
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.request(
                method=request.method,
                url=target_url,
                headers=forward_headers,
                content=body,
            )

        return Response(
            content=response.content,
            status_code=response.status_code,
            headers=dict(response.headers),
            media_type=response.headers.get("content-type"),
        )

    except httpx.ConnectError:
        logger.error(f"Agent service unavailable at {AGENT_SERVICE_URL}")
        return Response(
            content='{"error": "Agent service is unavailable"}',
            status_code=503,
            media_type="application/json",
        )
    except httpx.TimeoutException:
        logger.error(f"Agent service request timed out: {target_url}")
        return Response(
            content='{"error": "Agent service request timed out"}',
            status_code=504,
            media_type="application/json",
        )
    except Exception as e:
        logger.exception(f"Error proxying to agent service: {e}")
        return Response(
            content='{"error": "Failed to proxy request to agent service"}',
            status_code=502,
            media_type="application/json",
        )
