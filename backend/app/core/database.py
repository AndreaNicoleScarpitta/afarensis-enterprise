"""
Afarensis Enterprise Database Configuration

Handles database connections, session management, and connection pooling
for enterprise-grade performance and reliability.

Architecture
------------
This module provides the persistence layer for the Afarensis 12-layer
capability model.  It maintains two SQLAlchemy engines:

  1. **Async engine** (``async_engine``) -- used by all FastAPI request
     handlers via the ``get_db()`` dependency.  Backed by ``aiosqlite``
     (development) or ``asyncpg`` (production PostgreSQL).
  2. **Sync engine** (``sync_engine``) -- used exclusively by Alembic
     migrations and one-off admin scripts that cannot run in an async
     context.

Connection pooling is configured per-backend: SQLite uses a simple
connection (``check_same_thread=False``), while PostgreSQL uses a
QueuePool with configurable size, overflow, pre-ping, and automatic
recycling (1 hour) to survive transient network failures.

Key dependencies
~~~~~~~~~~~~~~~~
- ``app.core.config.settings`` -- supplies ``DATABASE_URL`` and pool
  tuning knobs (``DATABASE_POOL_SIZE``, ``DATABASE_MAX_OVERFLOW``).
- ``sqlalchemy[asyncio]`` with either ``aiosqlite`` or ``asyncpg``.
"""

from sqlalchemy import create_engine, MetaData, text
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker
import logging

from app.core.config import settings

logger = logging.getLogger(__name__)


# Database URL conversion for async support
def get_async_database_url(sync_url: str) -> str:
    """Convert synchronous database URL to its async driver equivalent.

    SQLAlchemy requires driver-specific URL schemes for async operation.
    This function maps standard schemes to their async counterparts:

      - ``sqlite://``           -> ``sqlite+aiosqlite://``
      - ``postgresql://``       -> ``postgresql+asyncpg://``
      - ``postgresql+psycopg2`` -> ``postgresql+asyncpg://``

    Already-async URLs are returned unchanged.  An unsupported scheme
    raises ``ValueError`` so mis-configurations fail fast at startup.
    """
    if sync_url.startswith("sqlite+aiosqlite://"):
        return sync_url
    elif sync_url.startswith("sqlite://"):
        return sync_url.replace("sqlite://", "sqlite+aiosqlite://")
    elif sync_url.startswith("postgresql://"):
        return sync_url.replace("postgresql://", "postgresql+asyncpg://")
    elif sync_url.startswith("postgresql+psycopg2://"):
        return sync_url.replace("postgresql+psycopg2://", "postgresql+asyncpg://")
    elif sync_url.startswith("postgresql+asyncpg://"):
        return sync_url
    else:
        raise ValueError(f"Unsupported database URL: {sync_url}")


def get_sync_database_url(url: str) -> str:
    """Convert async database URL to synchronous version for migrations"""
    if url.startswith("sqlite+aiosqlite://"):
        return url.replace("sqlite+aiosqlite://", "sqlite://")
    elif url.startswith("postgresql+asyncpg://"):
        return url.replace("postgresql+asyncpg://", "postgresql://")
    return url


# Async database setup
ASYNC_DATABASE_URL = get_async_database_url(settings.DATABASE_URL)
is_sqlite = ASYNC_DATABASE_URL.startswith("sqlite")

# Create async engine with appropriate options
engine_kwargs = {
    "echo": settings.DEBUG,
}

if is_sqlite:
    engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    engine_kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
    engine_kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW
    engine_kwargs["pool_pre_ping"] = True
    engine_kwargs["pool_recycle"] = 3600

async_engine = create_async_engine(ASYNC_DATABASE_URL, **engine_kwargs)

# Create async session factory
AsyncSessionLocal = sessionmaker(
    bind=async_engine,
    class_=AsyncSession,
    expire_on_commit=False,
)

# Metadata for table introspection
metadata = MetaData()

# Synchronous engine for migrations and admin tasks
SYNC_DATABASE_URL = get_sync_database_url(ASYNC_DATABASE_URL)
sync_engine_kwargs = {}
if is_sqlite:
    sync_engine_kwargs["connect_args"] = {"check_same_thread": False}
else:
    sync_engine_kwargs["pool_size"] = settings.DATABASE_POOL_SIZE
    sync_engine_kwargs["max_overflow"] = settings.DATABASE_MAX_OVERFLOW
    sync_engine_kwargs["pool_pre_ping"] = True
    sync_engine_kwargs["pool_recycle"] = 3600

sync_engine = create_engine(
    SYNC_DATABASE_URL,
    echo=settings.DEBUG,
    **sync_engine_kwargs,
)


# Dependency for getting database sessions
async def get_db() -> AsyncSession:
    """FastAPI dependency that yields a scoped async database session.

    Usage::

        @router.get("/items")
        async def list_items(db: AsyncSession = Depends(get_db)):
            ...

    The session is automatically rolled back on unhandled exceptions and
    closed when the request finishes, preventing connection leaks.
    """
    async with AsyncSessionLocal() as session:
        try:
            yield session
        except Exception:
            await session.rollback()
            raise
        finally:
            await session.close()


# Connection management
async def connect_db():
    """Initialize database connections"""
    try:
        # Verify connectivity by running a simple query
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        logger.info("Database connected successfully")
    except Exception as e:
        logger.error(f"Database connection failed: {str(e)}")
        raise


async def disconnect_db():
    """Close database connections"""
    try:
        await async_engine.dispose()
        logger.info("Database disconnected successfully")
    except Exception as e:
        logger.error(f"Database disconnection failed: {str(e)}")


# Health check function
async def check_db_health() -> bool:
    """Lightweight connectivity probe used by GET /health.

    Executes ``SELECT 1`` inside a throwaway session.  Returns ``True``
    on success, ``False`` on any exception -- callers should never see an
    unhandled error from this function.
    """
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


# Transaction management utilities
async def execute_transaction(session: AsyncSession, operations):
    """Execute a sequence of async callables inside a single transaction.

    Each callable in *operations* receives the ``session`` and is awaited
    in order.  If all succeed the transaction is committed; if any raises
    the entire transaction is rolled back and the exception propagates.

    This is useful for multi-step mutations (e.g., creating an evidence
    record *and* its initial audit-log entry) that must be atomic.
    """
    try:
        for operation in operations:
            await operation(session)
        await session.commit()
    except Exception:
        await session.rollback()
        raise


async def update_processing_config(
    session: AsyncSession,
    project_id: str,
    updater,
    *,
    max_retries: int = 3,
):
    """Safely update Project.processing_config with optimistic locking.

    ``updater`` is a callable ``(current_config: dict) -> dict`` that returns
    the new config.  If another transaction bumped ``config_version`` between
    our read and write, the update is retried (up to *max_retries* times).

    Raises ``RuntimeError`` on exhausted retries (concurrent-update conflict).
    """
    from app.models import Project
    from sqlalchemy import select as sa_select, update as sa_update

    for attempt in range(max_retries):
        result = await session.execute(
            sa_select(
                Project.processing_config, Project.config_version
            ).where(Project.id == project_id)
        )
        row = result.one_or_none()
        if row is None:
            raise ValueError(f"Project {project_id} not found")

        current_cfg, current_version = row
        new_cfg = updater(dict(current_cfg or {}))

        stmt = (
            sa_update(Project)
            .where(Project.id == project_id, Project.config_version == current_version)
            .values(processing_config=new_cfg, config_version=current_version + 1)
        )
        res = await session.execute(stmt)
        if res.rowcount == 1:
            await session.commit()
            return new_cfg

        # Version mismatch — another writer won the race.  Retry.
        await session.rollback()
        logger.warning(
            "Optimistic lock conflict on project %s config (attempt %d/%d)",
            project_id, attempt + 1, max_retries,
        )

    raise RuntimeError(
        f"Could not update processing_config for project {project_id} "
        f"after {max_retries} attempts — concurrent update conflict."
    )


# Query logging for audit purposes
class AuditQueryLogger:
    """Log database queries for audit trail"""

    def __init__(self, user_id: str = None, request_id: str = None):
        self.user_id = user_id
        self.request_id = request_id

    def log_query(self, query: str, params: dict = None):
        """Log a database query for audit purposes"""
        if settings.ENABLE_AUDIT_LOG:
            logger.info(
                f"DB Query - User: {self.user_id}, Request: {self.request_id}, "
                f"Query: {query[:100]}..., Params: {params}"
            )


# Database utilities
# Whitelist of tables that may be counted — prevents SQL injection via table_name
_ALLOWED_TABLES = frozenset({
    "projects", "evidence_records", "review_decisions",
    "audit_logs", "users", "comparability_scores",
    "bias_analyses", "regulatory_artifacts", "evidence_critiques",
    "adam_datasets", "session_tokens", "organizations",
    "saved_searches", "federated_nodes", "evidence_patterns",
    "constraint_patterns", "parsed_specifications",
    "review_assignments", "review_comments", "workflow_steps",
})


async def get_table_size(table_name: str) -> int:
    """Get the number of records in a table (injection-safe via whitelist)."""
    if table_name not in _ALLOWED_TABLES:
        raise ValueError(f"Table '{table_name}' is not in the allowed list")
    async with AsyncSessionLocal() as session:
        # Safe: table_name is validated against whitelist above
        result = await session.execute(text(f"SELECT COUNT(*) FROM {table_name}"))
        row = result.scalar()
        return row if row else 0


async def get_database_stats() -> dict:
    """Get database statistics for monitoring"""
    stats = {}
    try:
        # Get table sizes for key tables
        tables = [
            "projects", "evidence_records", "review_decisions",
            "audit_logs", "users", "comparability_scores"
        ]

        for table in tables:
            try:
                size = await get_table_size(table)
                stats[f"{table}_count"] = size
            except Exception:
                stats[f"{table}_count"] = "error"

        # Get database size (SQLite-compatible)
        if is_sqlite:
            import os
            # Extract file path from SQLite URL
            db_path = ASYNC_DATABASE_URL.replace("sqlite+aiosqlite:///", "")
            if os.path.exists(db_path):
                size_bytes = os.path.getsize(db_path)
                if size_bytes < 1024:
                    stats["database_size"] = f"{size_bytes} bytes"
                elif size_bytes < 1024 * 1024:
                    stats["database_size"] = f"{size_bytes / 1024:.1f} KB"
                else:
                    stats["database_size"] = f"{size_bytes / (1024 * 1024):.1f} MB"
            else:
                stats["database_size"] = "unknown"
        else:
            async with AsyncSessionLocal() as session:
                result = await session.execute(text(
                    "SELECT pg_size_pretty(pg_database_size(current_database())) as database_size"
                ))
                row = result.fetchone()
                if row:
                    stats["database_size"] = row[0]

        return stats
    except Exception as e:
        logger.error(f"Error getting database stats: {str(e)}")
        return {"error": str(e)}


# Connection pooling monitoring
async def get_pool_status():
    """Get connection pool status for monitoring"""
    try:
        pool = async_engine.pool
        if is_sqlite:
            # SQLite uses StaticPool or NullPool, limited info available
            return {"pool_type": "sqlite", "status": "active"}
        status = {
            "pool_size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
        }
        if hasattr(pool, "invalidated"):
            status["invalidated"] = pool.invalidated()
        return status
    except Exception as e:
        logger.error(f"Error getting pool status: {str(e)}")
        return {"error": str(e)}
