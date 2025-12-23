"""
Embedding Generation Service

Generates embeddings using OpenAI's API:
- Batch processing for efficiency
- Rate limit handling with exponential backoff
- Caching for duplicate chunks
- Progress tracking
"""

import hashlib
import logging
from datetime import datetime, timedelta
from typing import Any, Callable

import openai
from tenacity import retry, retry_if_exception_type, stop_after_attempt, wait_exponential

logger = logging.getLogger(__name__)


class EmbeddingCache:
    """Simple in-memory cache for embeddings."""

    def __init__(self, ttl_hours: int = 24):
        self.cache: dict[str, tuple] = {}  # hash -> (embedding, timestamp)
        self.ttl = timedelta(hours=ttl_hours)

    def _hash_text(self, text: str) -> str:
        """Create hash of text for cache key."""
        return hashlib.sha256(text.encode()).hexdigest()

    def get(self, text: str) -> list[float] | None:
        """Get embedding from cache if exists and not expired."""
        key = self._hash_text(text)
        if key in self.cache:
            embedding, timestamp = self.cache[key]
            if datetime.now() - timestamp < self.ttl:
                return embedding
            else:
                # Expired, remove from cache
                del self.cache[key]
        return None

    def set(self, text: str, embedding: list[float]):
        """Store embedding in cache."""
        key = self._hash_text(text)
        self.cache[key] = (embedding, datetime.now())

    def clear(self):
        """Clear all cached embeddings."""
        self.cache.clear()

    def size(self) -> int:
        """Get number of cached embeddings."""
        return len(self.cache)


class EmbeddingService:
    """Service for generating embeddings from text chunks."""

    def __init__(
        self,
        api_key: str,
        model: str = "text-embedding-3-small",
        batch_size: int = 100,
        max_retries: int = 3,
        use_cache: bool = True
    ):
        """
        Initialize embedding service.

        Args:
            api_key: OpenAI API key
            model: Embedding model to use
            batch_size: Number of texts to embed per API call
            max_retries: Maximum retry attempts for failed requests
            use_cache: Whether to cache embeddings
        """
        self.client = openai.AsyncOpenAI(api_key=api_key)
        self.model = model
        self.batch_size = batch_size
        self.max_retries = max_retries
        self.cache = EmbeddingCache() if use_cache else None

        # Model dimensions
        self.dimensions = {
            'text-embedding-3-small': 1536,
            'text-embedding-3-large': 3072,
            'text-embedding-ada-002': 1536,
        }

    async def embed_chunks(
        self,
        chunks: list[dict[str, Any]],
        progress_callback: Callable[..., Any] | None = None
    ) -> list[dict[str, Any]]:
        """
        Generate embeddings for a list of chunks.

        Args:
            chunks: List of chunk dictionaries with 'text' field
            progress_callback: Optional callback for progress updates

        Returns:
            List of chunks with 'embedding' field added
        """
        total_chunks = len(chunks)
        logger.info(f"Generating embeddings for {total_chunks} chunks")

        results = []
        cached_count = 0

        # Process in batches
        for i in range(0, total_chunks, self.batch_size):
            batch = chunks[i:i + self.batch_size]
            batch_num = (i // self.batch_size) + 1
            total_batches = (total_chunks + self.batch_size - 1) // self.batch_size

            logger.info(f"Processing batch {batch_num}/{total_batches}")

            # Check cache first
            texts_to_embed = []
            chunk_indices = []

            for idx, chunk in enumerate(batch):
                text = chunk['text']
                if self.cache:
                    cached_embedding = self.cache.get(text)
                    if cached_embedding:
                        chunk['embedding'] = cached_embedding
                        results.append(chunk)
                        cached_count += 1
                        continue

                texts_to_embed.append(text)
                chunk_indices.append(idx)

            # Generate embeddings for uncached texts
            if texts_to_embed:
                embeddings = await self._generate_embeddings(texts_to_embed)

                # Add embeddings to chunks
                for idx, embedding in zip(chunk_indices, embeddings):
                    chunk = batch[idx]
                    chunk['embedding'] = embedding
                    results.append(chunk)

                    # Cache the embedding
                    if self.cache:
                        self.cache.set(chunk['text'], embedding)

            # Progress callback
            if progress_callback:
                progress = (i + len(batch)) / total_chunks
                await progress_callback(progress, f"Embedded {i + len(batch)}/{total_chunks} chunks")

        logger.info(
            f"Embedding complete: {total_chunks} chunks "
            f"({cached_count} from cache, {total_chunks - cached_count} generated)"
        )

        return results

    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10),
        retry=retry_if_exception_type((openai.RateLimitError, openai.APITimeoutError)),
        reraise=True
    )
    async def _generate_embeddings(self, texts: list[str]) -> list[list[float]]:
        """
        Generate embeddings with retry logic.

        Args:
            texts: List of texts to embed

        Returns:
            List of embedding vectors

        Raises:
            openai.OpenAIError: If API request fails after retries
        """
        try:
            response = await self.client.embeddings.create(
                model=self.model,
                input=texts
            )

            # Extract embeddings in correct order
            embeddings = [item.embedding for item in response.data]

            return embeddings

        except openai.RateLimitError as e:
            logger.warning(f"Rate limit hit, retrying... {e!s}")
            raise
        except openai.APITimeoutError as e:
            logger.warning(f"API timeout, retrying... {e!s}")
            raise
        except Exception as e:
            logger.error(f"Error generating embeddings: {e!s}", exc_info=True)
            raise

    async def embed_single(self, text: str) -> list[float]:
        """
        Generate embedding for a single text.

        Args:
            text: Text to embed

        Returns:
            Embedding vector
        """
        # Check cache
        if self.cache:
            cached = self.cache.get(text)
            if cached:
                return cached

        # Generate embedding
        embeddings = await self._generate_embeddings([text])
        embedding = embeddings[0]

        # Cache it
        if self.cache:
            self.cache.set(text, embedding)

        return embedding

    def get_dimension(self) -> int:
        """Get embedding dimension for current model."""
        return self.dimensions.get(self.model, 1536)

    def clear_cache(self):
        """Clear embedding cache."""
        if self.cache:
            self.cache.clear()
            logger.info("Embedding cache cleared")

    def get_cache_stats(self) -> dict[str, Any]:
        """Get cache statistics."""
        if self.cache:
            return {
                'enabled': True,
                'size': self.cache.size(),
                'ttl_hours': self.cache.ttl.total_seconds() / 3600
            }
        return {'enabled': False}
