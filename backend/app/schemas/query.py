"""
Query Pydantic schemas
"""

from datetime import datetime
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


class Source(BaseModel):
    """Schema for a source document"""
    document_id: UUID
    title: str
    url: str | None = None
    excerpt: str
    relevance_score: float = Field(..., ge=0.0, le=1.0)
    source_system: str | None = None  # e.g., "gmail", "google_drive", "upload"
    source_metadata: dict[str, Any] | None = None  # Additional metadata for source-specific info


class Citation(BaseModel):
    """Schema for a citation extracted from answer"""
    citation_text: str
    document_id: UUID
    document_title: str
    url: str | None = None
    excerpt: str
    relevance_score: float
    context: str
    position_in_answer: int


class CitationCoverage(BaseModel):
    """Schema for citation coverage metrics"""
    total_sources_available: int
    sources_cited: int
    total_citations: int
    citation_coverage_percent: float
    average_citations_per_source: float
    uncited_source_count: int


class QueryMetrics(BaseModel):
    """Schema for query pipeline metrics"""
    embed_time_ms: int
    search_time_ms: int
    context_time_ms: int
    synthesis_time_ms: int
    citation_time_ms: int
    total_time_ms: int
    cache_hit: bool
    tokens_used: int
    context_metadata: dict[str, Any] | None = None


class QueryFilters(BaseModel):
    """Schema for query filtering options"""
    max_sources: int = Field(default=10, ge=1, le=20)
    use_cache: bool = Field(default=True)
    include_citations: bool = Field(default=True)
    include_metrics: bool = Field(default=True)


class QueryRequest(BaseModel):
    """Schema for query request"""
    query: str = Field(..., min_length=1, max_length=500)
    organization_id: UUID
    max_sources: int = Field(default=10, ge=1, le=20)
    use_cache: bool = Field(default=True)
    research_mode: bool = Field(default=False, description="Enable Research Mode for complex queries")


class QueryResponse(BaseModel):
    """Schema for query response"""
    query_id: UUID | None = None
    answer: str
    sources: list[dict[str, Any]]
    citations: list[dict[str, Any]]
    citation_coverage: dict[str, Any]
    metrics: dict[str, Any]
    total_sources_found: int
    sources_used: int
    follow_up_questions: list[str] = Field(default_factory=list, description="AI-generated follow-up questions")
    research_mode: bool = Field(default=False, description="Whether research mode was used")


class QueryHistoryItem(BaseModel):
    """Schema for query history item"""
    query_id: UUID
    query_text: str
    answer_preview: str  # First 200 chars
    response_time_ms: int
    sources_cited: int
    created_at: datetime
    cache_hit: bool = False

    model_config = {"from_attributes": True}


class QueryDetails(BaseModel):
    """Schema for detailed query information"""
    query_id: UUID
    query_text: str
    answer: str
    sources: list[Source]
    citations: list[Citation]
    citation_coverage: CitationCoverage
    metrics: QueryMetrics
    created_at: datetime

    model_config = {"from_attributes": True}


class QueryStatistics(BaseModel):
    """Schema for query statistics"""
    period_days: int
    total_queries: int
    unique_users: int
    avg_response_time_ms: float
    avg_sources_cited: float
    total_tokens_used: int
    cache_hit_rate_percent: float
    queries_per_day: float


class PopularQuery(BaseModel):
    """Schema for popular query pattern"""
    query_text: str
    times_asked: int
    avg_response_time_ms: float


class PerformanceTrend(BaseModel):
    """Schema for daily performance trend"""
    date: str
    query_count: int
    avg_response_time_ms: float
    avg_sources_cited: float


class QueryAnalytics(BaseModel):
    """Schema for query analytics"""
    query_id: UUID
    user_id: UUID
    query_text: str
    response_time_ms: int
    sources_cited: int
    created_at: str

    model_config = {"from_attributes": True}
