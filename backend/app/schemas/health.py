"""Pydantic schemas for Knowledge Health System."""

from typing import Any

from pydantic import BaseModel, Field


# Alert Schemas
class AlertBase(BaseModel):
    """Base alert schema."""
    type: str = Field(..., description="Alert type: conflict, outdated, knowledge_gap")
    severity: str = Field(..., description="Severity: high, medium, low")
    description: str = Field(..., description="Human-readable alert description")
    metadata: dict[str, Any] | None = Field(default=None, description="Additional metadata")


class AlertCreate(AlertBase):
    """Schema for creating a new alert."""
    org_id: str = Field(..., description="Organization ID")


class AlertUpdate(BaseModel):
    """Schema for updating an alert."""
    status: str | None = Field(None, description="Status: active, resolved, dismissed")
    resolution: str | None = Field(None, description="Resolution description")


class AlertResponse(AlertBase):
    """Schema for alert response."""
    id: str = Field(..., description="Alert ID")
    org_id: str = Field(..., description="Organization ID")
    status: str = Field(..., description="Alert status")
    created_at: str = Field(..., description="Creation timestamp")
    updated_at: str = Field(..., description="Last update timestamp")
    resolved_at: str | None = Field(None, description="Resolution timestamp")
    resolution: str | None = Field(None, description="Resolution description")

    class Config:
        from_attributes = True


# Conflict Schemas
class ConflictAlert(AlertResponse):
    """Schema for conflict alert with specific metadata."""
    doc1_id: str | None = Field(None, description="First document ID")
    doc1_title: str | None = Field(None, description="First document title")
    doc2_id: str | None = Field(None, description="Second document ID")
    doc2_title: str | None = Field(None, description="Second document title")
    similarity_score: float | None = Field(None, description="Similarity score (0-1)")


# Outdated Document Schemas
class OutdatedAlert(AlertResponse):
    """Schema for outdated document alert."""
    doc_id: str | None = Field(None, description="Document ID")
    signals: list[dict[str, Any]] | None = Field(None, description="Staleness signals")


# Knowledge Gap Schemas
class KnowledgeGapAlert(AlertResponse):
    """Schema for knowledge gap alert."""
    query_pattern: str | None = Field(None, description="Query pattern that triggered gap")
    occurrence_count: int | None = Field(None, description="Number of occurrences")
    suggested_topics: list[str] | None = Field(None, description="Suggested documentation topics")
    gap_source: str | None = Field(None, description="Gap source: failed_queries, low_confidence, frequent_queries")


# Health Score Schemas
class ComponentScores(BaseModel):
    """Component health scores."""
    completeness: float = Field(..., ge=0, le=100, description="Completeness score (0-100)")
    freshness: float = Field(..., ge=0, le=100, description="Freshness score (0-100)")
    consistency: float = Field(..., ge=0, le=100, description="Consistency score (0-100)")
    usage: float = Field(..., ge=0, le=100, description="Usage score (0-100)")
    coverage: float = Field(..., ge=0, le=100, description="Coverage score (0-100)")


class HealthMetrics(BaseModel):
    """Health metrics."""
    total_documents: int = Field(..., ge=0, description="Total number of documents")
    total_queries: int = Field(..., ge=0, description="Total number of queries")
    successful_queries: int = Field(..., ge=0, description="Number of successful queries")
    active_conflicts: int = Field(..., ge=0, description="Number of active conflicts")
    outdated_documents: int = Field(..., ge=0, description="Number of outdated documents")
    knowledge_gaps: int = Field(..., ge=0, description="Number of knowledge gaps")
    avg_doc_age_days: float = Field(..., ge=0, description="Average document age in days")


class HealthScoreResponse(BaseModel):
    """Complete health score response."""
    org_id: str = Field(..., description="Organization ID")
    overall_score: float = Field(..., ge=0, le=100, description="Overall health score (0-100)")
    health_status: str = Field(..., description="Health status: excellent, good, fair, poor, critical")
    component_scores: ComponentScores = Field(..., description="Component scores")
    metrics: HealthMetrics = Field(..., description="Health metrics")
    recommendations: list[str] = Field(..., description="Actionable recommendations")
    calculated_at: str = Field(..., description="Calculation timestamp")


# Alert Summary Schemas
class AlertSummary(BaseModel):
    """Summary of alerts for an organization."""
    total_alerts: int = Field(..., ge=0, description="Total number of alerts")
    active_alerts: int = Field(..., ge=0, description="Number of active alerts")
    by_severity: dict[str, int] = Field(..., description="Alert counts by severity")
    by_type: dict[str, int] = Field(..., description="Alert counts by type")
    resolved_count: int = Field(..., ge=0, description="Number of resolved alerts")
    dismissed_count: int = Field(..., ge=0, description="Number of dismissed alerts")


# Health Scan Schemas
class HealthScanRequest(BaseModel):
    """Request to trigger health scan."""
    org_id: str = Field(..., description="Organization ID")
    scan_type: str | None = Field(
        default="full",
        description="Scan type: full, conflicts_only, outdated_only, gaps_only"
    )


class HealthScanResponse(BaseModel):
    """Health scan response."""
    org_id: str = Field(..., description="Organization ID")
    scan_type: str = Field(..., description="Scan type")
    status: str = Field(..., description="Scan status: completed, failed, in_progress")
    alerts_created: int = Field(..., ge=0, description="Number of alerts created")
    health_score: HealthScoreResponse | None = Field(None, description="Updated health score")
    started_at: str = Field(..., description="Scan start timestamp")
    completed_at: str | None = Field(None, description="Scan completion timestamp")
    error: str | None = Field(None, description="Error message if scan failed")


# Query Tracking Schemas
class QueryTrackingRequest(BaseModel):
    """Request to track a query for gap detection."""
    org_id: str = Field(..., description="Organization ID")
    query: str = Field(..., min_length=1, description="Query text")
    confidence: float = Field(..., ge=0, le=1, description="Confidence score (0-1)")
    result_count: int = Field(..., ge=0, description="Number of results returned")
    user_id: str | None = Field(None, description="User ID")


# Bulk Operations
class BulkAlertCreate(BaseModel):
    """Schema for bulk alert creation."""
    org_id: str = Field(..., description="Organization ID")
    alerts: list[AlertBase] = Field(..., description="List of alerts to create")


class BulkAlertResponse(BaseModel):
    """Response for bulk alert creation."""
    created_count: int = Field(..., ge=0, description="Number of alerts created")
    alerts: list[AlertResponse] = Field(..., description="Created alerts")


# List Response Schemas
class AlertListResponse(BaseModel):
    """Paginated alert list response."""
    total: int = Field(..., ge=0, description="Total number of alerts")
    alerts: list[AlertResponse] = Field(..., description="List of alerts")
    page: int = Field(default=1, ge=1, description="Current page number")
    page_size: int = Field(default=50, ge=1, le=100, description="Page size")
    has_more: bool = Field(..., description="Whether more results exist")


# Health Dashboard Schema
class HealthDashboard(BaseModel):
    """Complete health dashboard data."""
    org_id: str = Field(..., description="Organization ID")
    health_score: HealthScoreResponse = Field(..., description="Overall health score")
    alert_summary: AlertSummary = Field(..., description="Alert summary")
    critical_alerts: list[AlertResponse] = Field(..., description="High-severity active alerts")
    recent_scans: list[HealthScanResponse] = Field(..., description="Recent health scans")
    last_updated: str = Field(..., description="Last update timestamp")
