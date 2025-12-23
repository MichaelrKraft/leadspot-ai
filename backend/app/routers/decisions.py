"""FastAPI router for Decision endpoints."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.models.decision import Decision, DecisionFactor, DecisionOutcome
from app.models.user import User
from app.schemas.decision import (
    AIInsightsResponse,
    DecisionCreate,
    DecisionList,
    DecisionQuery,
    DecisionResponse,
    DecisionUpdate,
    FactorAnalysis,
    FactorAnalysisResponse,
    GraphStats,
    OutcomePrediction,
    PatternAnalysisRequest,
    PatternAnalysisResponse,
    RelatedDecisionsResponse,
    TimelineResponse,
)
from app.services.auth_service import get_current_user
from app.services.decision.entity_extractor import EntityExtractor
from app.services.decision.factor_analyzer import FactorAnalyzer
from app.services.decision.graph_populator import GraphPopulator
from app.services.decision.timeline_service import TimelineService
from app.services.neo4j_service import neo4j_service

router = APIRouter(prefix="/api/decisions", tags=["decisions"])

# Initialize services
entity_extractor = EntityExtractor()
timeline_service = TimelineService(neo4j_service)
factor_analyzer = FactorAnalyzer()
graph_populator = GraphPopulator(neo4j_service)


@router.post("/", response_model=DecisionResponse, status_code=status.HTTP_201_CREATED)
async def create_decision(
    decision: DecisionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Create a new decision and populate the knowledge graph.

    This endpoint:
    1. Creates a decision record in PostgreSQL
    2. Extracts entities (people, projects, dates) from the description
    3. Analyzes factors that influenced the decision
    4. Populates the Neo4j knowledge graph with nodes and relationships
    """
    # Create decision in database
    db_decision = Decision(
        user_id=current_user.user_id,
        title=decision.title,
        description=decision.description,
        category=decision.category.value if decision.category else None,
        decision_date=decision.decision_date,
        context=decision.context
    )
    db.add(db_decision)
    await db.commit()
    await db.refresh(db_decision)

    try:
        # Extract entities from description
        entities = await entity_extractor.extract_entities(
            f"{decision.title}. {decision.description}"
        )

        # Analyze factors
        factors = await factor_analyzer.analyze_decision_factors(
            decision_title=decision.title,
            decision_description=decision.description,
            context=entities
        )

        # Store factors in database
        for factor_data in factors:
            db_factor = DecisionFactor(
                decision_id=db_decision.id,
                name=factor_data["name"],
                category=factor_data["category"],
                impact_score=factor_data["impact_score"],
                explanation=factor_data.get("explanation")
            )
            db.add(db_factor)

        await db.commit()

        # Populate knowledge graph with organization isolation
        await graph_populator.populate_complete_decision(
            decision_id=db_decision.id,
            organization_id=str(current_user.organization_id),
            decision_data={
                "title": db_decision.title,
                "description": db_decision.description,
                "created_at": db_decision.created_at,
                "user_id": db_decision.user_id,
                "metadata": {
                    "category": db_decision.category,
                    "status": db_decision.status
                }
            },
            entities=entities,
            factors=factors
        )

        # Update decision with graph node reference
        db_decision.graph_node_id = db_decision.id
        await db.commit()

    except Exception as e:
        print(f"Error populating knowledge graph: {e}")
        # Continue even if graph population fails

    await db.refresh(db_decision)
    return db_decision


@router.get("/", response_model=DecisionList)
async def list_decisions(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    category: str | None = None,
    status_filter: str | None = Query(None, alias="status"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    List all decisions for the current user with pagination and filtering.
    """
    # Build base query with eager loading of relationships
    query = select(Decision).options(
        selectinload(Decision.factors),
        selectinload(Decision.outcomes)
    ).where(Decision.user_id == current_user.user_id)

    if category:
        query = query.where(Decision.category == category)
    if status_filter:
        query = query.where(Decision.status == status_filter)

    # Get total count
    count_query = select(func.count()).select_from(Decision).where(Decision.user_id == current_user.user_id)
    if category:
        count_query = count_query.where(Decision.category == category)
    if status_filter:
        count_query = count_query.where(Decision.status == status_filter)

    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Get paginated results
    query = query.order_by(Decision.created_at.desc()).offset(
        (page - 1) * page_size
    ).limit(page_size)

    result = await db.execute(query)
    decisions = result.scalars().all()

    return {
        "decisions": decisions,
        "total": total,
        "page": page,
        "page_size": page_size
    }


@router.get("/{decision_id}", response_model=DecisionResponse)
async def get_decision(
    decision_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get a specific decision by ID.
    """
    result = await db.execute(
        select(Decision).options(
            selectinload(Decision.factors),
            selectinload(Decision.outcomes)
        ).where(
            Decision.id == decision_id,
            Decision.user_id == current_user.user_id
        )
    )
    decision = result.scalars().first()

    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision not found"
        )

    return decision


@router.put("/{decision_id}", response_model=DecisionResponse)
async def update_decision(
    decision_id: str,
    decision_update: DecisionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Update a decision.
    """
    result = await db.execute(
        select(Decision).where(
            Decision.id == decision_id,
            Decision.user_id == current_user.user_id
        )
    )
    decision = result.scalars().first()

    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision not found"
        )

    # Update fields
    update_data = decision_update.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(decision, field):
            if (field == "category" and value) or (field == "status" and value):
                setattr(decision, field, value.value)
            else:
                setattr(decision, field, value)

    await db.commit()

    # Update graph node metadata with organization isolation
    if decision.graph_node_id:
        try:
            await graph_populator.update_decision_metadata(
                decision.id,
                str(current_user.organization_id),
                {"category": decision.category, "status": decision.status}
            )
        except Exception as e:
            print(f"Error updating graph metadata: {e}")

    # Re-fetch with eager loading for response
    result = await db.execute(
        select(Decision).options(
            selectinload(Decision.factors),
            selectinload(Decision.outcomes)
        ).where(Decision.id == decision_id)
    )
    return result.scalars().first()


@router.delete("/{decision_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_decision(
    decision_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Delete a decision and its graph node.
    """
    result = await db.execute(
        select(Decision).where(
            Decision.id == decision_id,
            Decision.user_id == current_user.user_id
        )
    )
    decision = result.scalars().first()

    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision not found"
        )

    # Delete from graph with organization isolation
    if decision.graph_node_id:
        try:
            await graph_populator.delete_decision_node(
                decision.id,
                str(current_user.organization_id)
            )
        except Exception as e:
            print(f"Error deleting graph node: {e}")

    # Delete from database (cascade will handle factors and outcomes)
    await db.delete(decision)
    await db.commit()


@router.get("/{decision_id}/timeline", response_model=TimelineResponse)
async def get_decision_timeline(
    decision_id: str,
    include_related: bool = Query(True),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get the chronological timeline of events related to a decision.
    """
    # Verify decision exists and belongs to user
    result = await db.execute(
        select(Decision).where(
            Decision.id == decision_id,
            Decision.user_id == current_user.user_id
        )
    )
    decision = result.scalars().first()

    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision not found"
        )

    # Get timeline from graph with organization isolation
    timeline_events = await timeline_service.get_decision_timeline(
        decision_id=decision_id,
        organization_id=str(current_user.organization_id),
        include_related=include_related
    )

    return {
        "decision_id": decision_id,
        "decision_title": decision.title,
        "events": timeline_events
    }


@router.get("/{decision_id}/related", response_model=RelatedDecisionsResponse)
async def get_related_decisions(
    decision_id: str,
    max_depth: int = Query(2, ge=1, le=3),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Find decisions related through the knowledge graph.
    """
    # Verify decision exists
    result = await db.execute(
        select(Decision).where(
            Decision.id == decision_id,
            Decision.user_id == current_user.user_id
        )
    )
    decision = result.scalars().first()

    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision not found"
        )

    # Get related decisions from graph with organization isolation
    related = await timeline_service.find_related_decisions(
        decision_id=decision_id,
        organization_id=str(current_user.organization_id),
        max_depth=max_depth
    )

    return {
        "decision_id": decision_id,
        "related": related
    }


@router.get("/{decision_id}/factors", response_model=FactorAnalysisResponse)
async def get_decision_factors(
    decision_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get analyzed factors that influenced a decision.
    """
    result = await db.execute(
        select(Decision).where(
            Decision.id == decision_id,
            Decision.user_id == current_user.user_id
        )
    )
    decision = result.scalars().first()

    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision not found"
        )

    # Convert factors to response format
    factors = [
        FactorAnalysis(
            name=f.name,
            category=f.category,
            impact_score=f.impact_score,
            explanation=f.explanation or ""
        )
        for f in decision.factors
    ]

    return {
        "decision_id": decision_id,
        "factors": factors
    }


@router.post("/{decision_id}/predict-outcomes", response_model=OutcomePrediction)
async def predict_outcomes(
    decision_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Predict potential outcomes based on decision factors.
    """
    result = await db.execute(
        select(Decision).where(
            Decision.id == decision_id,
            Decision.user_id == current_user.user_id
        )
    )
    decision = result.scalars().first()

    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision not found"
        )

    # Get factors
    factors = [f.to_dict() for f in decision.factors]

    # Predict outcomes
    predictions = await factor_analyzer.predict_outcomes(
        decision_title=decision.title,
        decision_description=decision.description,
        factors=factors
    )

    # Store predicted outcomes
    for outcome_data in predictions.get("outcomes", []):
        db_outcome = DecisionOutcome(
            decision_id=decision.id,
            description=outcome_data["description"],
            outcome_type="predicted",
            likelihood=outcome_data.get("likelihood"),
            impact=outcome_data.get("impact"),
            timeframe=outcome_data.get("timeframe"),
            status="predicted"
        )
        db.add(db_outcome)

    await db.commit()

    return {
        "decision_id": decision_id,
        **predictions
    }


@router.post("/query", response_model=list[DecisionResponse])
async def query_decisions(
    query: DecisionQuery,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Query decisions using natural language.
    """
    # Extract entities from query
    entities = await entity_extractor.extract_entities(query.query)

    # Search in knowledge graph with organization isolation
    keywords = entities.get("keywords", []) + entities.get("decisions", [])
    graph_results = await neo4j_service.search_decisions(
        keywords=keywords,
        organization_id=str(current_user.organization_id),
        limit=query.max_results
    )

    # Get decision IDs from graph results
    decision_ids = [r["id"] for r in graph_results]

    # Fetch from database with eager loading
    result = await db.execute(
        select(Decision).options(
            selectinload(Decision.factors),
            selectinload(Decision.outcomes)
        ).where(
            Decision.id.in_(decision_ids),
            Decision.user_id == current_user.user_id
        )
    )
    decisions = result.scalars().all()

    return decisions


@router.get("/stats/graph", response_model=GraphStats)
async def get_graph_stats(
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics about the knowledge graph for the current organization.
    """
    stats = await neo4j_service.get_graph_stats(
        organization_id=str(current_user.organization_id)
    )
    return stats


@router.post("/analyze-patterns", response_model=PatternAnalysisResponse)
async def analyze_patterns(
    request: PatternAnalysisRequest = None,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Analyze patterns across all user decisions.

    Identifies recurring themes, decision types, and provides insights
    and recommendations based on decision history.
    """
    # Build query for user's decisions
    query = select(Decision).where(Decision.user_id == current_user.user_id)

    # Apply date filters if provided
    if request and request.start_date:
        query = query.where(Decision.created_at >= request.start_date)
    if request and request.end_date:
        query = query.where(Decision.created_at <= request.end_date)

    query = query.order_by(Decision.created_at.desc())

    result = await db.execute(query)
    decisions = result.scalars().all()

    # Convert to dicts for analysis
    decisions_data = [
        {
            "title": d.title,
            "description": d.description,
            "category": d.category,
            "created_at": d.created_at.isoformat() if d.created_at else None
        }
        for d in decisions
    ]

    # Analyze patterns
    analysis = await factor_analyzer.analyze_patterns(decisions_data)

    return analysis


@router.get("/{decision_id}/insights", response_model=AIInsightsResponse)
async def get_decision_insights(
    decision_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Generate AI-powered insights for a specific decision.

    Returns observations, recommendations, risks, and opportunities
    based on the decision's factors, outcomes, and related decisions.
    """
    # Get decision with eager loading for factors and outcomes
    result = await db.execute(
        select(Decision).options(
            selectinload(Decision.factors),
            selectinload(Decision.outcomes)
        ).where(
            Decision.id == decision_id,
            Decision.user_id == current_user.user_id
        )
    )
    decision = result.scalars().first()

    if not decision:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Decision not found"
        )

    # Get factors
    factors = [f.to_dict() for f in decision.factors] if decision.factors else []

    # Get outcomes
    outcomes = [
        {
            "description": o.description,
            "likelihood": o.likelihood,
            "impact": o.impact,
            "timeframe": o.timeframe
        }
        for o in decision.outcomes
    ] if decision.outcomes else []

    # Get related decisions from graph with organization isolation
    try:
        related = await timeline_service.find_related_decisions(
            decision_id=decision_id,
            organization_id=str(current_user.organization_id),
            max_depth=2
        )
    except Exception:
        related = []

    # Generate insights
    insights_data = await factor_analyzer.generate_insights(
        decision_title=decision.title,
        decision_description=decision.description,
        factors=factors,
        outcomes=outcomes,
        related_decisions=related
    )

    return {
        "decision_id": decision_id,
        "insights": insights_data.get("insights", []),
        "summary": insights_data.get("summary", ""),
        "generated_at": datetime.utcnow()
    }
