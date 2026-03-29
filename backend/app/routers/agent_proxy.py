"""
Agent Service Proxy Router

Proxies all /api/agent/* requests to the agent-service running on a separate port.
This allows the frontend to talk to a single backend URL while the agent-service
runs as an independent process.
"""

import logging
import os

import httpx
from fastapi import APIRouter, Request, Response

logger = logging.getLogger(__name__)

router = APIRouter()

AGENT_SERVICE_URL = os.environ.get("AGENT_SERVICE_URL", "http://localhost:3008")


@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def proxy_to_agent_service(path: str, request: Request) -> Response:
    """
    Forward all requests to the agent-service.

    The full path /api/agent/{path} is forwarded as /api/agent/{path}
    to the agent-service, preserving query parameters and request body.
    """
    target_url = f"{AGENT_SERVICE_URL}/api/agent/{path}"

    # Forward query parameters
    if request.query_params:
        target_url += f"?{request.query_params}"

    # Read request body for methods that may have one
    body = await request.body() if request.method in ("POST", "PUT", "PATCH") else None

    # Build headers to forward (skip hop-by-hop headers)
    forward_headers = {}
    for key, value in request.headers.items():
        if key.lower() not in ("host", "connection", "transfer-encoding"):
            forward_headers[key] = value

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
