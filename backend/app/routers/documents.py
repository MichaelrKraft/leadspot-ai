"""
Document API Endpoints

Provides REST API for document management:
- Upload and index documents
- List and search documents
- Trigger sync operations
- Get document relationships
- Delete documents
"""

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Query, UploadFile

from app.dependencies import get_current_user, get_ingestion_pipeline
from app.schemas.document import (
    DocumentDeleteResponse,
    DocumentList,
    DocumentQuery,
    DocumentQueryResponse,
    DocumentRelationships,
    DocumentResponse,
    DocumentStatsResponse,
    IngestionStatus,
    SyncStatus,
)
from app.services.ingestion.pipeline import IngestionPipeline

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("/", response_model=DocumentList)
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=100),
    organization_id: str | None = None,
    current_user: dict = Depends(get_current_user),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline)
):
    """
    List all documents for an organization.

    Args:
        page: Page number
        page_size: Items per page
        organization_id: Filter by organization
        current_user: Authenticated user
        pipeline: Ingestion pipeline instance

    Returns:
        Paginated list of documents
    """
    try:
        # Use organization_id from user if not provided
        if not organization_id:
            organization_id = current_user.get("organization_id")

        # Get documents from Pinecone index
        # Note: This is a simplified implementation
        # In production, you'd want to store document metadata in a database
        doc_ids = await pipeline.indexer.list_documents(
            namespace=organization_id,
            limit=page_size
        )

        # For MVP, return basic list
        # TODO: Implement proper pagination and metadata retrieval
        documents = [
            DocumentResponse(
                id=doc_id,
                organization_id=organization_id,
                title=doc_id,  # Placeholder
                metadata={},
                chunks_count=0,
                vectors_indexed=0,
                created_at=None,
                status="indexed"
            )
            for doc_id in doc_ids
        ]

        return DocumentList(
            documents=documents,
            total=len(documents),
            page=page,
            page_size=page_size
        )

    except Exception as e:
        logger.error(f"Error listing documents: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{document_id}", response_model=DocumentResponse)
async def get_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline)
):
    """
    Get document details.

    Args:
        document_id: Document identifier
        current_user: Authenticated user
        pipeline: Ingestion pipeline instance

    Returns:
        Document details
    """
    try:
        # Get document from graph
        # TODO: Implement graph query for document details

        # Placeholder response
        return DocumentResponse(
            id=document_id,
            organization_id=current_user.get("organization_id"),
            title="Document Title",
            metadata={},
            chunks_count=0,
            vectors_indexed=0,
            created_at=None,
            status="indexed"
        )

    except Exception as e:
        logger.error(f"Error getting document: {e!s}", exc_info=True)
        raise HTTPException(status_code=404, detail="Document not found")


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    background_tasks: BackgroundTasks = None,
    current_user: dict = Depends(get_current_user),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline)
):
    """
    Upload and index a document.

    Args:
        file: Uploaded file
        background_tasks: FastAPI background tasks
        current_user: Authenticated user
        pipeline: Ingestion pipeline instance

    Returns:
        Upload status and document ID
    """
    try:
        organization_id = current_user.get("organization_id")

        # Read file content
        file_content = await file.read()

        # Start ingestion in background
        async def ingest_task():
            await pipeline.ingest_document(
                file_content=file_content,
                mime_type=file.content_type,
                organization_id=organization_id,
                metadata_override={
                    'filename': file.filename,
                    'uploaded_by': current_user.get('email')
                }
            )

        # Add to background tasks
        if background_tasks:
            background_tasks.add_task(ingest_task)
        else:
            # If no background tasks, run in foreground
            result = await pipeline.ingest_document(
                file_content=file_content,
                mime_type=file.content_type,
                organization_id=organization_id,
                metadata_override={
                    'filename': file.filename,
                    'uploaded_by': current_user.get('email')
                }
            )
            return result

        return {
            "message": "Document upload started",
            "filename": file.filename,
            "status": "processing"
        }

    except Exception as e:
        logger.error(f"Error uploading document: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sync", response_model=SyncStatus)
async def trigger_sync(
    source: str = Query(..., description="Sync source: google-drive, dropbox, etc."),
    current_user: dict = Depends(get_current_user)
):
    """
    Trigger document sync from external source.

    Args:
        source: Source to sync from
        current_user: Authenticated user

    Returns:
        Sync status
    """
    # TODO: Implement sync logic
    return SyncStatus(
        status="pending",
        message=f"Sync from {source} queued",
        documents_synced=0,
        documents_failed=0
    )


@router.get("/sync/status", response_model=SyncStatus)
async def get_sync_status(
    sync_id: str | None = None,
    current_user: dict = Depends(get_current_user)
):
    """
    Get status of sync operation.

    Args:
        sync_id: Sync operation ID
        current_user: Authenticated user

    Returns:
        Sync status
    """
    # TODO: Implement sync status retrieval
    return SyncStatus(
        status="completed",
        progress=1.0,
        message="Sync completed",
        documents_synced=10,
        documents_failed=0
    )


@router.get("/{document_id}/status", response_model=IngestionStatus)
async def get_ingestion_status(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline)
):
    """
    Get document ingestion status.

    Args:
        document_id: Document identifier
        current_user: Authenticated user
        pipeline: Ingestion pipeline instance

    Returns:
        Ingestion status
    """
    try:
        progress = pipeline.get_progress(document_id)

        if not progress:
            raise HTTPException(status_code=404, detail="Document ingestion not found")

        return IngestionStatus(**progress)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting ingestion status: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/query", response_model=DocumentQueryResponse)
async def query_documents(
    query: DocumentQuery,
    current_user: dict = Depends(get_current_user),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline)
):
    """
    Query documents with natural language.

    Args:
        query: Query parameters
        current_user: Authenticated user
        pipeline: Ingestion pipeline instance

    Returns:
        Query results
    """
    try:
        organization_id = current_user.get("organization_id")

        # Generate query embedding
        query_embedding = await pipeline.embedder.embed_single(query.query)

        # Query Pinecone
        results = await pipeline.indexer.query(
            query_embedding=query_embedding,
            namespace=organization_id,
            top_k=query.top_k,
            filter=query.filter
        )

        # Format results
        formatted_results = [
            {
                'document_id': r['id'].split('#')[0],
                'chunk_index': int(r['id'].split('#')[1]),
                'score': r['score'],
                'text': r['metadata'].get('text', ''),
                'metadata': r['metadata']
            }
            for r in results
        ]

        return DocumentQueryResponse(
            results=formatted_results,
            query=query.query,
            total_results=len(formatted_results)
        )

    except Exception as e:
        logger.error(f"Error querying documents: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{document_id}/relationships", response_model=DocumentRelationships)
async def get_document_relationships(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline)
):
    """
    Get document relationships from knowledge graph.

    Args:
        document_id: Document identifier
        current_user: Authenticated user
        pipeline: Ingestion pipeline instance

    Returns:
        Document relationships
    """
    try:
        # Get related documents from graph
        related = await pipeline.graph_service.get_related_documents(
            document_id=document_id,
            limit=10
        )

        # TODO: Format response with full document details
        return DocumentRelationships(
            document_id=document_id,
            related_documents=[],
            authors=[],
            topics=[],
            citations=[]
        )

    except Exception as e:
        logger.error(f"Error getting relationships: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{document_id}", response_model=DocumentDeleteResponse)
async def delete_document(
    document_id: str,
    current_user: dict = Depends(get_current_user),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline)
):
    """
    Delete a document and all its data.

    Args:
        document_id: Document identifier
        current_user: Authenticated user
        pipeline: Ingestion pipeline instance

    Returns:
        Deletion confirmation
    """
    try:
        organization_id = current_user.get("organization_id")

        result = await pipeline.delete_document(
            document_id=document_id,
            organization_id=organization_id
        )

        if result['success']:
            return DocumentDeleteResponse(
                success=True,
                document_id=document_id,
                message="Document deleted successfully"
            )
        else:
            raise HTTPException(status_code=500, detail=result.get('error'))

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats/organization", response_model=DocumentStatsResponse)
async def get_organization_stats(
    current_user: dict = Depends(get_current_user),
    pipeline: IngestionPipeline = Depends(get_ingestion_pipeline)
):
    """
    Get document statistics for organization.

    Args:
        current_user: Authenticated user
        pipeline: Ingestion pipeline instance

    Returns:
        Organization statistics
    """
    try:
        organization_id = current_user.get("organization_id")

        # Get stats from graph
        stats = await pipeline.graph_service.get_organization_stats(
            organization_id=organization_id
        )

        # Get vector count from Pinecone
        index_stats = await pipeline.indexer.get_stats(namespace=organization_id)

        return DocumentStatsResponse(
            total_documents=stats.get('document_count', 0),
            total_chunks=index_stats.get('vector_count', 0),
            total_authors=stats.get('author_count', 0),
            total_topics=stats.get('topic_count', 0),
            total_citations=stats.get('citation_count', 0),
            document_types={},
            languages={}
        )

    except Exception as e:
        logger.error(f"Error getting stats: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
