"""
Local Embedding Service using sentence-transformers

This service provides 100% local embeddings without requiring any API keys.
Uses the all-MiniLM-L6-v2 model which is fast and efficient.

No external API calls - everything runs locally on CPU.
"""

import logging

logger = logging.getLogger(__name__)

# Lazy-loaded model
_model = None
_model_name = "all-MiniLM-L6-v2"  # Fast, small model (22MB)
EMBEDDING_DIMENSION = 384  # Dimension for all-MiniLM-L6-v2


def _get_model():
    """Lazy load the sentence-transformers model."""
    global _model
    if _model is None:
        logger.info(f"Loading local embedding model: {_model_name}")
        try:
            from sentence_transformers import SentenceTransformer
            _model = SentenceTransformer(_model_name)
            logger.info(f"Model loaded successfully. Dimension: {EMBEDDING_DIMENSION}")
        except Exception as e:
            logger.error(f"Failed to load embedding model: {e}")
            raise
    return _model


def generate_embedding(text: str) -> list[float]:
    """
    Generate embedding vector for text using local model.

    Args:
        text: Input text to embed

    Returns:
        Embedding vector as list of floats (384 dimensions)
    """
    if not text or not text.strip():
        return [0.0] * EMBEDDING_DIMENSION

    model = _get_model()
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.tolist()


def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for multiple texts in batch.

    More efficient than generating one at a time.

    Args:
        texts: List of input texts to embed

    Returns:
        List of embedding vectors
    """
    if not texts:
        return []

    # Filter empty texts but track indices
    valid_texts = []
    valid_indices = []
    for i, text in enumerate(texts):
        if text and text.strip():
            valid_texts.append(text)
            valid_indices.append(i)

    if not valid_texts:
        return [[0.0] * EMBEDDING_DIMENSION for _ in texts]

    model = _get_model()
    embeddings = model.encode(valid_texts, convert_to_numpy=True, show_progress_bar=False)

    # Build result with zeros for empty texts
    result = [[0.0] * EMBEDDING_DIMENSION for _ in texts]
    for i, idx in enumerate(valid_indices):
        result[idx] = embeddings[i].tolist()

    return result


def cosine_similarity(embedding1: list[float], embedding2: list[float]) -> float:
    """
    Calculate cosine similarity between two embeddings.

    Args:
        embedding1: First embedding vector
        embedding2: Second embedding vector

    Returns:
        Similarity score between 0 and 1
    """
    import numpy as np
    a = np.array(embedding1)
    b = np.array(embedding2)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(np.dot(a, b) / (norm_a * norm_b))


def is_available() -> bool:
    """Check if the local embedding service is available."""
    try:
        _get_model()
        return True
    except Exception:
        return False


def get_model_info() -> dict:
    """Get information about the embedding model."""
    return {
        "model_name": _model_name,
        "embedding_dimension": EMBEDDING_DIMENSION,
        "provider": "local (sentence-transformers)",
        "requires_api_key": False
    }
