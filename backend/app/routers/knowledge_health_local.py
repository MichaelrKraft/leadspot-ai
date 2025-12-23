"""
Knowledge Health API - Local implementation with real data integration.
Provides health scoring, alerts, and recommendations based on actual document data.
"""

import logging
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import Document, User
from app.services import local_vector_store
from app.services.auth_service import get_current_user
from app.services.health import AlertService, HealthScanner, HealthScorer

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/knowledge-health", tags=["knowledge-health"])

# Service instances (singleton pattern)
health_scorer = HealthScorer()
alert_service = AlertService()
health_scanner = HealthScanner(alert_service)


@router.get("")
async def get_health_dashboard(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get comprehensive health dashboard for organization.
    Returns health score, metrics, and recommendations based on real data.
    """
    try:
        org_id = str(current_user.organization_id)
        logger.info(f"Getting health dashboard for org {org_id}")

        # Get real document counts from database
        result = await db.execute(
            select(func.count(Document.document_id)).where(
                Document.organization_id == org_id
            )
        )
        total_docs = result.scalar() or 0

        # Get indexed document count
        result = await db.execute(
            select(func.count(Document.document_id)).where(
                Document.organization_id == org_id,
                Document.status == "indexed"
            )
        )
        indexed_docs = result.scalar() or 0

        # Calculate average document age
        result = await db.execute(
            select(func.avg(
                func.julianday(func.datetime('now')) - func.julianday(Document.created_at)
            )).where(Document.organization_id == org_id)
        )
        avg_doc_age_days = result.scalar() or 0.0

        # Get vector index stats from local vector store
        index_stats = local_vector_store.get_stats(org_id)
        total_chunks = index_stats.get("total_chunks", 0)

        # Get alerts
        alerts = await alert_service.get_alerts(org_id)
        active_alerts = [a for a in alerts if a["status"] == "active"]
        conflicts = [a for a in active_alerts if a["type"] == "conflict"]
        outdated_docs = [a for a in active_alerts if a["type"] == "outdated"]
        gaps = [a for a in active_alerts if a["type"] == "knowledge_gap"]

        # Calculate health score with real data
        health_score = await health_scorer.calculate_health_score(
            org_id=org_id,
            conflicts=conflicts,
            outdated_docs=outdated_docs,
            gaps=gaps,
            total_docs=total_docs,
            total_queries=total_chunks,  # Use chunks as proxy for search coverage
            successful_queries=total_chunks,
            avg_doc_age_days=float(avg_doc_age_days)
        )

        # Get alert summary
        alert_summary = await alert_service.get_alert_summary(org_id)
        critical_alerts = await alert_service.get_critical_alerts(org_id)

        return {
            "org_id": org_id,
            "health_score": health_score,
            "document_stats": {
                "total_documents": total_docs,
                "indexed_documents": indexed_docs,
                "total_chunks": total_chunks,
                "avg_document_age_days": round(avg_doc_age_days, 1)
            },
            "alert_summary": alert_summary,
            "critical_alerts": critical_alerts[:5],
            "last_updated": datetime.utcnow().isoformat()
        }

    except Exception as e:
        logger.error(f"Error getting health dashboard: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/score")
async def get_health_score(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get health score for organization.
    Returns overall score, component scores, and recommendations.
    """
    try:
        org_id = str(current_user.organization_id)

        # Get document counts
        result = await db.execute(
            select(func.count(Document.document_id)).where(
                Document.organization_id == org_id
            )
        )
        total_docs = result.scalar() or 0

        # Get average document age
        result = await db.execute(
            select(func.avg(
                func.julianday(func.datetime('now')) - func.julianday(Document.created_at)
            )).where(Document.organization_id == org_id)
        )
        avg_doc_age_days = result.scalar() or 0.0

        # Get index stats from local vector store
        index_stats = local_vector_store.get_stats(org_id)
        total_chunks = index_stats.get("total_chunks", 0)

        # Get active alerts
        alerts = await alert_service.get_alerts(org_id, status="active")
        conflicts = [a for a in alerts if a["type"] == "conflict"]
        outdated_docs = [a for a in alerts if a["type"] == "outdated"]
        gaps = [a for a in alerts if a["type"] == "knowledge_gap"]

        # Calculate health score
        health_score = await health_scorer.calculate_health_score(
            org_id=org_id,
            conflicts=conflicts,
            outdated_docs=outdated_docs,
            gaps=gaps,
            total_docs=total_docs,
            total_queries=total_chunks,
            successful_queries=total_chunks,
            avg_doc_age_days=float(avg_doc_age_days)
        )

        return health_score

    except Exception as e:
        logger.error(f"Error calculating health score: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/alerts")
async def get_alerts(
    status: str | None = Query(None, description="Filter by status"),
    severity: str | None = Query(None, description="Filter by severity"),
    alert_type: str | None = Query(None, description="Filter by type"),
    current_user: User = Depends(get_current_user)
):
    """Get alerts for organization with optional filtering."""
    try:
        org_id = str(current_user.organization_id)

        alerts = await alert_service.get_alerts(
            org_id=org_id,
            status=status,
            severity=severity,
            alert_type=alert_type
        )

        return {
            "alerts": alerts,
            "total": len(alerts)
        }

    except Exception as e:
        logger.error(f"Error getting alerts: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts")
async def create_alert(
    alert_type: str = Query(..., description="Alert type: conflict, outdated, knowledge_gap"),
    severity: str = Query(..., description="Severity: high, medium, low"),
    description: str = Query(..., description="Alert description"),
    current_user: User = Depends(get_current_user)
):
    """Create a new health alert."""
    try:
        org_id = str(current_user.organization_id)

        alert = await alert_service.create_alert(
            org_id=org_id,
            alert_type=alert_type,
            severity=severity,
            description=description
        )

        return alert

    except Exception as e:
        logger.error(f"Error creating alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/alerts/{alert_id}")
async def update_alert(
    alert_id: str,
    status: str | None = Query(None, description="New status"),
    resolution: str | None = Query(None, description="Resolution description"),
    current_user: User = Depends(get_current_user)
):
    """Update an alert status or resolution."""
    try:
        updated = await alert_service.update_alert(
            alert_id=alert_id,
            status=status,
            resolution=resolution
        )

        if not updated:
            raise HTTPException(status_code=404, detail="Alert not found")

        return updated

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/resolve")
async def resolve_alert(
    alert_id: str,
    resolution: str = Query(..., description="Resolution description"),
    current_user: User = Depends(get_current_user)
):
    """Resolve an alert."""
    try:
        resolved = await alert_service.resolve_alert(alert_id, resolution)

        if not resolved:
            raise HTTPException(status_code=404, detail="Alert not found")

        return resolved

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error resolving alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/alerts/{alert_id}/dismiss")
async def dismiss_alert(
    alert_id: str,
    reason: str | None = Query(None, description="Dismissal reason"),
    current_user: User = Depends(get_current_user)
):
    """Dismiss an alert."""
    try:
        dismissed = await alert_service.dismiss_alert(alert_id, reason)

        if not dismissed:
            raise HTTPException(status_code=404, detail="Alert not found")

        return dismissed

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error dismissing alert: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/summary")
async def get_alert_summary(
    current_user: User = Depends(get_current_user)
):
    """Get summary statistics for organization alerts."""
    try:
        org_id = str(current_user.organization_id)
        summary = await alert_service.get_alert_summary(org_id)
        return summary

    except Exception as e:
        logger.error(f"Error getting alert summary: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scan")
async def run_health_scan(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Run a full health scan for the organization.
    Detects conflicts, outdated documents, and knowledge gaps.
    Creates alerts for any issues found.
    """
    try:
        org_id = str(current_user.organization_id)
        logger.info(f"Running health scan for org {org_id}")

        results = await health_scanner.scan_all(org_id, db)

        return {
            "success": True,
            "results": results
        }

    except Exception as e:
        logger.error(f"Error running health scan: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/scan/{document_id}")
async def scan_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Scan a single document for health issues."""
    try:
        org_id = str(current_user.organization_id)

        results = await health_scanner.scan_document(document_id, org_id, db)

        return results

    except Exception as e:
        logger.error(f"Error scanning document: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
