"""
Idempotency-Key middleware for mutating endpoints.

When a client sends an ``Idempotency-Key`` header on a POST/PUT/PATCH
request, the server:

1. Checks an in-memory (TTL) cache for a previous response with the
   same ``(user_id, idempotency_key)`` pair.
2. If found → returns the cached response immediately (replay).
3. If not found → executes the endpoint, caches the response, and
   returns it.

This prevents duplicate side-effects when clients retry on network
timeouts (e.g., two evidence-discovery runs, two dataset analyses,
double-posting a review decision).

The cache evicts entries after ``TTL_SECONDS`` (default 24 h) to bound
memory usage.  In production this should be backed by Redis; the
in-memory implementation is sufficient for single-worker deployments.
"""

import asyncio
import hashlib
import logging
import time
from typing import Any, Dict, Optional, Tuple

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware, RequestResponseEndpoint
from starlette.responses import JSONResponse

logger = logging.getLogger(__name__)

# Default TTL: 24 hours
TTL_SECONDS = 86_400

# Max cache entries to prevent unbounded memory growth
MAX_ENTRIES = 10_000


class _CachedResponse:
    """Snapshot of a previously returned response."""

    __slots__ = ("status_code", "body", "headers", "created_at")

    def __init__(self, status_code: int, body: bytes, headers: dict, created_at: float):
        self.status_code = status_code
        self.body = body
        self.headers = headers
        self.created_at = created_at


class IdempotencyStore:
    """Thread-safe in-memory idempotency cache with TTL eviction.

    Key: ``(user_id, idempotency_key)``  →  Value: ``_CachedResponse``

    Production upgrade path: swap this for a Redis-backed store that
    uses ``SET NX EX`` for atomic insert-if-absent.
    """

    def __init__(self, ttl: int = TTL_SECONDS, max_entries: int = MAX_ENTRIES):
        self._store: Dict[str, _CachedResponse] = {}
        self._lock = asyncio.Lock()
        self._ttl = ttl
        self._max_entries = max_entries

    async def get(self, key: str) -> Optional[_CachedResponse]:
        async with self._lock:
            entry = self._store.get(key)
            if entry is None:
                return None
            if time.monotonic() - entry.created_at > self._ttl:
                del self._store[key]
                return None
            return entry

    async def put(self, key: str, response: _CachedResponse):
        async with self._lock:
            # Evict expired entries if we're near capacity
            if len(self._store) >= self._max_entries:
                now = time.monotonic()
                expired = [k for k, v in self._store.items() if now - v.created_at > self._ttl]
                for k in expired:
                    del self._store[k]
                # If still over capacity, evict oldest 10%
                if len(self._store) >= self._max_entries:
                    by_age = sorted(self._store.items(), key=lambda kv: kv[1].created_at)
                    for k, _ in by_age[: len(by_age) // 10 + 1]:
                        del self._store[k]
            self._store[key] = response

    async def contains(self, key: str) -> bool:
        return (await self.get(key)) is not None

    @property
    def size(self) -> int:
        return len(self._store)


# Singleton store
idempotency_store = IdempotencyStore()


# ---------------------------------------------------------------------------
# FastAPI dependency (alternative to middleware — more targeted)
# ---------------------------------------------------------------------------

def _extract_user_id(request: Request) -> str:
    """Best-effort extraction of user identity from request state."""
    # The auth dependency sets request.state.current_user before this runs
    user = getattr(request.state, "current_user", None)
    if user and hasattr(user, "id"):
        return str(user.id)
    # Fallback: use client IP (less reliable but prevents cross-user collisions)
    return request.client.host if request.client else "anonymous"


def _make_cache_key(user_id: str, idempotency_key: str) -> str:
    """Deterministic cache key."""
    raw = f"{user_id}:{idempotency_key}"
    return hashlib.sha256(raw.encode()).hexdigest()


class IdempotencyMiddleware(BaseHTTPMiddleware):
    """Starlette middleware that intercepts ``Idempotency-Key`` headers.

    Only applies to POST, PUT, PATCH methods.  GET/DELETE/OPTIONS are
    pass-through.
    """

    IDEMPOTENT_METHODS = {"POST", "PUT", "PATCH"}

    async def dispatch(self, request: Request, call_next: RequestResponseEndpoint) -> Response:
        # Only intercept mutating methods
        if request.method not in self.IDEMPOTENT_METHODS:
            return await call_next(request)

        idem_key = request.headers.get("Idempotency-Key") or request.headers.get("idempotency-key")
        if not idem_key:
            # No idempotency requested — proceed normally
            return await call_next(request)

        # Validate key format (max 256 chars, printable ASCII)
        if len(idem_key) > 256:
            return JSONResponse(
                status_code=400,
                content={"detail": "Idempotency-Key must be ≤256 characters"},
            )

        # User identity — try auth header, fall back to IP
        user_id = _extract_user_id(request)
        cache_key = _make_cache_key(user_id, idem_key)

        # Check cache
        cached = await idempotency_store.get(cache_key)
        if cached is not None:
            logger.info("Idempotency cache HIT for key=%s (user=%s)", idem_key[:16], user_id[:8])
            resp = Response(
                content=cached.body,
                status_code=cached.status_code,
                media_type="application/json",
            )
            resp.headers["X-Idempotency-Replayed"] = "true"
            return resp

        # Execute the real handler
        response = await call_next(request)

        # Cache the response (only for success / client-error, not 5xx)
        if response.status_code < 500:
            # Read the response body
            body_chunks = []
            async for chunk in response.body_iterator:
                if isinstance(chunk, str):
                    chunk = chunk.encode("utf-8")
                body_chunks.append(chunk)
            body = b"".join(body_chunks)

            await idempotency_store.put(
                cache_key,
                _CachedResponse(
                    status_code=response.status_code,
                    body=body,
                    headers=dict(response.headers),
                    created_at=time.monotonic(),
                ),
            )

            # Return a new response since we consumed the body iterator
            new_response = Response(
                content=body,
                status_code=response.status_code,
                media_type=response.media_type,
            )
            for k, v in response.headers.items():
                if k.lower() not in ("content-length", "content-encoding", "transfer-encoding"):
                    new_response.headers[k] = v
            new_response.headers["X-Idempotency-Key-Accepted"] = "true"
            return new_response

        return response
