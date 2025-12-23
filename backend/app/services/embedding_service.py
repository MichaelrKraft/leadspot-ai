"""
Unified Embedding Service with Cloud/Local Fallback

Automatically selects the best available embedding provider:
1. OpenAI (text-embedding-3-small) - if OPENAI_API_KEY is configured
2. Local (sentence-transformers) - always available fallback

This ensures the app works without any API keys while providing
better quality embeddings when cloud services are available.
"""

import logging
import os

logger = logging.getLogger(__name__)

# Provider constants
PROVIDER_OPENAI = "openai"
PROVIDER_LOCAL = "local"

# Current provider (determined at runtime)
_current_provider: str | None = None
_openai_client = None


def _get_openai_api_key() -> str | None:
    """Get OpenAI API key from environment."""
    try:
        from app.config import settings
        key = getattr(settings, 'OPENAI_API_KEY', None)
    except ImportError:
        key = None

    if not key:
        key = os.getenv('OPENAI_API_KEY')

    return key if key and key.strip() else None


def _init_openai_client():
    """Initialize OpenAI client if API key is available."""
    global _openai_client
    if _openai_client is not None:
        return _openai_client

    api_key = _get_openai_api_key()
    if not api_key:
        return None

    try:
        from openai import AsyncOpenAI
        _openai_client = AsyncOpenAI(api_key=api_key)
        logger.info("OpenAI client initialized successfully")
        return _openai_client
    except Exception as e:
        logger.warning(f"Failed to initialize OpenAI client: {e}")
        return None


def get_current_provider() -> str:
    """
    Determine and return the current embedding provider.

    Returns:
        'openai' if API key is configured, 'local' otherwise
    """
    global _current_provider

    if _current_provider is not None:
        return _current_provider

    if _get_openai_api_key():
        _current_provider = PROVIDER_OPENAI
        logger.info("Using OpenAI embeddings (text-embedding-3-small)")
    else:
        _current_provider = PROVIDER_LOCAL
        logger.info("Using local embeddings (sentence-transformers)")

    return _current_provider


def get_embedding_dimension() -> int:
    """
    Get the embedding dimension for the current provider.

    Returns:
        1536 for OpenAI, 384 for local
    """
    provider = get_current_provider()
    if provider == PROVIDER_OPENAI:
        return 1536
    return 384


def get_provider_info() -> dict:
    """Get information about the current embedding provider."""
    provider = get_current_provider()

    if provider == PROVIDER_OPENAI:
        return {
            "provider": "openai",
            "model": "text-embedding-3-small",
            "dimension": 1536,
            "requires_api_key": True,
            "api_key_configured": True
        }
    else:
        return {
            "provider": "local",
            "model": "all-MiniLM-L6-v2",
            "dimension": 384,
            "requires_api_key": False,
            "api_key_configured": False
        }


async def generate_embedding(text: str) -> list[float]:
    """
    Generate embedding vector for text using the best available provider.

    Automatically uses OpenAI if configured, falls back to local otherwise.

    Args:
        text: Input text to embed

    Returns:
        Embedding vector as list of floats
    """
    provider = get_current_provider()

    if provider == PROVIDER_OPENAI:
        return await _generate_embedding_openai(text)
    else:
        return _generate_embedding_local(text)


async def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for multiple texts using the best available provider.

    Args:
        texts: List of input texts to embed

    Returns:
        List of embedding vectors
    """
    provider = get_current_provider()

    if provider == PROVIDER_OPENAI:
        return await _generate_embeddings_batch_openai(texts)
    else:
        return _generate_embeddings_batch_local(texts)


# ============================================================================
# OpenAI Implementation
# ============================================================================

async def _generate_embedding_openai(text: str) -> list[float]:
    """Generate embedding using OpenAI API."""
    if not text or not text.strip():
        return [0.0] * 1536

    client = _init_openai_client()
    if not client:
        logger.warning("OpenAI client not available, falling back to local")
        return _generate_embedding_local(text)

    try:
        # Truncate if too long (8191 tokens max, ~4 chars per token)
        max_chars = 8191 * 4
        if len(text) > max_chars:
            text = text[:max_chars]
            logger.warning(f"Text truncated to {max_chars} characters")

        response = await client.embeddings.create(
            model="text-embedding-3-small",
            input=text,
            encoding_format="float"
        )

        return response.data[0].embedding

    except Exception as e:
        logger.error(f"OpenAI embedding failed: {e}, falling back to local")
        return _generate_embedding_local(text)


async def _generate_embeddings_batch_openai(texts: list[str]) -> list[list[float]]:
    """Generate batch embeddings using OpenAI API."""
    if not texts:
        return []

    client = _init_openai_client()
    if not client:
        logger.warning("OpenAI client not available, falling back to local")
        return _generate_embeddings_batch_local(texts)

    try:
        # Filter and track empty texts
        valid_texts = []
        valid_indices = []
        max_chars = 8191 * 4

        for i, text in enumerate(texts):
            if text and text.strip():
                # Truncate if needed
                if len(text) > max_chars:
                    text = text[:max_chars]
                valid_texts.append(text)
                valid_indices.append(i)

        if not valid_texts:
            return [[0.0] * 1536 for _ in texts]

        # Process in batches of 100 (OpenAI limit is 2048, but be conservative)
        all_embeddings = []
        batch_size = 100

        for batch_start in range(0, len(valid_texts), batch_size):
            batch = valid_texts[batch_start:batch_start + batch_size]

            response = await client.embeddings.create(
                model="text-embedding-3-small",
                input=batch,
                encoding_format="float"
            )

            # Sort by index to maintain order
            batch_embeddings = [
                item.embedding
                for item in sorted(response.data, key=lambda x: x.index)
            ]
            all_embeddings.extend(batch_embeddings)

        # Build result with zeros for empty texts
        result = [[0.0] * 1536 for _ in texts]
        for i, idx in enumerate(valid_indices):
            result[idx] = all_embeddings[i]

        return result

    except Exception as e:
        logger.error(f"OpenAI batch embedding failed: {e}, falling back to local")
        return _generate_embeddings_batch_local(texts)


# ============================================================================
# Local Implementation (sentence-transformers)
# ============================================================================

_local_model = None


def _get_local_model():
    """Lazy load the local embedding model."""
    global _local_model
    if _local_model is None:
        logger.info("Loading local embedding model: all-MiniLM-L6-v2")
        try:
            from sentence_transformers import SentenceTransformer
            _local_model = SentenceTransformer("all-MiniLM-L6-v2")
            logger.info("Local model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load local model: {e}")
            raise
    return _local_model


def _generate_embedding_local(text: str) -> list[float]:
    """Generate embedding using local sentence-transformers."""
    if not text or not text.strip():
        return [0.0] * 384

    model = _get_local_model()
    embedding = model.encode(text, convert_to_numpy=True)
    return embedding.tolist()


def _generate_embeddings_batch_local(texts: list[str]) -> list[list[float]]:
    """Generate batch embeddings using local sentence-transformers."""
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
        return [[0.0] * 384 for _ in texts]

    model = _get_local_model()
    embeddings = model.encode(valid_texts, convert_to_numpy=True, show_progress_bar=False)

    # Build result with zeros for empty texts
    result = [[0.0] * 384 for _ in texts]
    for i, idx in enumerate(valid_indices):
        result[idx] = embeddings[i].tolist()

    return result


# ============================================================================
# Utility Functions
# ============================================================================

def cosine_similarity(embedding1: list[float], embedding2: list[float]) -> float:
    """
    Calculate cosine similarity between two embeddings.

    Works with embeddings of any dimension.

    Args:
        embedding1: First embedding vector
        embedding2: Second embedding vector

    Returns:
        Similarity score between -1 and 1
    """
    import numpy as np
    a = np.array(embedding1)
    b = np.array(embedding2)

    norm_a = np.linalg.norm(a)
    norm_b = np.linalg.norm(b)

    if norm_a == 0 or norm_b == 0:
        return 0.0

    return float(np.dot(a, b) / (norm_a * norm_b))


def truncate_text_for_embedding(text: str, max_tokens: int = 8000) -> str:
    """
    Truncate text to fit within token limits.

    Args:
        text: Input text
        max_tokens: Maximum tokens allowed (approximate)

    Returns:
        Truncated text
    """
    max_chars = max_tokens * 4  # Rough approximation
    if len(text) > max_chars:
        return text[:max_chars]
    return text


# ============================================================================
# Synchronous Wrappers (for backwards compatibility)
# ============================================================================

def generate_embedding_sync(text: str) -> list[float]:
    """Synchronous version of generate_embedding."""
    import asyncio
    return asyncio.run(generate_embedding(text))


def generate_embeddings_batch_sync(texts: list[str]) -> list[list[float]]:
    """Synchronous version of generate_embeddings_batch."""
    import asyncio
    return asyncio.run(generate_embeddings_batch(texts))
