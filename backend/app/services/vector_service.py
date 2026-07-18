"""
Vector Database Service using OpenAI embeddings and numpy.
Handles document indexing, semantic search, and knowledge retrieval.
Simple file-based persistence - no external vector DB dependency.

NOTE: Heavy imports (numpy, openai) are lazy-loaded to reduce memory usage at startup.
"""

import os
import pickle
from typing import Any

# Lazy-loaded modules
_np = None
_openai = None
_openai_client = None

# Embedding model config
EMBEDDING_MODEL = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536


def _get_numpy():
    """Lazy load numpy to reduce startup memory."""
    global _np
    if _np is None:
        import numpy
        _np = numpy
    return _np


def _get_openai():
    """Lazy load openai to reduce startup memory."""
    global _openai
    if _openai is None:
        import openai
        _openai = openai
    return _openai


def get_openai_client():
    """Get or create OpenAI client (lazy loaded)."""
    global _openai_client
    if _openai_client is None:
        from app.config import settings
        openai = _get_openai()
        _openai_client = openai.OpenAI(api_key=settings.OPENAI_API_KEY)
    return _openai_client


def _get_vector_data_dir():
    """Get vector data directory, creating if needed."""
    vector_dir = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "vector_data")
    os.makedirs(vector_dir, exist_ok=True)
    return vector_dir


def get_embedding(text: str):
    """Get embedding for a single text."""
    np = _get_numpy()
    client = get_openai_client()
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=text
    )
    return np.array(response.data[0].embedding)


def get_embeddings(texts: list[str]) -> list:
    """Get embeddings for multiple texts."""
    if not texts:
        return []

    np = _get_numpy()
    client = get_openai_client()
    response = client.embeddings.create(
        model=EMBEDDING_MODEL,
        input=texts
    )
    return [np.array(item.embedding) for item in response.data]


def get_org_data_path(organization_id: str) -> str:
    """Get the path to an organization's vector data file."""
    safe_id = organization_id.replace('-', '_')
    return os.path.join(_get_vector_data_dir(), f"org_{safe_id}.pkl")


def load_org_data(organization_id: str) -> dict[str, Any]:
    """Load organization's vector data from disk."""
    path = get_org_data_path(organization_id)
    if os.path.exists(path):
        with open(path, 'rb') as f:
            return pickle.load(f)
    return {
        "embeddings": [],  # List of numpy arrays
        "documents": [],   # List of text chunks
        "metadatas": [],   # List of metadata dicts
        "ids": []          # List of chunk IDs
    }


def save_org_data(organization_id: str, data: dict[str, Any]) -> None:
    """Save organization's vector data to disk."""
    path = get_org_data_path(organization_id)
    with open(path, 'wb') as f:
        pickle.dump(data, f)


def is_vector_db_configured() -> bool:
    """Check if vector DB is configured."""
    from app.config import settings
    return bool(settings.OPENAI_API_KEY)


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

        # Try to find a natural break point (sentence end or newline)
        if end < text_length:
            for punct in ['. ', '.\n', '\n\n', '\n']:
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


def generate_chunk_id(document_id: str, chunk_index: int) -> str:
    """Generate a unique ID for a chunk."""
    return f"{document_id}_chunk_{chunk_index}"


def cosine_similarity(a, b) -> float:
    """Calculate cosine similarity between two vectors."""
    np = _get_numpy()
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b)))


async def index_document(
    document_id: str,
    organization_id: str,
    title: str,
    content: str,
    metadata: dict[str, Any] | None = None
) -> int:
    """
    Index a document into the vector database.

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

    data = load_org_data(organization_id)

    # Remove existing chunks for this document (re-indexing)
    existing_indices = [i for i, m in enumerate(data['metadatas']) if m.get('document_id') == document_id]
    for i in sorted(existing_indices, reverse=True):
        data['embeddings'].pop(i)
        data['documents'].pop(i)
        data['metadatas'].pop(i)
        data['ids'].pop(i)

    # Chunk the document
    chunks = chunk_text(content)

    if not chunks:
        save_org_data(organization_id, data)
        return 0

    # Generate embeddings for all chunks using OpenAI
    embeddings = get_embeddings(chunks)

    # Add new chunks
    from datetime import datetime  # Lazy import
    for i, (chunk, embedding) in enumerate(zip(chunks, embeddings)):
        chunk_id = generate_chunk_id(document_id, i)
        chunk_metadata = {
            "document_id": document_id,
            "title": title,
            "chunk_index": i,
            "total_chunks": len(chunks),
            "indexed_at": datetime.utcnow().isoformat(),
            **(metadata or {})
        }

        data['embeddings'].append(embedding)
        data['documents'].append(chunk)
        data['metadatas'].append(chunk_metadata)
        data['ids'].append(chunk_id)

    # Persist changes
    save_org_data(organization_id, data)

    return len(chunks)


async def remove_document_embedding(document_id: str, organization_id: str) -> bool:
    """
    Remove a document from the vector database.

    Args:
        document_id: Document to remove
        organization_id: Organization the document belongs to

    Returns:
        True if successful
    """
    try:
        data = load_org_data(organization_id)

        # Find and remove all chunks for this document
        indices_to_remove = [i for i, m in enumerate(data['metadatas']) if m.get('document_id') == document_id]

        for i in sorted(indices_to_remove, reverse=True):
            data['embeddings'].pop(i)
            data['documents'].pop(i)
            data['metadatas'].pop(i)
            data['ids'].pop(i)

        save_org_data(organization_id, data)
        return True
    except Exception as e:
        print(f"Error removing document from vector DB: {e}")
        return False


# Alias for backwards compatibility
async def delete_document_embedding(document_id: str) -> None:
    """Delete document embedding (needs organization_id in practice)."""
    pass


async def search_similar_documents(
    query: str,
    organization_id: str,
    max_results: int = 10,
    min_score: float = 0.3
) -> list:
    """
    Search for similar documents using semantic search.

    Args:
        query: Search query text
        organization_id: Organization to search in
        max_results: Maximum number of results
        min_score: Minimum similarity score (0-1)

    Returns:
        List of Source objects with relevance scores
    """
    from app.schemas import Source  # Lazy import

    data = load_org_data(organization_id)

    if not data['embeddings']:
        return []

    query_embedding = get_embedding(query)

    # Calculate similarities
    similarities = []
    for i, emb in enumerate(data['embeddings']):
        sim = cosine_similarity(query_embedding, emb)
        if sim >= min_score:
            similarities.append((i, sim))

    # Sort by similarity (descending)
    similarities.sort(key=lambda x: x[1], reverse=True)

    # Deduplicate by document and create Source objects
    sources = []
    seen_documents = set()

    for idx, similarity in similarities[:max_results * 2]:  # Get more to account for dedup
        metadata = data['metadatas'][idx]
        doc_id = metadata.get('document_id', data['ids'][idx])

        if doc_id in seen_documents:
            continue
        seen_documents.add(doc_id)

        source = Source(
            document_id=doc_id,
            title=metadata.get('title', 'Untitled'),
            url=None,
            excerpt=data['documents'][idx][:300],
            relevance_score=round(similarity, 4)
        )
        sources.append(source)

        if len(sources) >= max_results:
            break

    return sources


async def search_similar(
    query: str,
    organization_id: str,
    limit: int = 10,
    min_score: float = 0.3
) -> list[dict[str, Any]]:
    """
    Search for similar content (returns raw results).

    Args:
        query: Search query text
        organization_id: Organization to search in
        limit: Maximum number of results
        min_score: Minimum similarity score (0-1)

    Returns:
        List of results with document info and similarity scores
    """
    data = load_org_data(organization_id)

    if not data['embeddings']:
        return []

    query_embedding = get_embedding(query)

    # Calculate similarities
    results = []
    for i, emb in enumerate(data['embeddings']):
        sim = cosine_similarity(query_embedding, emb)
        if sim >= min_score:
            results.append({
                "chunk_id": data['ids'][i],
                "content": data['documents'][i],
                "metadata": data['metadatas'][i],
                "similarity": round(sim, 4)
            })

    # Sort by similarity (descending) and limit
    results.sort(key=lambda x: x['similarity'], reverse=True)
    return results[:limit]


async def get_index_stats(organization_id: str | None = None) -> dict:
    """
    Get statistics about the vector index.

    Args:
        organization_id: Specific organization, or None for overall stats

    Returns:
        Dictionary with index statistics
    """
    try:
        if organization_id:
            data = load_org_data(organization_id)
            unique_docs = set(m.get('document_id') for m in data['metadatas'])
            return {
                "total_chunks": len(data['embeddings']),
                "total_documents": len(unique_docs),
                "embedding_model": EMBEDDING_MODEL,
                "embedding_dimension": EMBEDDING_DIMENSION
            }
        else:
            # Get stats for all organizations
            total_chunks = 0
            total_orgs = 0
            vector_dir = _get_vector_data_dir()
            for filename in os.listdir(vector_dir):
                if filename.endswith('.pkl'):
                    total_orgs += 1
                    filepath = os.path.join(vector_dir, filename)
                    with open(filepath, 'rb') as f:
                        org_data = pickle.load(f)
                        total_chunks += len(org_data.get('embeddings', []))

            return {
                "total_organizations": total_orgs,
                "total_chunks": total_chunks,
                "embedding_model": EMBEDDING_MODEL,
                "embedding_dimension": EMBEDDING_DIMENSION
            }
    except Exception as e:
        return {
            "total_chunks": 0,
            "error": str(e)
        }


async def upsert_document_embedding(
    document_id: str,
    organization_id: str,
    embedding: list[float],
    metadata: dict
) -> None:
    """
    Legacy function - use index_document instead for full functionality.
    This maintains backward compatibility.
    """
    np = _get_numpy()
    data = load_org_data(organization_id)

    # Remove existing if present
    existing_idx = next((i for i, id_ in enumerate(data['ids']) if id_ == document_id), None)
    if existing_idx is not None:
        data['embeddings'].pop(existing_idx)
        data['documents'].pop(existing_idx)
        data['metadatas'].pop(existing_idx)
        data['ids'].pop(existing_idx)

    # Add new
    data['embeddings'].append(np.array(embedding))
    data['documents'].append("")
    data['metadatas'].append({"document_id": document_id, **metadata})
    data['ids'].append(document_id)

    save_org_data(organization_id, data)
