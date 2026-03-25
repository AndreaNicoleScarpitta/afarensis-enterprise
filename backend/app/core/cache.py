"""
Caching layer with Redis backend and in-memory fallback.

Provides a simple key-value cache with TTL support:
  - Production: Redis (shared across workers, survives restarts)
  - Development: In-memory LRU dict (per-process, lost on restart)

Usage:
    from app.core.cache import cache

    # Set with TTL
    await cache.set("projects:list:org123", data, ttl=300)

    # Get (returns None on miss)
    result = await cache.get("projects:list:org123")

    # Delete (explicit invalidation)
    await cache.delete("projects:list:org123")

    # Decorator for function-level caching
    @cached(prefix="dashboard", ttl=60)
    async def get_dashboard_metrics(org_id: str):
        ...
"""

import json
import time
import hashlib
import logging
import functools
from typing import Any, Optional
from collections import OrderedDict

logger = logging.getLogger(__name__)


class InMemoryCache:
    """LRU in-memory cache with TTL (development fallback)."""

    def __init__(self, max_size: int = 1000):
        self._store: OrderedDict[str, tuple[Any, float]] = OrderedDict()  # key -> (value, expires_at)
        self._max_size = max_size

    async def get(self, key: str) -> Optional[Any]:
        entry = self._store.get(key)
        if entry is None:
            return None
        value, expires_at = entry
        if expires_at and time.time() > expires_at:
            del self._store[key]
            return None
        # Move to end (LRU)
        self._store.move_to_end(key)
        return value

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        expires_at = time.time() + ttl if ttl > 0 else 0
        if key in self._store:
            del self._store[key]
        self._store[key] = (value, expires_at)
        # Evict oldest if over capacity
        while len(self._store) > self._max_size:
            self._store.popitem(last=False)

    async def delete(self, key: str) -> None:
        self._store.pop(key, None)

    async def delete_pattern(self, pattern: str) -> int:
        """Delete all keys matching a prefix pattern (e.g. 'projects:*')."""
        prefix = pattern.rstrip("*")
        to_delete = [k for k in self._store if k.startswith(prefix)]
        for k in to_delete:
            del self._store[k]
        return len(to_delete)

    async def flush(self) -> None:
        self._store.clear()

    async def stats(self) -> dict:
        now = time.time()
        valid = sum(1 for _, (_, exp) in self._store.items() if not exp or now < exp)
        return {"backend": "memory", "keys": len(self._store), "valid_keys": valid, "max_size": self._max_size}


class RedisCache:
    """Redis-backed cache (production)."""

    def __init__(self, redis_url: str, prefix: str = "afarensis:cache:"):
        self._redis = None
        self._redis_url = redis_url
        self._prefix = prefix

    async def _get_redis(self):
        if self._redis is None:
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
                await self._redis.ping()
                logger.info("Redis cache connected")
            except Exception as e:
                logger.warning(f"Redis cache connection failed: {e}")
                self._redis = None
        return self._redis

    async def get(self, key: str) -> Optional[Any]:
        r = await self._get_redis()
        if r is None:
            return None
        try:
            raw = await r.get(self._prefix + key)
            if raw is None:
                return None
            return json.loads(raw)
        except Exception:
            return None

    async def set(self, key: str, value: Any, ttl: int = 300) -> None:
        r = await self._get_redis()
        if r is None:
            return
        try:
            await r.setex(self._prefix + key, ttl, json.dumps(value, default=str))
        except Exception as e:
            logger.warning(f"Cache set failed: {e}")

    async def delete(self, key: str) -> None:
        r = await self._get_redis()
        if r is None:
            return
        try:
            await r.delete(self._prefix + key)
        except Exception:
            pass

    async def delete_pattern(self, pattern: str) -> int:
        r = await self._get_redis()
        if r is None:
            return 0
        try:
            keys = []
            async for key in r.scan_iter(match=self._prefix + pattern):
                keys.append(key)
            if keys:
                await r.delete(*keys)
            return len(keys)
        except Exception:
            return 0

    async def flush(self) -> None:
        await self.delete_pattern("*")

    async def stats(self) -> dict:
        r = await self._get_redis()
        if r is None:
            return {"backend": "redis", "status": "disconnected"}
        try:
            info = await r.info("keyspace")
            return {"backend": "redis", "status": "connected", "info": info}
        except Exception:
            return {"backend": "redis", "status": "error"}


def _create_cache():
    """Create the appropriate cache backend."""
    from app.core.config import settings
    if hasattr(settings, 'REDIS_URL') and settings.REDIS_URL and not settings.is_sqlite:
        try:
            return RedisCache(settings.REDIS_URL, prefix=settings.REDIS_KEY_PREFIX + "cache:")
        except Exception:
            pass
    return InMemoryCache(max_size=2000)


# Singleton
cache = _create_cache()


def cached(prefix: str, ttl: int = 300):
    """Decorator to cache async function results.

    Cache key is built from prefix + org_id (if available) + function args hash.
    The org_id is extracted from `current_user` kwargs if present, ensuring
    multi-tenant cache isolation — org A never sees org B's cached data.

    Example:
        @cached(prefix="dashboard", ttl=60)
        async def get_dashboard(org_id: str):
            ...
    """
    def decorator(func):
        @functools.wraps(func)
        async def wrapper(*args, **kwargs):
            # Extract org_id for multi-tenant cache isolation
            org_id = "global"
            current_user = kwargs.get("current_user")
            if current_user is not None:
                org_id = getattr(current_user, "org_id", None) or "global"

            # Build cache key from args (excluding non-serializable objects)
            key_parts = [prefix, f"org:{org_id}"]
            for a in args:
                key_parts.append(str(a))
            for k, v in sorted(kwargs.items()):
                if k not in ('db', 'current_user', 'request', 'task_status'):
                    key_parts.append(f"{k}={v}")
            raw_key = ":".join(key_parts)
            cache_key = hashlib.md5(raw_key.encode()).hexdigest()
            full_key = f"{prefix}:org:{org_id}:{cache_key}"

            # Try cache
            hit = await cache.get(full_key)
            if hit is not None:
                return hit

            # Miss -- compute and cache
            result = await func(*args, **kwargs)
            await cache.set(full_key, result, ttl=ttl)
            return result
        return wrapper
    return decorator
