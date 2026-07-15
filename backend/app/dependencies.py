from typing import Optional
"""
FastAPI Dependencies

Provides dependency injection for FastAPI routes:
- Authentication
- Service instances
- Database connections
"""

from fastapi import Depends

from app.database import get_db
from app.models.user import User
from app.services.auth_service import get_current_user as _get_current_user_orm
from app.services.ingestion.pipeline import IngestionPipeline

# Singleton instances
_pipeline: Optional[IngestionPipeline] = None
_cache_service = None
_query_service = None
_context_builder = None
_citation_service = None


def init_pipeline(
    openai_api_key: str,
    pinecone_api_key: str,
    pinecone_environment: str,
    pinecone_index_name: str,
    neo4j_uri: str,
    neo4j_username: str,
    neo4j_password: str
) -> IngestionPipeline:
    """
    Initialize ingestion pipeline singleton.

    This should be called during app startup.
    """
    global _pipeline
    _pipeline = IngestionPipeline(
        openai_api_key=openai_api_key,
        pinecone_api_key=pinecone_api_key,
        pinecone_environment=pinecone_environment,
        pinecone_index_name=pinecone_index_name,
        neo4j_uri=neo4j_uri,
        neo4j_username=neo4j_username,
        neo4j_password=neo4j_password
    )
    return _pipeline


def get_ingestion_pipeline() -> IngestionPipeline:
    """
    Get ingestion pipeline instance.

    Dependency for FastAPI routes.
    """
    if not _pipeline:
        raise RuntimeError("Ingestion pipeline not initialized. Call init_pipeline() during startup.")
    return _pipeline


async def get_current_user(
    user: User = Depends(_get_current_user_orm)
) -> dict:
    """
    Get current authenticated user as a dict.

    Thin adapter over the canonical auth_service.get_current_user
    (single JWT validation path). Kept for routers that consume the
    dict shape: id, email, organization_id, role.
    """
    return {
        "id": str(user.user_id),
        "email": user.email,
        "organization_id": str(user.organization_id),
        "role": user.role,
    }


async def get_cache_service_dependency():
    """
    Get cache service dependency for FastAPI routes.

    Returns:
        CacheService instance
    """
    from app.services.cache_service import get_cache_service

    global _cache_service
    if _cache_service is None:
        _cache_service = await get_cache_service()
    return _cache_service


async def get_query_service_dependency(
    cache_service=Depends(get_cache_service_dependency)
):
    """
    Get query service dependency for FastAPI routes.

    Args:
        cache_service: Injected cache service

    Returns:
        QueryService instance
    """
    from app.services.query_service import get_query_service

    global _query_service
    if _query_service is None:
        _query_service = await get_query_service(cache_service=cache_service)
    return _query_service


def get_context_builder_dependency():
    """
    Get context builder dependency for FastAPI routes.

    Returns:
        ContextBuilder instance
    """
    from app.services.context_builder import get_context_builder

    global _context_builder
    if _context_builder is None:
        _context_builder = get_context_builder()
    return _context_builder


def get_citation_service_dependency():
    """
    Get citation service dependency for FastAPI routes.

    Returns:
        CitationService instance
    """
    from app.services.citation_service import get_citation_service

    global _citation_service
    if _citation_service is None:
        _citation_service = get_citation_service()
    return _citation_service


def get_analytics_service_dependency(db=Depends(get_db)):
    """
    Get analytics service dependency for FastAPI routes.

    Args:
        db: Database session

    Returns:
        AnalyticsService instance
    """
    from app.services.analytics_service import get_analytics_service
    return get_analytics_service(db)
