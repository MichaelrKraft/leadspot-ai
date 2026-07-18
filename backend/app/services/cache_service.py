"""
Redis caching service for query results and embeddings
"""

import hashlib
import json
from typing import Any

import redis.asyncio as redis

from app.config import settings


class CacheService:
    """Redis-based caching for queries, embeddings, and results"""

    # TTL constants (in seconds)
    QUERY_RESULT_TTL = 300  # 5 minutes
    EMBEDDING_TTL = 86400  # 24 hours
    QUERY_HISTORY_TTL = 604800  # 7 days
    SESSION_TTL = 3600  # 1 hour

    def __init__(self):
        self.redis_client: redis.Redis | None = None
        self._initialized = False

    async def initialize(self):
        """Initialize Redis connection"""
        if not self._initialized:
            try:
                self.redis_client = await redis.from_url(
                    settings.REDIS_URL,
                    encoding="utf-8",
                    decode_responses=True
                )
                # Test connection
                await self.redis_client.ping()
                self._initialized = True
            except Exception as e:
                print(f"Warning: Redis connection failed: {e}")
                print("Caching will be disabled")
                self.redis_client = None
                self._initialized = False

    async def close(self):
        """Close Redis connection"""
        if self.redis_client:
            await self.redis_client.close()
            self._initialized = False

    def _generate_cache_key(self, prefix: str, *args) -> str:
        """
        Generate cache key from prefix and arguments

        Args:
            prefix: Key prefix (e.g., 'query', 'embedding')
            *args: Arguments to hash

        Returns:
            Cache key string
        """
        # Combine arguments into a string
        combined = ":".join(str(arg) for arg in args)

        # Hash for consistent key length
        hash_digest = hashlib.sha256(combined.encode()).hexdigest()[:16]

        return f"innosynth:{prefix}:{hash_digest}"

    async def get_query_result(
        self,
        query: str,
        organization_id: str,
        max_sources: int
    ) -> dict | None:
        """
        Get cached query result

        Args:
            query: User query
            organization_id: Organization ID
            max_sources: Maximum sources requested

        Returns:
            Cached result dict or None
        """
        if not self.redis_client:
            return None

        try:
            key = self._generate_cache_key("query", query, organization_id, max_sources)
            cached = await self.redis_client.get(key)

            if cached:
                return json.loads(cached)

            return None

        except Exception as e:
            print(f"Cache get error: {e}")
            return None

    async def set_query_result(
        self,
        query: str,
        organization_id: str,
        max_sources: int,
        result: dict,
        ttl: int = None
    ) -> bool:
        """
        Cache query result

        Args:
            query: User query
            organization_id: Organization ID
            max_sources: Maximum sources requested
            result: Result dictionary to cache
            ttl: Time to live in seconds (default: QUERY_RESULT_TTL)

        Returns:
            True if cached successfully
        """
        if not self.redis_client:
            return False

        try:
            key = self._generate_cache_key("query", query, organization_id, max_sources)
            ttl = ttl or self.QUERY_RESULT_TTL

            await self.redis_client.setex(
                key,
                ttl,
                json.dumps(result, default=str)  # default=str handles UUID, datetime
            )

            return True

        except Exception as e:
            print(f"Cache set error: {e}")
            return False

    async def get_embedding(self, text: str) -> list[float] | None:
        """
        Get cached embedding for text

        Args:
            text: Text to lookup

        Returns:
            Embedding vector or None
        """
        if not self.redis_client:
            return None

        try:
            key = self._generate_cache_key("embedding", text)
            cached = await self.redis_client.get(key)

            if cached:
                return json.loads(cached)

            return None

        except Exception as e:
            print(f"Cache get embedding error: {e}")
            return None

    async def set_embedding(
        self,
        text: str,
        embedding: list[float],
        ttl: int = None
    ) -> bool:
        """
        Cache embedding for text

        Args:
            text: Text that was embedded
            embedding: Embedding vector
            ttl: Time to live in seconds (default: EMBEDDING_TTL)

        Returns:
            True if cached successfully
        """
        if not self.redis_client:
            return False

        try:
            key = self._generate_cache_key("embedding", text)
            ttl = ttl or self.EMBEDDING_TTL

            await self.redis_client.setex(
                key,
                ttl,
                json.dumps(embedding)
            )

            return True

        except Exception as e:
            print(f"Cache set embedding error: {e}")
            return False

    async def add_to_query_history(
        self,
        user_id: str,
        query_data: dict
    ) -> bool:
        """
        Add query to user's history

        Args:
            user_id: User ID
            query_data: Query data to store

        Returns:
            True if added successfully
        """
        if not self.redis_client:
            return False

        try:
            key = f"innosynth:history:{user_id}"

            # Add to list (most recent first)
            await self.redis_client.lpush(
                key,
                json.dumps(query_data, default=str)
            )

            # Trim to keep only last 50 queries
            await self.redis_client.ltrim(key, 0, 49)

            # Set expiry
            await self.redis_client.expire(key, self.QUERY_HISTORY_TTL)

            return True

        except Exception as e:
            print(f"Cache add history error: {e}")
            return False

    async def get_query_history(
        self,
        user_id: str,
        limit: int = 20
    ) -> list[dict]:
        """
        Get user's query history

        Args:
            user_id: User ID
            limit: Maximum queries to return

        Returns:
            List of query data dictionaries
        """
        if not self.redis_client:
            return []

        try:
            key = f"innosynth:history:{user_id}"

            # Get recent queries
            cached_queries = await self.redis_client.lrange(key, 0, limit - 1)

            return [json.loads(q) for q in cached_queries]

        except Exception as e:
            print(f"Cache get history error: {e}")
            return []

    async def invalidate_query_cache(
        self,
        organization_id: str
    ) -> int:
        """
        Invalidate all cached queries for an organization
        (useful when documents are added/removed)

        Args:
            organization_id: Organization ID

        Returns:
            Number of keys deleted
        """
        if not self.redis_client:
            return 0

        try:
            # Find all query cache keys for this org
            pattern = f"innosynth:query:*{organization_id}*"
            keys = []

            async for key in self.redis_client.scan_iter(match=pattern):
                keys.append(key)

            if keys:
                return await self.redis_client.delete(*keys)

            return 0

        except Exception as e:
            print(f"Cache invalidation error: {e}")
            return 0

    async def set_value(
        self,
        key: str,
        value: Any,
        ttl: int = None
    ) -> bool:
        """
        Generic set value with optional TTL

        Args:
            key: Cache key
            value: Value to cache (will be JSON serialized)
            ttl: Time to live in seconds

        Returns:
            True if set successfully
        """
        if not self.redis_client:
            return False

        try:
            full_key = f"innosynth:generic:{key}"

            if ttl:
                await self.redis_client.setex(
                    full_key,
                    ttl,
                    json.dumps(value, default=str)
                )
            else:
                await self.redis_client.set(
                    full_key,
                    json.dumps(value, default=str)
                )

            return True

        except Exception as e:
            print(f"Cache set value error: {e}")
            return False

    async def get_value(self, key: str) -> Any | None:
        """
        Generic get value

        Args:
            key: Cache key

        Returns:
            Cached value or None
        """
        if not self.redis_client:
            return None

        try:
            full_key = f"innosynth:generic:{key}"
            cached = await self.redis_client.get(full_key)

            if cached:
                return json.loads(cached)

            return None

        except Exception as e:
            print(f"Cache get value error: {e}")
            return None

    async def delete_key(self, key: str) -> bool:
        """
        Delete a cache key

        Args:
            key: Cache key to delete

        Returns:
            True if deleted
        """
        if not self.redis_client:
            return False

        try:
            full_key = f"innosynth:generic:{key}"
            await self.redis_client.delete(full_key)
            return True

        except Exception as e:
            print(f"Cache delete error: {e}")
            return False


# Singleton instance
_cache_service = None


async def get_cache_service() -> CacheService:
    """
    Get singleton CacheService instance

    Returns:
        CacheService instance
    """
    global _cache_service
    if _cache_service is None:
        _cache_service = CacheService()
        await _cache_service.initialize()
    return _cache_service
