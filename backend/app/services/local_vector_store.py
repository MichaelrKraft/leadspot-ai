"""
Local Vector Store using numpy

A simple, file-based vector store for document chunks.
Uses local embeddings from sentence-transformers.
No external dependencies like ChromaDB or Pinecone required.

Storage: pickle files per organization in ./vector_data/
"""

import logging
import pickle
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np

from app.services import local_embedding_service

logger = logging.getLogger(__name__)

# OpenAI embedding dimension
OPENAI_EMBEDDING_DIM = 1536

def _get_openai_embedding(text: str):
    """Get embedding using OpenAI (for compatibility with OpenAI-indexed docs)."""
    try:
        from app.services.vector_service import get_embedding
        return get_embedding(text)
    except Exception as e:
        logger.warning(f"OpenAI embedding failed, falling back to local: {e}")
        return None

# Storage directory
VECTOR_DATA_DIR = Path(__file__).parent.parent.parent / "vector_data"
VECTOR_DATA_DIR.mkdir(exist_ok=True)


def _get_org_path(organization_id: str) -> Path:
    """Get the storage path for an organization.

    Note: Uses same path as vector_service.py for compatibility.
    """
    safe_id = organization_id.replace('-', '_')
    return VECTOR_DATA_DIR / f"org_{safe_id}.pkl"


def _load_org_data(organization_id: str) -> dict[str, Any]:
    """Load organization's vector data from disk."""
    path = _get_org_path(organization_id)
    if path.exists():
        with open(path, 'rb') as f:
            return pickle.load(f)
    return {
        "embeddings": [],  # List of numpy arrays
        "documents": [],   # List of text chunks
        "metadatas": [],   # List of metadata dicts
        "ids": []          # List of chunk IDs
    }


def _save_org_data(organization_id: str, data: dict[str, Any]) -> None:
    """Save organization's vector data to disk."""
    path = _get_org_path(organization_id)
    with open(path, 'wb') as f:
        pickle.dump(data, f)


def chunk_text(text: str, chunk_size: int = 500, overlap: int = 50) -> list[str]:
    """
    Split text into overlapping chunks for better retrieval.

    Args:
        text: The text to chunk
        chunk_size: Target size of each chunk in characters
        overlap: Number of characters to overlap between chunks

    Returns:
        List of text chunks
    """
    if not text:
        return []

    chunks = []
    start = 0
    text_length = len(text)

    while start < text_length:
        end = start + chunk_size

        # Try to find a natural break point
        if end < text_length:
            for punct in ['. ', '.\n', '\n\n', '\n', ' ']:
                break_point = text.rfind(punct, start + chunk_size // 2, end)
                if break_point != -1:
                    end = break_point + len(punct)
                    break

        chunk = text[start:end].strip()
        if chunk:
            chunks.append(chunk)

        start = end - overlap
        if start <= 0:
            start = end

    return chunks


def index_document(
    document_id: str,
    organization_id: str,
    title: str,
    content: str,
    metadata: dict[str, Any] | None = None
) -> int:
    """
    Index a document into the vector store.

    Args:
        document_id: Unique document identifier
        organization_id: Organization the document belongs to
        title: Document title
        content: Document text content
        metadata: Additional metadata to store

    Returns:
        Number of chunks indexed
    """
    if not content:
        return 0

    logger.info(f"Indexing document {document_id} for org {organization_id}")

    data = _load_org_data(organization_id)

    # Remove existing chunks for this document (re-indexing)
    existing_indices = [
        i for i, m in enumerate(data['metadatas'])
        if m.get('document_id') == document_id
    ]
    for i in sorted(existing_indices, reverse=True):
        data['embeddings'].pop(i)
        data['documents'].pop(i)
        data['metadatas'].pop(i)
        data['ids'].pop(i)

    # Chunk the document
    chunks = chunk_text(content)

    if not chunks:
        _save_org_data(organization_id, data)
        return 0

    # Generate embeddings for all chunks using LOCAL embeddings
    logger.info(f"Generating embeddings for {len(chunks)} chunks")
    embeddings = local_embedding_service.generate_embeddings_batch(chunks)

    # Add new chunks
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        chunk_id = f"{document_id}_chunk_{i}"
        chunk_metadata = {
            "document_id": document_id,
            "title": title,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "indexed_at": datetime.utcnow().isoformat(),
            **(metadata or {})
        }

        data['embeddings'].append(np.array(embedding))
        data['documents'].append(chunk)
        data['metadatas'].append(chunk_metadata)
        data['ids'].append(chunk_id)

    # Persist changes
    _save_org_data(organization_id, data)

    logger.info(f"Indexed {len(chunks)} chunks for document {document_id}")
    return len(chunks)


def remove_document(document_id: str, organization_id: str) -> bool:
    """
    Remove a document from the vector store.

    Args:
        document_id: Document to remove
        organization_id: Organization the document belongs to

    Returns:
        True if successful
    """
    try:
        data = _load_org_data(organization_id)

        # Find and remove all chunks for this document
        indices_to_remove = [
            i for i, m in enumerate(data['metadatas'])
            if m.get('document_id') == document_id
        ]

        for i in sorted(indices_to_remove, reverse=True):
            data['embeddings'].pop(i)
            data['documents'].pop(i)
            data['metadatas'].pop(i)
            data['ids'].pop(i)

        _save_org_data(organization_id, data)
        logger.info(f"Removed {len(indices_to_remove)} chunks for document {document_id}")
        return True

    except Exception as e:
        logger.error(f"Error removing document from vector store: {e}")
        return False


def search(
    query: str,
    organization_id: str,
    limit: int = 10,
    min_score: float = 0.3
) -> list[dict[str, Any]]:
    """
    Search for similar content using semantic search.

    Args:
        query: Search query text
        organization_id: Organization to search in
        limit: Maximum number of results
        min_score: Minimum similarity score (0-1)

    Returns:
        List of results with content, metadata, and similarity scores
    """
    data = _load_org_data(organization_id)

    if not data['embeddings']:
        return []

    # Detect the dimension of stored embeddings to choose the right embedding service
    # Count dimension distribution
    dim_counts = {}
    for emb in data['embeddings'][:100]:  # Sample first 100
        dim = emb.shape[0]
        dim_counts[dim] = dim_counts.get(dim, 0) + 1

    # Use OpenAI if most embeddings are 1536-dimensional
    use_openai = dim_counts.get(OPENAI_EMBEDDING_DIM, 0) > dim_counts.get(384, 0)

    if use_openai:
        openai_emb = _get_openai_embedding(query)
        if openai_emb is not None:
            query_embedding = openai_emb
        else:
            # Fall back to local
            query_embedding = np.array(local_embedding_service.generate_embedding(query))
    else:
        query_embedding = np.array(local_embedding_service.generate_embedding(query))

    query_dim = query_embedding.shape[0]

    # Calculate similarities
    results = []
    for i, emb in enumerate(data['embeddings']):
        # Skip embeddings with incompatible dimensions (mixed dataset)
        if emb.shape[0] != query_dim:
            continue

        # Cosine similarity
        norm_q = np.linalg.norm(query_embedding)
        norm_e = np.linalg.norm(emb)
        if norm_q == 0 or norm_e == 0:
            continue

        similarity = float(np.dot(query_embedding, emb) / (norm_q * norm_e))

        if similarity >= min_score:
            results.append({
                "chunk_id": data['ids'][i],
                "content": data['documents'][i],
                "metadata": data['metadatas'][i],
                "similarity": round(similarity, 4)
            })

    # Sort by similarity (descending) and limit
    results.sort(key=lambda x: x['similarity'], reverse=True)
    return results[:limit]


def search_deduplicated(
    query: str,
    organization_id: str,
    limit: int = 5,
    min_score: float = 0.3
) -> list[dict[str, Any]]:
    """
    Search with deduplication by document.

    Returns the best chunk from each unique document.

    Args:
        query: Search query text
        organization_id: Organization to search in
        limit: Maximum number of documents to return
        min_score: Minimum similarity score

    Returns:
        List of results, one per document (best chunk)
    """
    # Get more results to account for deduplication
    raw_results = search(query, organization_id, limit=limit * 3, min_score=min_score)

    # Deduplicate by document_id
    seen_docs = set()
    deduplicated = []

    for result in raw_results:
        doc_id = result['metadata'].get('document_id')
        if doc_id and doc_id not in seen_docs:
            seen_docs.add(doc_id)
            deduplicated.append(result)
            if len(deduplicated) >= limit:
                break

    return deduplicated


def get_stats(organization_id: str) -> dict[str, Any]:
    """
    Get statistics about the vector store for an organization.

    Args:
        organization_id: Organization to get stats for

    Returns:
        Dictionary with statistics
    """
    data = _load_org_data(organization_id)

    unique_docs = set(m.get('document_id') for m in data['metadatas'])

    return {
        "total_chunks": len(data['embeddings']),
        "total_documents": len(unique_docs),
        "embedding_model": local_embedding_service.get_model_info()['model_name'],
        "embedding_dimension": local_embedding_service.EMBEDDING_DIMENSION,
        "storage_path": str(_get_org_path(organization_id))
    }


def is_available() -> bool:
    """Check if the vector store is available."""
    try:
        # Check that embedding service is available
        return local_embedding_service.is_available()
    except Exception:
        return False
