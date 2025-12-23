"""
Local Query API Endpoints

Simple query endpoints that work without any API keys.
Uses local embeddings (sentence-transformers) and optional Ollama for synthesis.
"""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.services import local_query_service, local_vector_store
from app.services.auth_service import get_current_user
from app.services.document_service import get_decrypted_content

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/query", tags=["query-local"])


class QueryRequest(BaseModel):
    """Request model for query endpoint."""
    query: str = Field(..., min_length=1, max_length=1000, description="The search query")
    max_sources: int = Field(default=5, ge=1, le=20, description="Maximum sources to retrieve")
    use_llm: bool = Field(default=True, description="Whether to use LLM for answer synthesis")


class QueryResponse(BaseModel):
    """Response model for query endpoint."""
    answer: str
    sources: list
    metrics: dict
    synthesis_method: str
    follow_up_questions: list[str] = []


class IndexRequest(BaseModel):
    """Request model for indexing a document."""
    document_id: str


@router.post("/search", response_model=QueryResponse)
async def search_knowledge_base(
    request: QueryRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Search the knowledge base and get an AI-synthesized answer.

    This endpoint uses 100% local AI:
    - Embeddings: sentence-transformers (no API key)
    - Vector search: numpy-based (no API key)
    - Synthesis: Ollama (local, no API key) - optional

    If Ollama is not installed, returns search results without synthesis.
    """
    try:
        result = await local_query_service.process_query(
            query=request.query,
            organization_id=str(current_user.organization_id),
            max_sources=request.max_sources,
            use_llm=request.use_llm
        )

        return QueryResponse(**result)

    except Exception as e:
        logger.error(f"Query error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/status")
async def get_ai_status(
    current_user: User = Depends(get_current_user)
):
    """
    Get status of local AI services.

    Returns information about:
    - Embedding service (sentence-transformers)
    - Vector store (numpy-based)
    - LLM service (Ollama)
    """
    try:
        status = await local_query_service.get_service_status()
        return status

    except Exception as e:
        logger.error(f"Status check error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/index/{document_id}")
async def index_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Index a document for semantic search.

    This extracts the document content and creates embeddings
    for semantic search using local AI (no API keys required).
    """
    try:
        from sqlalchemy import select

        from app.models import Document

        # Get document from database
        result = await db.execute(
            select(Document).where(
                Document.document_id == document_id,
                Document.organization_id == current_user.organization_id
            )
        )
        document = result.scalar_one_or_none()

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Get decrypted content
        content = get_decrypted_content(document)

        if not content:
            raise HTTPException(status_code=400, detail="Document has no content to index")

        # Index the document
        index_result = await local_query_service.index_document_for_search(
            document_id=document_id,
            organization_id=str(current_user.organization_id),
            title=document.title,
            content=content,
            metadata={
                "source_system": document.source_system,
                "mime_type": document.mime_type
            }
        )

        # Update document status
        document.status = "indexed"
        document.indexed_at = __import__('datetime').datetime.utcnow()
        await db.commit()

        return index_result

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Index error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/index/{document_id}")
async def remove_document_index(
    document_id: str,
    current_user: User = Depends(get_current_user)
):
    """
    Remove a document from the search index.
    """
    try:
        result = await local_query_service.remove_document_from_search(
            document_id=document_id,
            organization_id=str(current_user.organization_id)
        )
        return result

    except Exception as e:
        logger.error(f"Remove index error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_index_stats(
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics about the search index for the current organization.
    """
    try:
        stats = local_vector_store.get_stats(str(current_user.organization_id))
        return stats

    except Exception as e:
        logger.error(f"Stats error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
