"""Pydantic schemas for Decision API."""

from datetime import datetime
from enum import Enum
from typing import Any

from pydantic import BaseModel, Field, validator


class DecisionCategory(str, Enum):
    """Decision category types."""
    STRATEGIC = "strategic"
    OPERATIONAL = "operational"
    TACTICAL = "tactical"
    FINANCIAL = "financial"
    TECHNICAL = "technical"


class DecisionStatus(str, Enum):
    """Decision status values."""
    ACTIVE = "active"
    ARCHIVED = "archived"
    IMPLEMENTED = "implemented"
    ABANDONED = "abandoned"


class FactorCategory(str, Enum):
    """Factor category types."""
    MARKET = "market"
    FINANCIAL = "financial"
    TECHNICAL = "technical"
    ORGANIZATIONAL = "organizational"
    CUSTOMER = "customer"
    COMPETITIVE = "competitive"
    REGULATORY = "regulatory"
    STRATEGIC = "strategic"


class ImpactLevel(str, Enum):
    """Impact level values."""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class Timeframe(str, Enum):
    """Timeframe values."""
    SHORT_TERM = "short-term"
    MEDIUM_TERM = "medium-term"
    LONG_TERM = "long-term"


# Request Schemas

class DecisionCreate(BaseModel):
    """Schema for creating a new decision."""
    title: str = Field(..., min_length=3, max_length=255)
    description: str = Field(..., min_length=10)
    category: DecisionCategory | None = None
    decision_date: datetime | None = None
    context: dict[str, Any] | None = None

    @validator('title')
    def title_not_empty(cls, v):
        if not v.strip():
            raise ValueError('Title cannot be empty')
        return v.strip()


class DecisionUpdate(BaseModel):
    """Schema for updating a decision."""
    title: str | None = Field(None, min_length=3, max_length=255)
    description: str | None = Field(None, min_length=10)
    category: DecisionCategory | None = None
    status: DecisionStatus | None = None
    decision_date: datetime | None = None
    context: dict[str, Any] | None = None


class DecisionQuery(BaseModel):
    """Schema for querying past decisions."""
    query: str = Field(..., min_length=3, max_length=500)
    include_timeline: bool = Field(default=True)
    include_factors: bool = Field(default=True)
    max_results: int = Field(default=10, ge=1, le=50)


# Response Schemas

class FactorResponse(BaseModel):
    """Schema for decision factor response."""
    id: str
    decision_id: str
    name: str
    category: FactorCategory
    impact_score: int = Field(..., ge=1, le=10)
    explanation: str | None = None
    created_at: datetime

    class Config:
        from_attributes = True


class OutcomeResponse(BaseModel):
    """Schema for decision outcome response."""
    id: str
    decision_id: str
    description: str
    outcome_type: str
    likelihood: int | None = Field(None, ge=0, le=100)
    impact: ImpactLevel | None = None
    timeframe: Timeframe | None = None
    status: str
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class DecisionResponse(BaseModel):
    """Schema for decision response."""
    id: str
    user_id: str
    title: str
    description: str
    category: str | None = None
    status: str
    context: dict[str, Any] | None = None
    graph_node_id: str | None = None
    created_at: datetime
    updated_at: datetime
    decision_date: datetime | None = None
    factors: list[FactorResponse] = []
    outcomes: list[OutcomeResponse] = []

    class Config:
        from_attributes = True


class TimelineEvent(BaseModel):
    """Schema for timeline event."""
    date: str
    type: str
    title: str
    is_main: bool = False
    relationship: str | None = None


class TimelineResponse(BaseModel):
    """Schema for decision timeline response."""
    decision_id: str
    decision_title: str
    events: list[TimelineEvent]


class RelatedDecision(BaseModel):
    """Schema for related decision."""
    id: str
    title: str
    date: str
    relationships: list[str]
    distance: int


class RelatedDecisionsResponse(BaseModel):
    """Schema for related decisions response."""
    decision_id: str
    related: list[RelatedDecision]


class GraphStats(BaseModel):
    """Schema for graph statistics."""
    decisions: int
    people: int
    projects: int
    factors: int
    relationships: int


class EntityExtraction(BaseModel):
    """Schema for extracted entities."""
    decisions: list[str]
    people: list[str]
    projects: list[str]
    dates: list[str]
    keywords: list[str]


class FactorAnalysis(BaseModel):
    """Schema for factor analysis."""
    name: str
    category: FactorCategory
    impact_score: int = Field(..., ge=1, le=10)
    explanation: str


class FactorAnalysisResponse(BaseModel):
    """Schema for factor analysis response."""
    decision_id: str
    factors: list[FactorAnalysis]


class DecisionComparison(BaseModel):
    """Schema for decision comparison."""
    decision1_id: str
    decision2_id: str
    similarities: list[str]
    differences: list[str]
    relationship: str
    insights: list[str]


class PredictedOutcome(BaseModel):
    """Schema for predicted outcome."""
    description: str
    likelihood: int = Field(..., ge=0, le=100)
    impact: ImpactLevel
    timeframe: Timeframe


class OutcomePrediction(BaseModel):
    """Schema for outcome prediction."""
    decision_id: str
    outcomes: list[PredictedOutcome]
    risks: list[str]
    opportunities: list[str]


class DecisionList(BaseModel):
    """Schema for paginated decision list."""
    decisions: list[DecisionResponse]
    total: int
    page: int
    page_size: int


# Analysis Schemas

class AnalysisRequest(BaseModel):
    """Schema for decision analysis request."""
    decision_id: str
    include_timeline: bool = True
    include_factors: bool = True
    include_predictions: bool = True


class AnalysisResponse(BaseModel):
    """Schema for complete decision analysis."""
    decision: DecisionResponse
    timeline: TimelineResponse | None = None
    factors: list[FactorAnalysis] | None = None
    predictions: OutcomePrediction | None = None
    related_decisions: list[RelatedDecision] | None = None


# Phase 6: Pattern Analysis Schemas

class PatternTimespan(BaseModel):
    """Schema for pattern timespan."""
    start: str
    end: str


class DecisionPattern(BaseModel):
    """Schema for a detected decision pattern."""
    pattern_type: str
    description: str
    frequency: int
    decisions: list[str]
    timespan: PatternTimespan


class PatternAnalysisRequest(BaseModel):
    """Schema for pattern analysis request."""
    start_date: datetime | None = None
    end_date: datetime | None = None


class PatternAnalysisResponse(BaseModel):
    """Schema for pattern analysis response."""
    patterns: list[DecisionPattern]
    insights: list[str]
    recommendations: list[str]


# Phase 6: AI Insights Schemas

class InsightType(str, Enum):
    """AI insight types."""
    OBSERVATION = "observation"
    RECOMMENDATION = "recommendation"
    RISK = "risk"
    OPPORTUNITY = "opportunity"


class AIInsight(BaseModel):
    """Schema for a single AI insight."""
    type: InsightType
    title: str
    description: str
    confidence: float = Field(..., ge=0.0, le=1.0)
    related_factors: list[str] | None = None


class AIInsightsResponse(BaseModel):
    """Schema for AI insights response."""
    decision_id: str
    insights: list[AIInsight]
    summary: str
    generated_at: datetime
