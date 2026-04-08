"""
Document Pydantic Schemas

Data validation models for document operations.
"""

from datetime import datetime
from typing import Optional, Any

from pydantic import BaseModel, Field


class DocumentBase(BaseModel):
    """Base document schema."""
    title: str = Field(..., min_length=1, max_length=500)
    source_url: Optional[str] = None
    mime_type: Optional[str] = None


class DocumentCreate(DocumentBase):
    """Schema for creating a document."""
    file_path: Optional[str] = None
    metadata: Optional[dict[str, Any]] = None


class DocumentMetadata(BaseModel):
    """Document metadata schema."""
    title: str
    document_type: Optional[str] = None
    language: Optional[str] = None
    character_count: Optional[int] = None
    word_count: Optional[int] = None
    token_count: Optional[int] = None
    ai_summary: Optional[str] = None
    ai_topics: Optional[list[str]] = None
    key_entities: Optional[list[str]] = None
    sentiment: Optional[str] = None
    author: Optional[str] = None
    created_at: Optional[str] = None


class DocumentResponse(DocumentBase):
    """Schema for document response."""
    id: str
    organization_id: str
    metadata: DocumentMetadata
    chunks_count: int
    vectors_indexed: int
    created_at: datetime
    updated_at: Optional[datetime] = None
    status: str = Field(default="indexed")

    class Config:
        from_attributes = True


class DocumentList(BaseModel):
    """Schema for list of documents."""
    documents: list[DocumentResponse]
    total: int
    page: int = 1
    page_size: int = 50


class SyncStatus(BaseModel):
    """Schema for sync operation status."""
    status: str = Field(..., description="Status: pending, processing, completed, failed")
    progress: float = Field(0.0, ge=0.0, le=1.0)
    message: str = ""
    started_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None
    documents_synced: int = 0
    documents_failed: int = 0
    errors: Optional[list[str]] = None


class IngestionStatus(BaseModel):
    """Schema for document ingestion status."""
    document_id: str
    stage: str = Field(..., description="Current stage: extraction, metadata, chunking, embedding, indexing, graph, complete")
    progress: float = Field(0.0, ge=0.0, le=1.0)
    message: str = ""
    started_at: datetime
    completed_at: Optional[datetime] = None
    success: bool = False
    error: Optional[str] = None


class DocumentQuery(BaseModel):
    """Schema for document query."""
    query: str = Field(..., min_length=1)
    top_k: int = Field(10, ge=1, le=100)
    filter: Optional[dict[str, Any]] = None


class DocumentQueryResult(BaseModel):
    """Schema for query result."""
    document_id: str
    chunk_index: int
    score: float
    text: str
    metadata: dict[str, Any]


class DocumentQueryResponse(BaseModel):
    """Schema for query response."""
    results: list[DocumentQueryResult]
    query: str
    total_results: int


class DocumentRelationships(BaseModel):
    """Schema for document relationships."""
    document_id: str
    related_documents: list[DocumentResponse]
    authors: list[str]
    topics: list[str]
    citations: list[str]


class DocumentDeleteResponse(BaseModel):
    """Schema for document deletion response."""
    success: bool
    document_id: str
    message: str


class DocumentStatsResponse(BaseModel):
    """Schema for document statistics."""
    total_documents: int
    total_chunks: int
    total_authors: int
    total_topics: int
    total_citations: int
    document_types: dict[str, int]
    languages: dict[str, int]
