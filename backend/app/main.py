"""
Afarensis Enterprise: Main FastAPI Application

Enterprise-grade clinical evidence review platform for regulatory submissions.
Implements the complete 12-layer capability model for evidence evaluation.
"""

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.trustedhost import TrustedHostMiddleware
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from contextlib import asynccontextmanager
import logging
import time
import os
from datetime import datetime, timedelta

from app.core.config import settings
from app.core.database import async_engine as engine, AsyncSessionLocal, check_db_health
from app.core.logging import setup_logging
from app.core.security import SecurityHeaders
from app.api.routes import api_router
from app.api.public_routes import router as public_router
from app.core.exceptions import setup_exception_handlers


# Setup logging
setup_logging()
logger = logging.getLogger(__name__)

from app.core.observability import init_sentry  # noqa: E402
init_sentry()


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan events"""
    # Startup
    logger.info("Starting Afarensis Enterprise...")

    # Database initialization strategy:
    #   - Production (PostgreSQL): use Alembic migrations (alembic upgrade head)
    #   - Development (SQLite):    auto-create tables for zero-setup experience
    if settings.AUTO_CREATE_TABLES:
        import app.models  # noqa - ensure models are registered
        from app.models import Base

        if settings.is_sqlite:
            logger.info("SQLite mode: auto-creating tables via create_all()...")
        else:
            logger.info("PostgreSQL mode: auto-creating tables via create_all()...")

        async with engine.begin() as conn:
            # Drop stale native enum types that conflict with String columns
            if not settings.is_sqlite:
                from sqlalchemy import text as _text
                for enum_name in [
                    "projectstatus", "evidencesourcetype", "biastype",
                    "userrole", "reviewdecisionenum",
                    "executioneventtype", "executioneventstatus",
                ]:
                    try:
                        await conn.execute(_text(f"DROP TYPE IF EXISTS {enum_name} CASCADE"))
                    except Exception:
                        pass
            await conn.run_sync(Base.metadata.create_all)
        logger.info("Database tables created/verified")

        # Seed database with initial data
        from app.seed_data import seed_database
        async with AsyncSessionLocal() as session:
            await seed_database(session)
            await session.commit()

    # Verify database connectivity
    try:
        healthy = await check_db_health()
        if healthy:
            logger.info("Database connected successfully")
        else:
            logger.warning("Database health check failed on startup")
    except Exception as e:
        logger.warning(f"Database health check error on startup: {e}")

    # Fix 9: Mark any tasks stuck in 'running' as failed (orphaned by previous crash)
    try:
        from app.services.task_queue import task_queue
        await task_queue.mark_stale_running_tasks()
    except Exception as e:
        logger.warning(f"Stale task cleanup on startup failed: {e}")

    # Ensure demo user exists (idempotent — skips if already present)
    try:
        async with AsyncSessionLocal() as session:
            from sqlalchemy import text as _txt
            row = await session.execute(_txt("SELECT id FROM users WHERE email = 'demo'"))
            if row.scalar() is None:
                import bcrypt, uuid as _uuid
                hpw = bcrypt.hashpw(b"password123", bcrypt.gensalt(rounds=12)).decode()
                # Find the first organization to attach to
                org_row = await session.execute(_txt("SELECT id FROM organizations LIMIT 1"))
                org_id = org_row.scalar()
                await session.execute(_txt(
                    "INSERT INTO users (id, email, full_name, role, hashed_password, is_active, email_verified, organization, department, organization_id, created_at, updated_at) "
                    "VALUES (:id, 'demo', 'Demo User', 'ADMIN', :hpw, 1, 1, 'Afarensis Inc.', 'Demo', :org_id, :now, :now)"
                ), {"id": str(_uuid.uuid4()), "hpw": hpw, "org_id": org_id, "now": datetime.utcnow().isoformat()})
                await session.commit()
                logger.info("Demo user created (demo / password123)")
            else:
                logger.info("Demo user already exists")
    except Exception as e:
        logger.warning(f"Demo user creation failed: {e}")

    logger.info("Afarensis Enterprise ready for regulatory evidence review")

    # Schedule periodic cleanup of expired session tokens
    import asyncio
    async def cleanup_expired_tokens():
        """Purge expired and revoked tokens older than 7 days."""
        while True:
            try:
                await asyncio.sleep(3600)  # Run every hour
                async with AsyncSessionLocal() as session:
                    from sqlalchemy import delete as sa_delete
                    from app.models import SessionToken
                    cutoff = datetime.utcnow() - timedelta(days=7)
                    result = await session.execute(
                        sa_delete(SessionToken).where(
                            SessionToken.expires_at < cutoff
                        )
                    )
                    await session.commit()
                    if result.rowcount > 0:
                        logger.info(f"Cleaned up {result.rowcount} expired session tokens")
            except asyncio.CancelledError:
                break
            except Exception as e:
                logger.warning(f"Token cleanup error: {e}")

    cleanup_task = asyncio.create_task(cleanup_expired_tokens())

    yield

    # Shutdown
    cleanup_task.cancel()
    logger.info("Shutting down Afarensis Enterprise...")
    await engine.dispose()
    logger.info("Database disconnected")


def create_application() -> FastAPI:
    """Create and configure the FastAPI application"""

    app = FastAPI(
        title="Afarensis Enterprise API",
        description="Enterprise-grade clinical evidence review platform for regulatory submissions",
        version="2.0.0",
        docs_url="/docs" if settings.ENVIRONMENT == "development" else None,
        redoc_url="/redoc" if settings.ENVIRONMENT == "development" else None,
        openapi_url="/openapi.json" if settings.ENVIRONMENT != "production" else None,
        lifespan=lifespan,
    )

    # Security middleware
    app.add_middleware(SecurityHeaders)

    from app.core.observability import MetricsMiddleware
    app.add_middleware(MetricsMiddleware)

    # Fix 7: Idempotency-Key middleware — deduplicates retried POST/PUT/PATCH
    from app.core.idempotency import IdempotencyMiddleware
    app.add_middleware(IdempotencyMiddleware)

    # CORS middleware
    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.allowed_origins_list,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "DELETE", "PATCH"],
        allow_headers=["Content-Type", "Authorization", "X-Request-ID", "Accept", "Idempotency-Key"],
    )

    # Trusted host middleware
    if settings.allowed_hosts_list:
        app.add_middleware(
            TrustedHostMiddleware,
            allowed_hosts=settings.allowed_hosts_list
        )

    # Request timing middleware
    @app.middleware("http")
    async def add_process_time_header(request: Request, call_next):
        start_time = time.time()
        response = await call_next(request)
        process_time = time.time() - start_time
        response.headers["X-Process-Time"] = str(process_time)
        return response

    # Request logging middleware
    @app.middleware("http")
    async def log_requests(request: Request, call_next):
        logger.info(f"{request.method} {request.url.path}")
        response = await call_next(request)
        logger.info(f"{request.method} {request.url.path} - {response.status_code}")
        return response

    # Include API routes
    app.include_router(api_router, prefix="/api/v1")

    # Public-facing website routes (no auth required)
    app.include_router(public_router)

    # Health check endpoints
    @app.get("/health")
    async def health_check():
        """Basic health check"""
        return {"status": "healthy", "service": "afarensis-enterprise"}

    @app.get("/health/detailed")
    async def detailed_health_check():
        """Detailed health check with dependency status"""
        try:
            healthy = await check_db_health()
            db_status = "healthy" if healthy else "unhealthy"
        except Exception as e:
            db_status = f"unhealthy: {str(e)}"

        return {
            "status": "healthy" if db_status == "healthy" else "degraded",
            "service": "afarensis-enterprise",
            "version": "2.0.0",
            "dependencies": {
                "database": db_status,
                "redis": "not_configured",
                "llm": "not_configured",
            }
        }

    # Serve built React frontend (production mode)
    # The frontend build output lives at ../frontend/dist when deployed together
    static_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), '..', 'frontend', 'dist')
    if os.path.isdir(static_dir):
        # Serve static assets (JS, CSS, images)
        assets_dir = os.path.join(static_dir, 'assets')
        if os.path.isdir(assets_dir):
            app.mount("/assets", StaticFiles(directory=assets_dir), name="assets")

        css_dir = os.path.join(static_dir, 'css')
        if os.path.isdir(css_dir):
            app.mount("/css", StaticFiles(directory=css_dir), name="css")

        js_dir = os.path.join(static_dir, 'js')
        if os.path.isdir(js_dir):
            app.mount("/js", StaticFiles(directory=js_dir), name="js")

        images_dir = os.path.join(static_dir, 'images')
        if os.path.isdir(images_dir):
            app.mount("/images", StaticFiles(directory=images_dir), name="images")

        # SPA fallback: serve index.html for all non-API, non-static routes
        index_html = os.path.join(static_dir, 'index.html')

        @app.get("/{full_path:path}")
        async def serve_spa(full_path: str):
            # Don't intercept API routes or docs
            if full_path.startswith("api/") or full_path in ("docs", "redoc", "openapi.json", "health"):
                return JSONResponse({"detail": "Not found"}, status_code=404)
            # Try to serve the exact file first
            file_path = os.path.join(static_dir, full_path)
            if os.path.isfile(file_path):
                return FileResponse(file_path)
            # Fallback to index.html for SPA routing
            return FileResponse(index_html)

    # Setup exception handlers
    setup_exception_handlers(app)

    return app


# Create the application instance
app = create_application()


# Root endpoint
@app.get("/")
async def root():
    """API root endpoint"""
    return {
        "message": "Afarensis Enterprise API",
        "description": "Enterprise-grade clinical evidence review platform",
        "version": "2.0.0",
        "docs": "/docs" if settings.ENVIRONMENT == "development" else None,
        "health": "/health",
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=settings.ENVIRONMENT == "development",
        access_log=settings.ENVIRONMENT == "development",
    )
