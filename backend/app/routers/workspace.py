"""
Workspace router — batch data fetching and feature request handling for Space Agent.
"""

import logging
import secrets
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models import User
from app.services.auth_service import get_current_user

logger = logging.getLogger(__name__)

router = APIRouter()


class BatchRequest(BaseModel):
    resource: str  # e.g., "contacts", "deals", "insights"
    params: dict[str, Any] = {}


class FeatureRequest(BaseModel):
    feature: str
    description: str


@router.post("/workspace/batch")
async def batch_fetch(
    requests: list[BatchRequest],
    request: Request,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """
    Batch data endpoint for Space Agent widgets.
    Deduplicates identical sub-requests and returns all results in one response.
    Reduces N widget polls → 1 batch call per 60s interval.
    """
    organization_id = str(current_user.organization_id)

    # Validate Space Agent key if present (also allows normal user auth)
    space_key = request.headers.get("X-Space-Agent-Key", "")
    if space_key and settings.SPACE_AGENT_API_KEY:
        if not secrets.compare_digest(space_key, settings.SPACE_AGENT_API_KEY):
            raise HTTPException(status_code=401, detail="Invalid Space Agent key")

    # Limit to whitelisted resources
    ALLOWED_RESOURCES = {"contacts", "deals", "insights", "campaigns", "segments", "agent_brief", "agent_queue"}
    results: dict[str, Any] = {}

    for req in requests:
        if req.resource not in ALLOWED_RESOURCES:
            results[req.resource] = {"error": "resource not allowed"}
            continue

        # Deduplicate: skip if already fetched with same params
        cache_key = f"{req.resource}:{str(sorted(req.params.items()))}"
        if cache_key in results:
            continue

        try:
            data = await _fetch_resource(req.resource, req.params, organization_id, db)
            results[cache_key] = data
        except Exception as e:
            logger.error(f"Batch fetch error for {req.resource}: {e}")
            results[req.resource] = {"error": "fetch failed"}

    return {"results": results}


async def _fetch_resource(resource: str, params: dict, organization_id: str, db: AsyncSession) -> Any:
    """Dispatch to appropriate data fetcher based on resource name."""
    from sqlalchemy import select
    from app.models.contact import Contact
    from app.models.deal import Deal

    if resource == "contacts":
        limit = min(int(params.get("limit", 25)), 100)
        result = await db.execute(
            select(Contact)
            .where(Contact.organization_id == organization_id)
            .limit(limit)
        )
        contacts = result.scalars().all()
        return {
            "items": [
                {
                    "id": c.id,
                    "name": f"{c.first_name} {c.last_name}",
                    "email": c.email,
                    "points": c.points,
                }
                for c in contacts
            ]
        }

    elif resource == "deals":
        result = await db.execute(
            select(Deal)
            .where(Deal.org_id == organization_id)
            .limit(50)
        )
        deals = result.scalars().all()
        return {
            "items": [
                {
                    "id": d.id,
                    "title": d.title,
                    "value": float(d.value or 0),
                    "stage": d.stage,
                }
                for d in deals
            ]
        }

    return {"error": "unknown resource"}


@router.post("/workspace/feature-request")
async def submit_feature_request(
    body: FeatureRequest,
    current_user: User = Depends(get_current_user),
):
    """Record a feature request from the workspace."""
    logger.info(f"Feature request from {current_user.email}: {body.feature} — {body.description}")
    return {"status": "received", "message": "Thanks! We'll review your request."}


@router.get("/workspace/health")
async def workspace_health(request: Request):
    """
    Proxy health check for Space Agent service.
    Called by useSpaceAgentHealth hook every 10s when detecting cold start.
    """
    import httpx
    if not settings.SPACE_AGENT_URL:
        return {"status": "not_configured"}

    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            resp = await client.get(f"{settings.SPACE_AGENT_URL}/api/health")
            return {"status": "up" if resp.status_code == 200 else "down"}
    except Exception:
        return {"status": "down"}
