"""
Observability: Sentry error tracking, Prometheus-compatible metrics, and
structured request logging.

Configuration (via .env):
  SENTRY_DSN=https://...@sentry.io/...   # Enable Sentry error tracking
  SENTRY_TRACES_SAMPLE_RATE=0.1          # 10% of requests traced (APM)
  SENTRY_ENVIRONMENT=production           # Environment tag

If SENTRY_DSN is not set, Sentry is silently disabled.
"""

import time
import logging
from collections import defaultdict
from datetime import datetime

from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

logger = logging.getLogger(__name__)


def init_sentry():
    """Initialize Sentry SDK if DSN is configured."""
    from app.core.config import settings
    dsn = getattr(settings, 'SENTRY_DSN', None)
    if not dsn:
        logger.info("Sentry not configured (no SENTRY_DSN). Error tracking disabled.")
        return

    try:
        import sentry_sdk
        from sentry_sdk.integrations.fastapi import FastApiIntegration
        from sentry_sdk.integrations.sqlalchemy import SqlalchemyIntegration
        from sentry_sdk.integrations.logging import LoggingIntegration

        traces_rate = float(getattr(settings, 'SENTRY_TRACES_SAMPLE_RATE', 0.1))
        environment = getattr(settings, 'SENTRY_ENVIRONMENT', settings.ENVIRONMENT)

        sentry_sdk.init(
            dsn=dsn,
            integrations=[
                FastApiIntegration(transaction_style="endpoint"),
                SqlalchemyIntegration(),
                LoggingIntegration(level=logging.WARNING, event_level=logging.ERROR),
            ],
            traces_sample_rate=traces_rate,
            environment=environment,
            release=f"afarensis@{settings.VERSION}",
            send_default_pii=False,  # Don't send user PII to Sentry
        )
        logger.info(f"Sentry initialized (env={environment}, traces={traces_rate})")
    except ImportError:
        logger.warning("sentry-sdk not installed. Run: pip install sentry-sdk[fastapi]")
    except Exception as e:
        logger.warning(f"Sentry initialization failed: {e}")


class RequestMetrics:
    """In-memory request metrics collector (Prometheus-compatible export)."""

    def __init__(self):
        self.request_count = defaultdict(int)       # {method:path:status} -> count
        self.request_duration = defaultdict(list)   # {method:path} -> [durations]
        self.error_count = defaultdict(int)         # {status_code} -> count
        self.active_requests = 0
        self.total_requests = 0
        self.started_at = datetime.utcnow()

    def record(self, method: str, path: str, status: int, duration: float):
        # Normalize path (replace UUIDs with :id)
        import re
        normalized = re.sub(
            r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}',
            ':id', path
        )
        key = f"{method} {normalized}"

        self.request_count[f"{key} {status}"] += 1
        self.total_requests += 1

        # Keep last 1000 durations per endpoint for percentile calculation
        durations = self.request_duration[key]
        durations.append(duration)
        if len(durations) > 1000:
            self.request_duration[key] = durations[-500:]

        if status >= 400:
            self.error_count[status] += 1

    def get_summary(self) -> dict:
        """Return metrics summary for the /system/metrics endpoint."""
        now = datetime.utcnow()
        uptime = (now - self.started_at).total_seconds()

        # Calculate p50/p95/p99 for all endpoints combined
        all_durations = []
        for durations in self.request_duration.values():
            all_durations.extend(durations)

        percentiles = {}
        if all_durations:
            all_durations.sort()
            n = len(all_durations)
            percentiles = {
                "p50_ms": round(all_durations[int(n * 0.50)] * 1000, 1),
                "p95_ms": round(all_durations[int(n * 0.95)] * 1000, 1),
                "p99_ms": round(all_durations[min(int(n * 0.99), n - 1)] * 1000, 1),
            }

        # Top 10 slowest endpoints
        endpoint_stats = {}
        for key, durations in self.request_duration.items():
            if durations:
                avg = sum(durations) / len(durations)
                endpoint_stats[key] = {
                    "count": len(durations),
                    "avg_ms": round(avg * 1000, 1),
                    "max_ms": round(max(durations) * 1000, 1),
                }

        slowest = sorted(endpoint_stats.items(), key=lambda x: x[1]["avg_ms"], reverse=True)[:10]

        return {
            "uptime_seconds": round(uptime),
            "total_requests": self.total_requests,
            "active_requests": self.active_requests,
            "error_counts": dict(self.error_count),
            "latency": percentiles,
            "slowest_endpoints": {k: v for k, v in slowest},
            "requests_per_second": round(self.total_requests / max(uptime, 1), 2),
        }


# Singleton
metrics = RequestMetrics()


class MetricsMiddleware(BaseHTTPMiddleware):
    """Middleware that records request duration and status for every request."""

    async def dispatch(self, request: Request, call_next):
        metrics.active_requests += 1
        start = time.time()

        try:
            response = await call_next(request)
            duration = time.time() - start
            metrics.record(request.method, request.url.path, response.status_code, duration)

            # Add server timing header for APM tools
            response.headers["Server-Timing"] = f"total;dur={duration * 1000:.1f}"
            return response
        except Exception:
            duration = time.time() - start
            metrics.record(request.method, request.url.path, 500, duration)
            raise
        finally:
            metrics.active_requests -= 1
