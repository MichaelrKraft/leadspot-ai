"""
Query routes - Full RAG pipeline implementation
"""

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query as FastAPIQuery, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.schemas.query import (
    PerformanceTrend,
    PopularQuery,
    QueryHistoryItem,
    QueryRequest,
    QueryResponse,
    QueryStatistics,
)
from app.services.analytics_service import get_analytics_service
from app.services.auth_service import get_current_user
from app.services.cache_service import get_cache_service
from app.services.query_preprocessor import decompose_query
from app.services.query_service import get_query_service

router = APIRouter()


@router.post("/query", response_model=QueryResponse)
async def process_query(
    request: QueryRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Process a knowledge synthesis query through complete RAG pipeline

    Pipeline: embed → search → context → synthesize → cite

    - **query**: User's question (1-500 characters)
    - **organization_id**: Organization to search within
    - **max_sources**: Maximum sources to retrieve (1-20, default: 10)
    - **use_cache**: Whether to use cached results (default: true)
    - **research_mode**: Enable Research Mode for complex multi-part queries (default: false)

    Returns synthesized answer with sources, citations, follow-up questions, and performance metrics.
    """
    try:
        # Verify user has access to organization
        if current_user.organization_id != request.organization_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to organization resources"
            )

        # Get services
        cache_service = await get_cache_service()
        query_service = await get_query_service(cache_service=cache_service)
        analytics_service = get_analytics_service(db)

        # Research Mode: Decompose complex queries
        research_mode_used = False
        decomposition = None
        if request.research_mode:
            decomposition = await decompose_query(request.query)
            research_mode_used = decomposition.get("is_complex", False)

        # Process query through RAG pipeline
        # If research mode found sub-queries, we process them and combine
        if research_mode_used and decomposition and len(decomposition.get("sub_queries", [])) > 1:
            # Process each sub-query and combine results
            all_sources = []
            sub_answers = []

            for sub_query in decomposition["sub_queries"][:4]:  # Max 4 sub-queries
                sub_result = await query_service.process_query(
                    query=sub_query,
                    organization_id=request.organization_id,
                    max_sources=max(3, request.max_sources // 2),  # Fewer sources per sub-query
                    use_cache=request.use_cache
                )
                all_sources.extend(sub_result.get("sources", []))
                if sub_result.get("answer"):
                    sub_answers.append(f"**{sub_query}**\n{sub_result['answer']}")

            # Combine into final result
            combined_answer = "\n\n---\n\n".join(sub_answers)

            # Get the last sub-result's metrics as base
            result = sub_result
            result["answer"] = combined_answer
            result["sources"] = all_sources[:request.max_sources]  # Dedupe could be added
            result["research_mode"] = True
            result["sub_queries"] = decomposition["sub_queries"]
        else:
            # Standard single-query processing
            result = await query_service.process_query(
                query=request.query,
                organization_id=request.organization_id,
                max_sources=request.max_sources,
                use_cache=request.use_cache
            )
            result["research_mode"] = research_mode_used

        # Log query analytics
        query_record = await analytics_service.log_query(
            user_id=current_user.user_id,
            organization_id=request.organization_id,
            query_text=request.query,
            response_time_ms=result["metrics"]["total_time_ms"],
            sources_cited=result["citation_coverage"]["sources_cited"],
            total_sources_found=result["total_sources_found"],
            tokens_used=result["metrics"]["tokens_used"],
            cache_hit=result["metrics"]["cache_hit"]
        )

        # Add query_id to result
        result["query_id"] = query_record.query_id

        # Add to cache history
        if cache_service:
            await cache_service.add_to_query_history(
                str(current_user.user_id),
                {
                    "query_id": str(query_record.query_id),
                    "query_text": request.query,
                    "answer_preview": result["answer"][:200],
                    "response_time_ms": result["metrics"]["total_time_ms"],
                    "sources_cited": result["citation_coverage"]["sources_cited"],
                    "created_at": str(query_record.created_at)
                }
            )

        return QueryResponse(**result)

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error processing query: {e!s}"
        )


@router.get("/query/history", response_model=list[QueryHistoryItem])
async def get_query_history(
    limit: int = FastAPIQuery(default=20, ge=1, le=100),
    offset: int = FastAPIQuery(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get query history for current user

    - **limit**: Maximum queries to return (1-100, default: 20)
    - **offset**: Number of queries to skip (default: 0)

    Returns list of past queries with preview information.
    """
    try:
        analytics_service = get_analytics_service(db)

        # Get query history from database
        queries = await analytics_service.get_user_query_history(
            user_id=current_user.user_id,
            limit=limit,
            offset=offset
        )

        # Convert to response schema
        history_items = []
        for query in queries:
            history_items.append(QueryHistoryItem(
                query_id=query.query_id,
                query_text=query.query_text,
                answer_preview="",  # Not stored in DB
                response_time_ms=query.response_time_ms,
                sources_cited=query.sources_cited,
                created_at=query.created_at,
                cache_hit=query.cache_hit if hasattr(query, 'cache_hit') else False
            ))

        return history_items

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving query history: {e!s}"
        )


@router.get("/query/{query_id}")
async def get_query_details(
    query_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get detailed information about a specific query

    - **query_id**: UUID of the query

    Returns full query details including answer, sources, and citations.
    Note: Full answer and citations are not stored in DB in current implementation.
    """
    try:
        from sqlalchemy import select

        from app.models import Query as QueryModel

        # Get query from database
        result = await db.execute(
            select(QueryModel).where(QueryModel.query_id == query_id)
        )
        query = result.scalar_one_or_none()

        if not query:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Query not found"
            )

        # Verify user has access
        if query.user_id != current_user.user_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied to this query"
            )

        # Return basic query information
        # Note: Full answer and citations would need to be cached separately
        return {
            "query_id": query.query_id,
            "query_text": query.query_text,
            "response_time_ms": query.response_time_ms,
            "sources_cited": query.sources_cited,
            "created_at": query.created_at,
            "message": "Full answer and citations not available - use cache or re-run query"
        }

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving query details: {e!s}"
        )


@router.get("/query/stats/organization", response_model=QueryStatistics)
async def get_organization_statistics(
    days: int = FastAPIQuery(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get query statistics for current user's organization

    - **days**: Number of days to analyze (1-365, default: 30)

    Returns comprehensive statistics including usage patterns and performance metrics.
    """
    try:
        analytics_service = get_analytics_service(db)

        stats = await analytics_service.get_query_statistics(
            organization_id=current_user.organization_id,
            days=days
        )

        return QueryStatistics(**stats)

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving statistics: {e!s}"
        )


@router.get("/query/stats/popular", response_model=list[PopularQuery])
async def get_popular_queries(
    limit: int = FastAPIQuery(default=10, ge=1, le=50),
    days: int = FastAPIQuery(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get most popular query patterns for organization

    - **limit**: Maximum queries to return (1-50, default: 10)
    - **days**: Number of days to analyze (1-365, default: 30)

    Returns list of most frequently asked queries.
    """
    try:
        analytics_service = get_analytics_service(db)

        popular = await analytics_service.get_popular_queries(
            organization_id=current_user.organization_id,
            limit=limit,
            days=days
        )

        return [PopularQuery(**q) for q in popular]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving popular queries: {e!s}"
        )


@router.get("/query/stats/trends", response_model=list[PerformanceTrend])
async def get_performance_trends(
    days: int = FastAPIQuery(default=30, ge=1, le=365),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """
    Get daily performance trends for organization

    - **days**: Number of days to analyze (1-365, default: 30)

    Returns daily statistics showing usage and performance over time.
    """
    try:
        analytics_service = get_analytics_service(db)

        trends = await analytics_service.get_performance_trends(
            organization_id=current_user.organization_id,
            days=days
        )

        return [PerformanceTrend(**t) for t in trends]

    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Error retrieving performance trends: {e!s}"
        )
