"""
OpenAI Embedding Service

Provides high-quality embeddings using OpenAI's text-embedding-3-small model.
Falls back to local embeddings if API key is not configured.

Requires: OPENAI_API_KEY environment variable
"""

import logging
import os

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# OpenAI embedding model configuration
MODEL_NAME = "text-embedding-3-small"
EMBEDDING_DIMENSION = 1536  # Dimension for text-embedding-3-small
API_URL = "https://api.openai.com/v1/embeddings"

# Rate limiting
MAX_BATCH_SIZE = 100  # OpenAI allows up to 2048, but we limit for safety
MAX_TOKENS_PER_REQUEST = 8191  # Model limit


def _get_api_key() -> str | None:
    """Get OpenAI API key from settings or environment."""
    key = getattr(settings, 'OPENAI_API_KEY', None) or os.getenv('OPENAI_API_KEY')
    return key if key and key.strip() else None


def is_available() -> bool:
    """Check if OpenAI embedding service is available (API key configured)."""
    return _get_api_key() is not None


async def generate_embedding(text: str) -> list[float]:
    """
    Generate embedding vector for text using OpenAI API.

    Args:
        text: Input text to embed

    Returns:
        Embedding vector as list of floats (1536 dimensions)

    Raises:
        ValueError: If API key is not configured
        httpx.HTTPError: If API request fails
    """
    api_key = _get_api_key()
    if not api_key:
        raise ValueError("OpenAI API key not configured")

    if not text or not text.strip():
        return [0.0] * EMBEDDING_DIMENSION

    # Truncate if too long (rough estimate: 4 chars per token)
    max_chars = MAX_TOKENS_PER_REQUEST * 4
    if len(text) > max_chars:
        text = text[:max_chars]
        logger.warning(f"Text truncated to {max_chars} characters for embedding")

    async with httpx.AsyncClient() as client:
        response = await client.post(
            API_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json"
            },
            json={
                "model": MODEL_NAME,
                "input": text
            },
            timeout=30.0
        )
        response.raise_for_status()
        data = response.json()

    return data["data"][0]["embedding"]


async def generate_embeddings_batch(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for multiple texts in a single API call.

    More efficient and cost-effective than generating one at a time.

    Args:
        texts: List of input texts to embed

    Returns:
        List of embedding vectors

    Raises:
        ValueError: If API key is not configured
        httpx.HTTPError: If API request fails
    """
    api_key = _get_api_key()
    if not api_key:
        raise ValueError("OpenAI API key not configured")

    if not texts:
        return []

    # Filter and track empty texts
    valid_texts = []
    valid_indices = []
    for i, text in enumerate(texts):
        if text and text.strip():
            # Truncate if needed
            max_chars = MAX_TOKENS_PER_REQUEST * 4
            if len(text) > max_chars:
                text = text[:max_chars]
            valid_texts.append(text)
            valid_indices.append(i)

    if not valid_texts:
        return [[0.0] * EMBEDDING_DIMENSION for _ in texts]

    # Process in batches if needed
    all_embeddings = []
    for batch_start in range(0, len(valid_texts), MAX_BATCH_SIZE):
        batch = valid_texts[batch_start:batch_start + MAX_BATCH_SIZE]

        async with httpx.AsyncClient() as client:
            response = await client.post(
                API_URL,
                headers={
                    "Authorization": f"Bearer {api_key}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": MODEL_NAME,
                    "input": batch
                },
                timeout=60.0
            )
            response.raise_for_status()
            data = response.json()

        # Extract embeddings in order
        batch_embeddings = [item["embedding"] for item in sorted(data["data"], key=lambda x: x["index"])]
        all_embeddings.extend(batch_embeddings)

    # Build result with zeros for empty texts
    result = [[0.0] * EMBEDDING_DIMENSION for _ in texts]
    for i, idx in enumerate(valid_indices):
        result[idx] = all_embeddings[i]

    return result


def get_model_info() -> dict:
    """Get information about the embedding model."""
    return {
        "model_name": MODEL_NAME,
        "embedding_dimension": EMBEDDING_DIMENSION,
        "provider": "openai",
        "requires_api_key": True,
        "api_key_configured": is_available()
    }


# Synchronous wrappers for compatibility with existing code
def generate_embedding_sync(text: str) -> list[float]:
    """Synchronous version of generate_embedding."""
    import asyncio
    return asyncio.run(generate_embedding(text))


def generate_embeddings_batch_sync(texts: list[str]) -> list[list[float]]:
    """Synchronous version of generate_embeddings_batch."""
    import asyncio
    return asyncio.run(generate_embeddings_batch(texts))
