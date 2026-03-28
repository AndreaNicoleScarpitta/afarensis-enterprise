"""
Production rate limiter with Redis backend (falls back to in-memory for dev).

Usage as FastAPI dependency:
    @router.post("/auth/login")
    async def login(request: Request, _=Depends(rate_limit(max_requests=5, window_seconds=60))):
        ...
"""
import time
import logging
from typing import Dict, List
from fastapi import Request, HTTPException, status

logger = logging.getLogger(__name__)


class InMemoryRateLimiter:
    """Simple in-memory sliding window rate limiter (development fallback)."""

    def __init__(self):
        self._windows: Dict[str, List[float]] = {}

    async def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        now = time.time()
        cutoff = now - window_seconds

        if key not in self._windows:
            self._windows[key] = []

        # Slide window
        self._windows[key] = [t for t in self._windows[key] if t > cutoff]

        if len(self._windows[key]) >= max_requests:
            return False

        self._windows[key].append(now)
        return True

    async def get_remaining(self, key: str, max_requests: int, window_seconds: int) -> int:
        now = time.time()
        cutoff = now - window_seconds
        current = len([t for t in self._windows.get(key, []) if t > cutoff])
        return max(0, max_requests - current)


class RedisRateLimiter:
    """Redis-backed sliding window rate limiter (production)."""

    def __init__(self, redis_url: str):
        self._redis = None
        self._redis_url = redis_url

    async def _get_redis(self):
        if self._redis is None:
            try:
                import redis.asyncio as aioredis
                self._redis = aioredis.from_url(self._redis_url, decode_responses=True)
                await self._redis.ping()
                logger.info("Redis rate limiter connected")
            except Exception as e:
                logger.warning(f"Redis rate limiter failed to connect: {e}. Falling back to in-memory.")
                self._redis = None
                return None
        return self._redis

    async def is_allowed(self, key: str, max_requests: int, window_seconds: int) -> bool:
        r = await self._get_redis()
        if r is None:
            # Fail CLOSED: if Redis is unavailable, fall back to in-memory limiter
            # rather than allowing unlimited requests
            if not hasattr(self, '_fallback'):
                self._fallback = InMemoryRateLimiter()
                logger.warning("Redis unavailable — using in-memory rate limiter fallback (fail-closed)")
            return await self._fallback.is_allowed(key, max_requests, window_seconds)

        redis_key = f"ratelimit:{key}"
        now = time.time()

        pipe = r.pipeline()
        pipe.zadd(redis_key, {str(now): now})
        pipe.zremrangebyscore(redis_key, 0, now - window_seconds)
        pipe.zcard(redis_key)
        pipe.expire(redis_key, window_seconds + 1)
        results = await pipe.execute()

        count = results[2]
        return count <= max_requests

    async def get_remaining(self, key: str, max_requests: int, window_seconds: int) -> int:
        r = await self._get_redis()
        if r is None:
            if hasattr(self, '_fallback'):
                return await self._fallback.get_remaining(key, max_requests, window_seconds)
            return max_requests

        redis_key = f"ratelimit:{key}"
        now = time.time()
        await r.zremrangebyscore(redis_key, 0, now - window_seconds)
        count = await r.zcard(redis_key)
        return max(0, max_requests - count)


# Initialize the appropriate limiter
def create_rate_limiter():
    from app.core.config import settings
    if hasattr(settings, 'REDIS_URL') and settings.REDIS_URL and not settings.is_sqlite:
        try:
            return RedisRateLimiter(settings.REDIS_URL)
        except Exception:
            pass
    return InMemoryRateLimiter()


_limiter = None

def get_limiter():
    global _limiter
    if _limiter is None:
        _limiter = create_rate_limiter()
    return _limiter


def rate_limit(max_requests: int = 60, window_seconds: int = 60, key_func=None):
    """FastAPI dependency factory for rate limiting.

    Args:
        max_requests: Maximum requests allowed in the window.
        window_seconds: Window size in seconds.
        key_func: Optional callable(request) -> str for custom key extraction.
                  Defaults to client IP address.
    """
    async def _rate_limit_dep(request: Request):
        limiter = get_limiter()

        # Build rate limit key
        if key_func:
            key = key_func(request)
        else:
            # Use X-Forwarded-For if behind proxy, else client host
            forwarded = request.headers.get("X-Forwarded-For")
            ip = forwarded.split(",")[0].strip() if forwarded else (request.client.host if request.client else "unknown")
            key = f"{ip}:{request.url.path}"

        allowed = await limiter.is_allowed(key, max_requests, window_seconds)

        if not allowed:
            remaining = await limiter.get_remaining(key, max_requests, window_seconds)
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail="Rate limit exceeded. Please try again later.",
                headers={
                    "Retry-After": str(window_seconds),
                    "X-RateLimit-Limit": str(max_requests),
                    "X-RateLimit-Remaining": str(remaining),
                    "X-RateLimit-Reset": str(int(time.time()) + window_seconds),
                }
            )

    return _rate_limit_dep
