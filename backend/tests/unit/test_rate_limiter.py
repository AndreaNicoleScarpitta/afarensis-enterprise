"""Unit tests for rate limiter."""
import pytest
from app.core.rate_limiter import InMemoryRateLimiter


@pytest.fixture
def limiter():
    return InMemoryRateLimiter()


class TestInMemoryRateLimiter:
    @pytest.mark.asyncio
    async def test_allows_within_limit(self, limiter):
        for i in range(5):
            assert await limiter.is_allowed("test-key", 5, 60) is True

    @pytest.mark.asyncio
    async def test_blocks_above_limit(self, limiter):
        for i in range(5):
            await limiter.is_allowed("test-key", 5, 60)
        assert await limiter.is_allowed("test-key", 5, 60) is False

    @pytest.mark.asyncio
    async def test_different_keys_independent(self, limiter):
        for i in range(5):
            await limiter.is_allowed("key-a", 5, 60)
        # key-a is exhausted
        assert await limiter.is_allowed("key-a", 5, 60) is False
        # key-b is fresh
        assert await limiter.is_allowed("key-b", 5, 60) is True

    @pytest.mark.asyncio
    async def test_remaining_count(self, limiter):
        assert await limiter.get_remaining("fresh", 10, 60) == 10
        await limiter.is_allowed("fresh", 10, 60)
        assert await limiter.get_remaining("fresh", 10, 60) == 9
