"""
Pinecone Indexing Service

Handles vector indexing in Pinecone:
- Batch upsert operations
- Metadata management
- Vector deletion on updates
- Query functionality
"""

import asyncio
import logging
from datetime import datetime
from typing import Any, Callable

from pinecone import Pinecone, ServerlessSpec

logger = logging.getLogger(__name__)


class PineconeIndexer:
    """Service for indexing vectors in Pinecone."""

    def __init__(
        self,
        api_key: str,
        environment: str,
        index_name: str,
        dimension: int = 1536,
        metric: str = "cosine",
        batch_size: int = 100
    ):
        """
        Initialize Pinecone indexer.

        Args:
            api_key: Pinecone API key
            environment: Pinecone environment (e.g., 'us-east-1-aws')
            index_name: Name of the index
            dimension: Vector dimension
            metric: Distance metric (cosine, euclidean, dotproduct)
            batch_size: Number of vectors per upsert batch
        """
        self.pc = Pinecone(api_key=api_key)
        self.index_name = index_name
        self.dimension = dimension
        self.metric = metric
        self.batch_size = batch_size
        self.environment = environment

        # Initialize or connect to index
        self._ensure_index()

        # Get index reference
        self.index = self.pc.Index(index_name)

    def _ensure_index(self):
        """Create index if it doesn't exist."""
        try:
            # Check if index exists
            existing_indexes = self.pc.list_indexes()
            index_names = [idx['name'] for idx in existing_indexes]

            if self.index_name not in index_names:
                logger.info(f"Creating Pinecone index: {self.index_name}")

                # Create index with serverless spec
                self.pc.create_index(
                    name=self.index_name,
                    dimension=self.dimension,
                    metric=self.metric,
                    spec=ServerlessSpec(
                        cloud='aws',
                        region=self.environment
                    )
                )

                logger.info(f"Index {self.index_name} created successfully")
            else:
                logger.info(f"Using existing index: {self.index_name}")

        except Exception as e:
            logger.error(f"Error ensuring index: {e!s}", exc_info=True)
            raise

    async def index_chunks(
        self,
        chunks: list[dict[str, Any]],
        namespace: str,
        document_id: str,
        progress_callback: Callable[..., Any] | None = None
    ) -> dict[str, Any]:
        """
        Index document chunks in Pinecone.

        Args:
            chunks: List of chunks with 'embedding' and 'metadata' fields
            namespace: Namespace for the vectors (typically organization_id)
            document_id: Document identifier
            progress_callback: Optional callback for progress updates

        Returns:
            Dictionary with indexing results
        """
        total_chunks = len(chunks)
        logger.info(f"Indexing {total_chunks} chunks for document {document_id}")

        # Prepare vectors for upsert
        vectors = []
        for i, chunk in enumerate(chunks):
            vector_id = f"{document_id}#{i}"

            # Prepare metadata
            metadata = {
                'document_id': document_id,
                'chunk_index': chunk.get('chunk_index', i),
                'text': chunk['text'][:1000],  # Limit text in metadata
                'token_count': chunk.get('token_count', 0),
                'created_at': datetime.utcnow().isoformat(),
                **chunk.get('metadata', {})
            }

            vectors.append({
                'id': vector_id,
                'values': chunk['embedding'],
                'metadata': metadata
            })

        # Upsert in batches
        upserted = 0
        for i in range(0, len(vectors), self.batch_size):
            batch = vectors[i:i + self.batch_size]
            batch_num = (i // self.batch_size) + 1
            total_batches = (len(vectors) + self.batch_size - 1) // self.batch_size

            logger.info(f"Upserting batch {batch_num}/{total_batches}")

            try:
                # Run upsert in thread pool (Pinecone SDK is synchronous)
                await asyncio.to_thread(
                    self.index.upsert,
                    vectors=batch,
                    namespace=namespace
                )

                upserted += len(batch)

                # Progress callback
                if progress_callback:
                    progress = upserted / total_chunks
                    await progress_callback(
                        progress,
                        f"Indexed {upserted}/{total_chunks} chunks"
                    )

            except Exception as e:
                logger.error(f"Error upserting batch: {e!s}", exc_info=True)
                raise

        logger.info(f"Successfully indexed {upserted} vectors")

        return {
            'success': True,
            'vectors_indexed': upserted,
            'namespace': namespace,
            'document_id': document_id
        }

    async def delete_document(
        self,
        document_id: str,
        namespace: str
    ) -> dict[str, Any]:
        """
        Delete all vectors for a document.

        Args:
            document_id: Document identifier
            namespace: Namespace containing the vectors

        Returns:
            Deletion results
        """
        logger.info(f"Deleting vectors for document {document_id}")

        try:
            # Delete by filter (all vectors with this document_id)
            await asyncio.to_thread(
                self.index.delete,
                filter={'document_id': document_id},
                namespace=namespace
            )

            logger.info(f"Successfully deleted vectors for document {document_id}")

            return {
                'success': True,
                'document_id': document_id,
                'namespace': namespace
            }

        except Exception as e:
            logger.error(f"Error deleting document: {e!s}", exc_info=True)
            return {
                'success': False,
                'error': str(e),
                'document_id': document_id
            }

    async def query(
        self,
        query_embedding: list[float],
        namespace: str,
        top_k: int = 10,
        filter: dict[str, Any] | None = None,
        include_metadata: bool = True
    ) -> list[dict[str, Any]]:
        """
        Query similar vectors.

        Args:
            query_embedding: Query vector
            namespace: Namespace to query
            top_k: Number of results to return
            filter: Metadata filter
            include_metadata: Whether to include metadata in results

        Returns:
            List of matching results
        """
        try:
            response = await asyncio.to_thread(
                self.index.query,
                vector=query_embedding,
                top_k=top_k,
                namespace=namespace,
                filter=filter,
                include_metadata=include_metadata
            )

            # Format results
            results = []
            for match in response.matches:
                result = {
                    'id': match.id,
                    'score': match.score,
                }
                if include_metadata:
                    result['metadata'] = match.metadata

                results.append(result)

            return results

        except Exception as e:
            logger.error(f"Error querying index: {e!s}", exc_info=True)
            return []

    async def get_stats(self, namespace: str | None = None) -> dict[str, Any]:
        """
        Get index statistics.

        Args:
            namespace: Optional namespace to get stats for

        Returns:
            Index statistics
        """
        try:
            stats = await asyncio.to_thread(self.index.describe_index_stats)

            if namespace and hasattr(stats, 'namespaces'):
                namespace_stats = stats.namespaces.get(namespace, {})
                return {
                    'namespace': namespace,
                    'vector_count': namespace_stats.get('vector_count', 0)
                }

            return {
                'total_vector_count': stats.total_vector_count,
                'dimension': stats.dimension,
                'index_fullness': stats.index_fullness
            }

        except Exception as e:
            logger.error(f"Error getting stats: {e!s}", exc_info=True)
            return {}

    async def list_documents(
        self,
        namespace: str,
        limit: int = 100
    ) -> list[str]:
        """
        List document IDs in a namespace.

        Note: Pinecone doesn't have a native list operation,
        so this is a workaround using query with a dummy vector.

        Args:
            namespace: Namespace to list
            limit: Maximum number of documents

        Returns:
            List of unique document IDs
        """
        try:
            # Query with dummy vector to get sample of vectors
            dummy_vector = [0.0] * self.dimension

            response = await asyncio.to_thread(
                self.index.query,
                vector=dummy_vector,
                top_k=limit,
                namespace=namespace,
                include_metadata=True
            )

            # Extract unique document IDs
            doc_ids = set()
            for match in response.matches:
                if match.metadata and 'document_id' in match.metadata:
                    doc_ids.add(match.metadata['document_id'])

            return sorted(list(doc_ids))

        except Exception as e:
            logger.error(f"Error listing documents: {e!s}", exc_info=True)
            return []
