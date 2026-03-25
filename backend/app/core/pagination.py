"""
Standardized pagination for all list endpoints.

Supports offset-based pagination with consistent response envelope:
{
    "items": [...],
    "pagination": {
        "total": 150,
        "page": 1,
        "page_size": 20,
        "total_pages": 8,
        "has_next": true,
        "has_prev": false
    }
}

Usage in routes:
    from app.core.pagination import PaginationParams, paginate_query

    @router.get("/items")
    async def list_items(
        pagination: PaginationParams = Depends(),
        db: AsyncSession = Depends(get_db),
    ):
        query = select(Item).order_by(Item.created_at.desc())
        return await paginate_query(query, pagination, db)
"""

from typing import Optional, Any, List
from fastapi import Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession


class PaginationParams:
    """FastAPI dependency for pagination query parameters."""

    def __init__(
        self,
        page: int = Query(default=1, ge=1, description="Page number (1-indexed)"),
        page_size: int = Query(default=20, ge=1, le=100, description="Items per page"),
    ):
        self.page = page
        self.page_size = page_size
        self.offset = (page - 1) * page_size


async def paginate_query(
    query,
    params: PaginationParams,
    db: AsyncSession,
    serializer=None,
) -> dict:
    """Execute a query with pagination and return standardized response.

    Args:
        query: SQLAlchemy select() statement (without limit/offset)
        params: PaginationParams from dependency injection
        db: AsyncSession
        serializer: Optional callable to transform each row (e.g., lambda r: r.__dict__)

    Returns:
        Dict with "items" and "pagination" keys
    """
    # Count total
    from sqlalchemy import select as sa_select
    count_query = sa_select(func.count()).select_from(query.subquery())
    total_result = await db.execute(count_query)
    total = total_result.scalar() or 0

    # Apply pagination
    paginated = query.offset(params.offset).limit(params.page_size)
    result = await db.execute(paginated)
    rows = result.scalars().all()

    # Serialize
    if serializer:
        items = [serializer(row) for row in rows]
    else:
        items = rows

    total_pages = max(1, (total + params.page_size - 1) // params.page_size)

    return {
        "items": items,
        "pagination": {
            "total": total,
            "page": params.page,
            "page_size": params.page_size,
            "total_pages": total_pages,
            "has_next": params.page < total_pages,
            "has_prev": params.page > 1,
        },
    }
