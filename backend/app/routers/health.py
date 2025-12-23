"""
Health check routes with real connectivity checks.

Provides:
- Basic health check for load balancer probes
- Detailed health check for monitoring systems
- Component-level status for debugging
"""

import time
from datetime import datetime
from typing import Any
from uuid import uuid4

from fastapi import APIRouter, status
from sqlalchemy import text

from app.database import engine

router = APIRouter()

# Version info
APP_VERSION = "0.1.0"
APP_NAME = "InnoSynth.ai API"


async def check_database_health() -> dict[str, Any]:
    """
    Check database connectivity and response time.

    Returns:
        Dict with status, latency_ms, and optional error message
    """
    start = time.time()
    try:
        async with engine.connect() as conn:
            # Simple query to verify database is responding
            await conn.execute(text("SELECT 1"))
            latency_ms = (time.time() - start) * 1000

            return {
                "status": "healthy",
                "latency_ms": round(latency_ms, 2),
            }
    except Exception as e:
        latency_ms = (time.time() - start) * 1000
        return {
            "status": "unhealthy",
            "latency_ms": round(latency_ms, 2),
            "error": str(e)[:200]  # Truncate long error messages
        }


@router.get("/health", status_code=status.HTTP_200_OK)
async def health_check():
    """
    Basic health check endpoint for load balancer probes.

    Returns 200 if service is running. This is a lightweight check
    that doesn't verify all dependencies.
    """
    return {
        "status": "healthy",
        "service": APP_NAME,
        "timestamp": datetime.utcnow().isoformat(),
        "version": APP_VERSION
    }


@router.get("/health/ready", status_code=status.HTTP_200_OK)
async def readiness_check():
    """
    Readiness probe - checks if the service is ready to accept traffic.

    Verifies database connectivity before returning healthy status.
    Returns 503 if any critical dependency is unavailable.
    """
    db_health = await check_database_health()

    is_ready = db_health["status"] == "healthy"

    response = {
        "status": "ready" if is_ready else "not_ready",
        "service": APP_NAME,
        "timestamp": datetime.utcnow().isoformat(),
        "checks": {
            "database": db_health["status"]
        }
    }

    if not is_ready:
        # Return 503 Service Unavailable if not ready
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content=response)

    return response


@router.get("/health/live", status_code=status.HTTP_200_OK)
async def liveness_check():
    """
    Liveness probe - checks if the service process is alive.

    Simple check that the service is responding. Kubernetes uses this
    to determine if a container needs to be restarted.
    """
    return {
        "status": "alive",
        "timestamp": datetime.utcnow().isoformat()
    }


@router.get("/health/detailed", status_code=status.HTTP_200_OK)
async def detailed_health_check():
    """
    Detailed health check endpoint for monitoring and debugging.

    Checks all service dependencies and returns detailed status.
    """
    # Run all health checks concurrently
    db_health = await check_database_health()

    # Determine overall health
    all_healthy = db_health["status"] == "healthy"

    # Future: Add more service checks here
    # vector_db_health = await check_vector_db_health()
    # graph_db_health = await check_graph_db_health()

    return {
        "status": "healthy" if all_healthy else "degraded",
        "service": APP_NAME,
        "timestamp": datetime.utcnow().isoformat(),
        "version": APP_VERSION,
        "components": {
            "database": db_health,
            "vector_db": {"status": "not_configured", "note": "Planned for future release"},
            "graph_db": {"status": "not_configured", "note": "Planned for future release"}
        }
    }


# Knowledge Health Dashboard endpoint (matches frontend expectations)
@router.get("/api/health/dashboard", status_code=status.HTTP_200_OK)
async def knowledge_health_dashboard():
    """
    Knowledge Health Dashboard - mock data for frontend

    Returns health score, alerts, and gap analysis
    """
    now = datetime.utcnow()

    # Mock recent alerts - matching frontend HealthAlert type
    mock_alerts = [
        {
            "id": str(uuid4()),
            "type": "conflict",
            "severity": "warning",
            "title": "Conflicting information detected",
            "description": "Product pricing differs between Sales deck and Website",
            "status": "active",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "affected_documents": [str(uuid4()), str(uuid4())],  # Array of document IDs
            "metadata": {
                "conflict_details": {
                    "document_ids": [str(uuid4()), str(uuid4())],
                    "conflicting_sections": [
                        {"document_id": str(uuid4()), "content": "Price: $99/month", "section": "Pricing"},
                        {"document_id": str(uuid4()), "content": "Price: $79/month", "section": "Pricing"}
                    ],
                    "suggested_resolution": "Update Website Pricing Page to match Sales Deck"
                }
            }
        },
        {
            "id": str(uuid4()),
            "type": "outdated",
            "severity": "info",
            "title": "Document may be outdated",
            "description": "Employee Handbook hasn't been updated in 6 months",
            "status": "active",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "affected_documents": [str(uuid4())]  # Array of document IDs
        },
        {
            "id": str(uuid4()),
            "type": "gap",
            "severity": "warning",
            "title": "Knowledge gap detected",
            "description": "No documentation found for 'API rate limits'",
            "status": "active",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat(),
            "affected_documents": [],  # No specific documents affected
            "metadata": {
                "gap_details": {
                    "topic": "API rate limits",
                    "related_queries": ["What are the API rate limits?", "API throttling policy"],
                    "coverage_score": 0.15,
                    "suggested_sources": ["Technical documentation", "API reference"]
                }
            }
        }
    ]

    # Mock gap analysis - matching frontend GapAnalysis type
    mock_gap_analysis = {
        "topics_with_gaps": [
            {"topic": "Technical Documentation", "gap_count": 2, "coverage_percentage": 65},
            {"topic": "Process & Procedures", "gap_count": 2, "coverage_percentage": 78},
            {"topic": "Product Information", "gap_count": 1, "coverage_percentage": 92}
        ],
        "query_patterns": [
            {"pattern": "What are the API rate limits?", "frequency": 12, "has_answer": False},
            {"pattern": "How to reset 2FA?", "frequency": 8, "has_answer": False},
            {"pattern": "Deployment rollback process", "frequency": 6, "has_answer": False}
        ]
    }

    return {
        "health_score": 78,
        "score_trend": 5,  # Percentage change from previous scan
        "stats": {
            "total_documents": 156,
            "active_alerts": len(mock_alerts),
            "knowledge_gaps": 5,
            "documents_at_risk": 8,
            "last_scan": now.isoformat(),
            "scan_in_progress": False
        },
        "recent_alerts": mock_alerts,
        "gap_analysis": mock_gap_analysis
    }


@router.post("/api/health/scan", status_code=status.HTTP_200_OK)
async def trigger_health_scan():
    """Trigger a health scan (mock)"""
    return {
        "status": "started",
        "scan_id": str(uuid4()),
        "message": "Health scan initiated"
    }


@router.get("/api/health/alerts", status_code=status.HTTP_200_OK)
async def get_health_alerts():
    """Get all health alerts (mock)"""
    return []


@router.patch("/api/health/alerts/{alert_id}/status", status_code=status.HTTP_200_OK)
async def update_alert_status(alert_id: str, status: dict):
    """Update alert status (mock)"""
    return {"id": alert_id, "status": status.get("status", "resolved")}
