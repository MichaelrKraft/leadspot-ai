"""
Document Ingestion Pipeline

Orchestrates the complete ingestion process:
1. Content extraction
2. Metadata extraction
3. Text chunking
4. Embedding generation
5. Vector indexing
6. Graph relationship creation
"""

import logging
import uuid
from collections.abc import Callable
from datetime import datetime
from typing import Any

from app.services.graph_service import GraphService

from .chunker import DocumentChunker
from .embedder import EmbeddingService
from .extractor import ContentExtractor
from .indexer import PineconeIndexer
from .metadata_extractor import MetadataExtractor

logger = logging.getLogger(__name__)


class IngestionProgress:
    """Tracks ingestion progress."""

    def __init__(self, document_id: str):
        self.document_id = document_id
        self.stage = "initialized"
        self.progress = 0.0
        self.message = ""
        self.started_at = datetime.utcnow()
        self.completed_at: datetime | None = None
        self.error: str | None = None
        self.success = False

    def update(self, stage: str, progress: float, message: str):
        """Update progress."""
        self.stage = stage
        self.progress = progress
        self.message = message
        logger.info(f"[{self.document_id}] {stage}: {message} ({progress:.1%})")

    def complete(self, success: bool, error: str | None = None):
        """Mark as complete."""
        self.completed_at = datetime.utcnow()
        self.success = success
        self.error = error
        self.progress = 1.0

    def to_dict(self) -> dict[str, Any]:
        """Convert to dictionary."""
        return {
            'document_id': self.document_id,
            'stage': self.stage,
            'progress': self.progress,
            'message': self.message,
            'started_at': self.started_at.isoformat(),
            'completed_at': self.completed_at.isoformat() if self.completed_at else None,
            'success': self.success,
            'error': self.error
        }


class IngestionPipeline:
    """Main pipeline for document ingestion."""

    def __init__(
        self,
        openai_api_key: str,
        pinecone_api_key: str,
        pinecone_environment: str,
        pinecone_index_name: str,
        neo4j_uri: str,
        neo4j_username: str,
        neo4j_password: str,
        embedding_model: str = "text-embedding-3-small",
        max_chunk_tokens: int = 512,
        chunk_overlap: int = 50
    ):
        """
        Initialize ingestion pipeline.

        Args:
            openai_api_key: OpenAI API key
            pinecone_api_key: Pinecone API key
            pinecone_environment: Pinecone environment
            pinecone_index_name: Pinecone index name
            neo4j_uri: Neo4j connection URI
            neo4j_username: Neo4j username
            neo4j_password: Neo4j password
            embedding_model: OpenAI embedding model
            max_chunk_tokens: Maximum tokens per chunk
            chunk_overlap: Overlap between chunks
        """
        # Initialize services
        self.extractor = ContentExtractor()
        self.chunker = DocumentChunker(
            max_tokens=max_chunk_tokens,
            overlap_tokens=chunk_overlap
        )
        self.embedder = EmbeddingService(
            api_key=openai_api_key,
            model=embedding_model
        )
        self.indexer = PineconeIndexer(
            api_key=pinecone_api_key,
            environment=pinecone_environment,
            index_name=pinecone_index_name,
            dimension=self.embedder.get_dimension()
        )
        self.metadata_extractor = MetadataExtractor(openai_api_key=openai_api_key)
        self.graph_service = GraphService(
            uri=neo4j_uri,
            username=neo4j_username,
            password=neo4j_password
        )

        # Track active ingestions
        self.active_ingestions: dict[str, IngestionProgress] = {}

    async def ingest_document(
        self,
        file_path: str | None = None,
        file_content: bytes | None = None,
        mime_type: str | None = None,
        source_url: str | None = None,
        organization_id: str = None,
        document_id: str | None = None,
        metadata_override: dict[str, Any] | None = None,
        progress_callback: Callable | None = None
    ) -> dict[str, Any]:
        """
        Ingest a document through the complete pipeline.

        Args:
            file_path: Path to file
            file_content: Raw file bytes
            mime_type: MIME type
            source_url: Source URL
            organization_id: Organization ID for namespacing
            document_id: Optional document ID (generated if not provided)
            metadata_override: Metadata to merge with extracted metadata
            progress_callback: Async callback for progress updates

        Returns:
            Ingestion result dictionary
        """
        # Generate document ID if not provided
        if not document_id:
            document_id = str(uuid.uuid4())

        # Create progress tracker
        progress = IngestionProgress(document_id)
        self.active_ingestions[document_id] = progress

        try:
            # Stage 1: Extract content
            progress.update("extraction", 0.1, "Extracting document content")
            if progress_callback:
                await progress_callback(progress.to_dict())

            extraction_result = await self.extractor.extract(
                file_path=file_path,
                file_content=file_content,
                mime_type=mime_type,
                source_url=source_url
            )

            if not extraction_result['success']:
                raise ValueError(f"Content extraction failed: {extraction_result.get('error')}")

            text = extraction_result['text']
            file_metadata = extraction_result['metadata']

            # Stage 2: Extract metadata
            progress.update("metadata", 0.2, "Extracting document metadata")
            if progress_callback:
                await progress_callback(progress.to_dict())

            metadata = await self.metadata_extractor.extract_metadata(
                text=text,
                file_metadata=file_metadata,
                use_ai=True
            )

            # Merge with override metadata
            if metadata_override:
                metadata.update(metadata_override)

            metadata['document_id'] = document_id
            metadata['organization_id'] = organization_id

            # Stage 3: Chunk document
            progress.update("chunking", 0.3, "Chunking document")
            if progress_callback:
                await progress_callback(progress.to_dict())

            chunks = await self.chunker.chunk_document(text, metadata)

            if not chunks:
                raise ValueError("No chunks created from document")

            progress.update("chunking", 0.4, f"Created {len(chunks)} chunks")
            if progress_callback:
                await progress_callback(progress.to_dict())

            # Stage 4: Generate embeddings
            progress.update("embedding", 0.5, "Generating embeddings")
            if progress_callback:
                await progress_callback(progress.to_dict())

            async def embedding_progress(prog, msg):
                progress.update("embedding", 0.5 + (prog * 0.2), msg)
                if progress_callback:
                    await progress_callback(progress.to_dict())

            chunk_dicts = [chunk.to_dict() for chunk in chunks]
            embedded_chunks = await self.embedder.embed_chunks(
                chunk_dicts,
                progress_callback=embedding_progress
            )

            # Stage 5: Index in Pinecone
            progress.update("indexing", 0.7, "Indexing vectors in Pinecone")
            if progress_callback:
                await progress_callback(progress.to_dict())

            async def indexing_progress(prog, msg):
                progress.update("indexing", 0.7 + (prog * 0.15), msg)
                if progress_callback:
                    await progress_callback(progress.to_dict())

            index_result = await self.indexer.index_chunks(
                chunks=embedded_chunks,
                namespace=organization_id,
                document_id=document_id,
                progress_callback=indexing_progress
            )

            # Stage 6: Create graph relationships
            progress.update("graph", 0.85, "Creating knowledge graph relationships")
            if progress_callback:
                await progress_callback(progress.to_dict())

            await self._create_graph_relationships(document_id, metadata, organization_id)

            # Complete
            progress.update("complete", 1.0, "Ingestion complete")
            progress.complete(success=True)

            if progress_callback:
                await progress_callback(progress.to_dict())

            result = {
                'success': True,
                'document_id': document_id,
                'chunks_created': len(chunks),
                'vectors_indexed': index_result['vectors_indexed'],
                'metadata': metadata,
                'progress': progress.to_dict()
            }

            logger.info(f"Successfully ingested document {document_id}")
            return result

        except Exception as e:
            logger.error(f"Error ingesting document: {e!s}", exc_info=True)
            progress.complete(success=False, error=str(e))

            if progress_callback:
                await progress_callback(progress.to_dict())

            return {
                'success': False,
                'error': str(e),
                'document_id': document_id,
                'progress': progress.to_dict()
            }

    async def _create_graph_relationships(
        self,
        document_id: str,
        metadata: dict[str, Any],
        organization_id: str
    ):
        """Create knowledge graph relationships."""
        try:
            # Create document node
            await self.graph_service.create_document_node(
                document_id=document_id,
                metadata=metadata,
                organization_id=organization_id
            )

            # Create author relationship if author exists
            author_info = self.metadata_extractor.extract_author_info(
                text="",  # Not needed, already in metadata
                file_metadata=metadata
            )
            if author_info:
                await self.graph_service.create_author_relationship(
                    document_id=document_id,
                    author_name=author_info['name']
                )

            # Link to topics if available
            topics = metadata.get('ai_topics', [])
            for topic in topics[:5]:  # Limit to top 5 topics
                await self.graph_service.link_to_topic(
                    document_id=document_id,
                    topic=topic,
                    confidence=0.8
                )

            logger.info(f"Created graph relationships for document {document_id}")

        except Exception as e:
            logger.error(f"Error creating graph relationships: {e!s}", exc_info=True)
            # Don't fail the whole ingestion if graph creation fails

    async def delete_document(
        self,
        document_id: str,
        organization_id: str
    ) -> dict[str, Any]:
        """
        Delete a document and all its data.

        Args:
            document_id: Document identifier
            organization_id: Organization ID

        Returns:
            Deletion result
        """
        try:
            # Delete from Pinecone
            await self.indexer.delete_document(document_id, organization_id)

            # Delete from graph
            await self.graph_service.delete_document(document_id)

            logger.info(f"Successfully deleted document {document_id}")

            return {
                'success': True,
                'document_id': document_id
            }

        except Exception as e:
            logger.error(f"Error deleting document: {e!s}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'document_id': document_id
            }

    def get_progress(self, document_id: str) -> dict[str, Any] | None:
        """Get ingestion progress for a document."""
        progress = self.active_ingestions.get(document_id)
        return progress.to_dict() if progress else None

    def clear_completed(self):
        """Clear completed ingestions from tracking."""
        self.active_ingestions = {
            doc_id: progress
            for doc_id, progress in self.active_ingestions.items()
            if not progress.completed_at
        }

    async def close(self):
        """Close all service connections."""
        await self.graph_service.close()
