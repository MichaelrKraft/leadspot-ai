"""
Local Document API Endpoints

Simple document management without external dependencies.
Stores files locally and metadata in SQLite.
"""

import logging

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models import User
from app.services import document_service, vector_service
from app.services.auth_service import get_current_user
from app.services.document_service import get_decrypted_content

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/documents", tags=["documents"])


@router.get("")
async def list_documents(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: str | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    List all documents for the user's organization.
    """
    try:
        documents, total = await document_service.get_documents(
            db=db,
            organization_id=str(current_user.organization_id),
            page=page,
            page_size=page_size,
            search=search
        )

        return {
            "documents": [doc.to_dict() for doc in documents],
            "total": total,
            "page": page,
            "page_size": page_size,
            "total_pages": (total + page_size - 1) // page_size
        }

    except Exception as e:
        logger.error(f"Error listing documents: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/stats")
async def get_document_stats(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get document statistics for the organization.
    """
    try:
        stats = await document_service.get_document_stats(
            db=db,
            organization_id=str(current_user.organization_id)
        )
        return stats

    except Exception as e:
        logger.error(f"Error getting document stats: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{document_id}")
async def get_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get a single document by ID.
    """
    try:
        document = await document_service.get_document(
            db=db,
            document_id=document_id,
            organization_id=str(current_user.organization_id)
        )

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        return document.to_dict()

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def upload_document(
    file: UploadFile = File(...),
    title: str | None = Form(None),
    author: str | None = Form(None),
    description: str | None = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Upload a new document.

    Supports: PDF, DOCX, TXT, MD, HTML
    """
    try:
        # Read file content
        file_content = await file.read()

        # Check file size (max 50MB)
        if len(file_content) > 50 * 1024 * 1024:
            raise HTTPException(status_code=400, detail="File too large. Maximum size is 50MB.")

        # Upload document
        document = await document_service.upload_document(
            db=db,
            file_content=file_content,
            filename=file.filename,
            mime_type=file.content_type or "application/octet-stream",
            organization_id=str(current_user.organization_id),
            user_id=str(current_user.user_id),
            title=title,
            author=author,
            description=description
        )

        return {
            "message": "Document uploaded successfully",
            "document": document.to_dict()
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error uploading document: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.delete("/{document_id}")
async def delete_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Delete a document.
    """
    try:
        success = await document_service.delete_document(
            db=db,
            document_id=document_id,
            organization_id=str(current_user.organization_id)
        )

        if not success:
            raise HTTPException(status_code=404, detail="Document not found")

        return {"message": "Document deleted successfully", "document_id": document_id}

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error deleting document: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/{document_id}/content")
async def get_document_content(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Get the extracted text content of a document.
    """
    try:
        document = await document_service.get_document(
            db=db,
            document_id=document_id,
            organization_id=str(current_user.organization_id)
        )

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        # Decrypt the content before returning
        decrypted_content = get_decrypted_content(document) if document.content else ""

        return {
            "document_id": document.document_id,
            "title": document.title,
            "content": decrypted_content,
            "word_count": len(decrypted_content.split()) if decrypted_content else 0
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting document content: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/{document_id}/index")
async def index_document(
    document_id: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """
    Index a document for semantic search.
    Creates embeddings and stores them in the vector database.
    """
    try:
        document = await document_service.get_document(
            db=db,
            document_id=document_id,
            organization_id=str(current_user.organization_id)
        )

        if not document:
            raise HTTPException(status_code=404, detail="Document not found")

        if not document.content:
            raise HTTPException(status_code=400, detail="Document has no content to index")

        # Index the document
        chunks_indexed = await vector_service.index_document(
            document_id=document_id,
            organization_id=str(current_user.organization_id),
            title=document.title,
            content=document.content
        )

        # Update document status
        document.status = "indexed"
        await db.commit()

        return {
            "message": "Document indexed successfully",
            "document_id": document_id,
            "chunks_indexed": chunks_indexed
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error indexing document: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/search")
async def search_documents(
    query: str = Form(...),
    limit: int = Form(10),
    current_user: User = Depends(get_current_user)
):
    """
    Semantic search across indexed documents.
    Uses embeddings for similarity-based retrieval.
    """
    try:
        results = await vector_service.search_similar(
            query=query,
            organization_id=str(current_user.organization_id),
            limit=limit
        )

        return {
            "query": query,
            "results": results,
            "total": len(results)
        }

    except Exception as e:
        logger.error(f"Error searching documents: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/index/stats")
async def get_index_stats(
    current_user: User = Depends(get_current_user)
):
    """
    Get statistics about the vector index.
    """
    try:
        stats = await vector_service.get_index_stats(
            organization_id=str(current_user.organization_id)
        )
        return stats

    except Exception as e:
        logger.error(f"Error getting index stats: {e!s}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
