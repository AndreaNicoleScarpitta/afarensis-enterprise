"""
Enhanced Security Middleware for Afarensis Enterprise

Zero trust architecture implementation with real-time threat detection,
request monitoring, and adaptive security controls.
"""

import time
import uuid
import json
import logging
from typing import Dict, Any, Optional, Callable, List
from datetime import datetime
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response, JSONResponse
from starlette.status import HTTP_403_FORBIDDEN

from app.core.database import get_async_session
from app.core.logging import audit_logger, security_logger
from app.services.enhanced_security import ZeroTrustSecurityService, RiskLevel
from app.models import User, SessionToken

logger = logging.getLogger(__name__)

class ZeroTrustSecurityMiddleware(BaseHTTPMiddleware):
    """
    Zero Trust Security Middleware

    Implements continuous verification, risk assessment, and adaptive controls
    for every request in the system.
    """

    def __init__(self, app, exempt_paths: Optional[List[str]] = None):
        super().__init__(app)
        self.exempt_paths = exempt_paths or [
            "/health",
            "/docs",
            "/openapi.json",
            "/auth/login",
            "/auth/register"
        ]
        self.rate_limits = {}
        self.suspicious_ips = set()
        self.active_sessions = {}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()

        # Skip security checks for exempt paths
        if any(request.url.path.startswith(path) for path in self.exempt_paths):
            response = await call_next(request)
            return self._add_security_headers(response)

        try:
            # Extract request context
            request_context = await self._extract_request_context(request)

            # Perform zero trust verification
            verification_result = await self._perform_zero_trust_verification(request, request_context)

            if not verification_result["access_granted"]:
                return JSONResponse(
                    status_code=HTTP_403_FORBIDDEN,
                    content={
                        "error": "Access denied",
                        "reason": verification_result["reason"],
                        "request_id": request_context["request_id"]
                    }
                )

            # Add security context to request
            request.state.security_context = verification_result["security_context"]
            request.state.risk_assessment = verification_result["risk_assessment"]

            # Process request
            response = await call_next(request)

            # Post-process security logging
            processing_time = time.time() - start_time
            await self._log_security_event(request, response, request_context, processing_time)

            # Add security headers
            response = self._add_security_headers(response)

            return response

        except Exception as e:
            logger.error(f"Security middleware error: {str(e)}")
            await self._log_security_incident(request, str(e))

            return JSONResponse(
                status_code=500,
                content={
                    "error": "Security processing failed",
                    "request_id": request_context.get("request_id", str(uuid.uuid4()))
                }
            )

    async def _extract_request_context(self, request: Request) -> Dict[str, Any]:
        """Extract comprehensive request context for analysis"""

        # Get client information
        client_ip = self._get_client_ip(request)
        user_agent = request.headers.get("user-agent", "")

        # Extract authentication info
        auth_header = request.headers.get("authorization", "")
        token = auth_header.replace("Bearer ", "") if auth_header.startswith("Bearer ") else None

        # Create request fingerprint
        fingerprint = self._generate_request_fingerprint(request)

        return {
            "request_id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "method": request.method,
            "path": request.url.path,
            "query_params": str(request.query_params),
            "client_ip": client_ip,
            "user_agent": user_agent,
            "auth_token": token,
            "fingerprint": fingerprint,
            "content_length": request.headers.get("content-length", "0"),
            "content_type": request.headers.get("content-type", ""),
            "referer": request.headers.get("referer", ""),
            "x_forwarded_for": request.headers.get("x-forwarded-for", ""),
            "x_real_ip": request.headers.get("x-real-ip", "")
        }

    async def _perform_zero_trust_verification(self, request: Request, context: Dict[str, Any]) -> Dict[str, Any]:
        """Perform comprehensive zero trust verification"""

        try:
            # Rate limiting check
            if not await self._check_rate_limits(context):
                return {
                    "access_granted": False,
                    "reason": "Rate limit exceeded",
                    "security_context": None,
                    "risk_assessment": None
                }

            # IP reputation check
            if await self._check_ip_reputation(context["client_ip"]):
                return {
                    "access_granted": False,
                    "reason": "Suspicious IP address",
                    "security_context": None,
                    "risk_assessment": None
                }

            # Get user context if authenticated
            user = await self._get_authenticated_user(context["auth_token"])

            # Perform risk assessment
            async with get_async_session() as db:
                security_service = ZeroTrustSecurityService(db, user.__dict__ if user else None)

                # Prepare request data for security service
                request_data = {
                    "resource_type": self._determine_resource_type(context["path"]),
                    "operation": context["method"],
                    "ip_address": context["client_ip"],
                    "user_agent": context["user_agent"],
                    "request_path": context["path"],
                    "timestamp": context["timestamp"]
                }

                # Perform zero trust verification
                if user:
                    access_granted, reason, risk_assessment = await security_service.verify_zero_trust_request(
                        request_data=request_data,
                        user=user,
                        session_token=context["auth_token"]
                    )
                else:
                    # Anonymous access risk assessment
                    access_granted = await self._assess_anonymous_access(context)
                    reason = None if access_granted else "Authentication required"
                    risk_assessment = None

                # Threat detection
                threats = await security_service.detect_and_respond_to_threats(request_data)

                if threats and any(threat.risk_level in [RiskLevel.HIGH, RiskLevel.CRITICAL] for threat in threats):
                    access_granted = False
                    reason = "Security threat detected"

                return {
                    "access_granted": access_granted,
                    "reason": reason,
                    "security_context": {
                        "user_id": str(user.id) if user else None,
                        "request_id": context["request_id"],
                        "threats_detected": len(threats),
                        "security_level": "zero_trust"
                    },
                    "risk_assessment": risk_assessment.__dict__ if risk_assessment else None
                }

        except Exception as e:
            logger.error(f"Zero trust verification failed: {str(e)}")
            return {
                "access_granted": False,
                "reason": "Security verification failed",
                "security_context": None,
                "risk_assessment": None
            }

    async def _check_rate_limits(self, context: Dict[str, Any]) -> bool:
        """Check rate limiting for client IP and user"""

        client_ip = context["client_ip"]
        current_time = time.time()
        window_size = 60  # 1 minute window
        max_requests = 100  # Max requests per window

        # Clean old entries
        self.rate_limits = {
            key: timestamps for key, timestamps in self.rate_limits.items()
            if timestamps and max(timestamps) > current_time - window_size
        }

        # Check current IP
        if client_ip not in self.rate_limits:
            self.rate_limits[client_ip] = []

        # Remove old timestamps
        self.rate_limits[client_ip] = [
            ts for ts in self.rate_limits[client_ip]
            if ts > current_time - window_size
        ]

        # Check limit
        if len(self.rate_limits[client_ip]) >= max_requests:
            logger.warning(f"Rate limit exceeded for IP {client_ip}")
            return False

        # Add current request
        self.rate_limits[client_ip].append(current_time)
        return True

    async def _check_ip_reputation(self, client_ip: str) -> bool:
        """Check IP reputation against known threat lists"""

        # Check local suspicious IPs
        if client_ip in self.suspicious_ips:
            return True

        # Additional reputation checks would be implemented here
        # - GeoIP analysis
        # - Threat intelligence feeds
        # - Historical attack patterns

        return False

    async def _get_authenticated_user(self, token: Optional[str]) -> Optional[User]:
        """Get authenticated user from token"""

        if not token:
            return None

        try:
            async with get_async_session() as db:
                # Simplified token validation - would use proper JWT validation
                from sqlalchemy import select
                result = await db.execute(
                    select(User).join(SessionToken).where(SessionToken.token == token)
                )
                user = result.scalar_one_or_none()
                return user
        except Exception as e:
            logger.error(f"User authentication failed: {str(e)}")
            return None

    def _determine_resource_type(self, path: str) -> str:
        """Determine resource type from request path"""

        if "/projects/" in path:
            return "project_data"
        elif "/evidence/" in path:
            return "evidence_records"
        elif "/admin/" in path:
            return "admin_functions"
        elif "/artifacts/" in path:
            return "regulatory_artifacts"
        elif "/audit/" in path:
            return "audit_logs"
        else:
            return "general_resource"

    async def _assess_anonymous_access(self, context: Dict[str, Any]) -> bool:
        """Assess whether anonymous access is allowed for this resource"""

        # Define paths that allow anonymous access
        public_paths = [
            "/health",
            "/docs",
            "/openapi.json"
        ]

        return any(context["path"].startswith(path) for path in public_paths)

    def _generate_request_fingerprint(self, request: Request) -> str:
        """Generate unique fingerprint for request"""

        fingerprint_data = {
            "user_agent": request.headers.get("user-agent", ""),
            "accept_language": request.headers.get("accept-language", ""),
            "accept_encoding": request.headers.get("accept-encoding", ""),
            "client_ip": self._get_client_ip(request)
        }

        return str(hash(json.dumps(fingerprint_data, sort_keys=True)))

    def _get_client_ip(self, request: Request) -> str:
        """Extract client IP address handling proxies"""

        # Check headers in order of preference
        ip_headers = [
            "x-real-ip",
            "x-forwarded-for",
            "x-client-ip",
            "x-cluster-client-ip"
        ]

        for header in ip_headers:
            if header in request.headers:
                ip = request.headers[header].split(",")[0].strip()
                if ip and ip != "unknown":
                    return ip

        # Fallback to client host
        if hasattr(request.client, "host"):
            return request.client.host

        return "unknown"

    async def _log_security_event(self, request: Request, response: Response, context: Dict[str, Any], processing_time: float):
        """Log security event for monitoring and analysis"""

        event_data = {
            "request_id": context["request_id"],
            "timestamp": context["timestamp"],
            "client_ip": context["client_ip"],
            "method": context["method"],
            "path": context["path"],
            "status_code": response.status_code,
            "processing_time_ms": round(processing_time * 1000, 2),
            "user_agent": context["user_agent"][:200],  # Truncate for storage
            "security_level": getattr(request.state, "security_context", {}).get("security_level", "standard")
        }

        # Add user context if available
        if hasattr(request.state, "security_context") and request.state.security_context:
            event_data["user_id"] = request.state.security_context.get("user_id")
            event_data["threats_detected"] = request.state.security_context.get("threats_detected", 0)

        # Log to security logger
        security_logger.info("security_event", extra=event_data)

        # Log to audit trail if sensitive operation
        if self._is_sensitive_operation(context["path"], context["method"]):
            audit_logger.info("sensitive_operation", extra={
                **event_data,
                "regulatory_significance": True
            })

    async def _log_security_incident(self, request: Request, error: str):
        """Log security incident for immediate attention"""

        incident_data = {
            "incident_id": str(uuid.uuid4()),
            "timestamp": datetime.utcnow().isoformat(),
            "incident_type": "middleware_error",
            "client_ip": self._get_client_ip(request),
            "path": request.url.path,
            "method": request.method,
            "error": error,
            "severity": "high"
        }

        security_logger.error("security_incident", extra=incident_data)

    def _is_sensitive_operation(self, path: str, method: str) -> bool:
        """Determine if operation is sensitive and requires audit logging"""

        sensitive_patterns = [
            ("/admin/", ["POST", "PUT", "DELETE"]),
            ("/projects/", ["DELETE"]),
            ("/artifacts/", ["GET", "POST"]),
            ("/audit/", ["GET"]),
            ("/users/", ["POST", "PUT", "DELETE"])
        ]

        for path_pattern, methods in sensitive_patterns:
            if path_pattern in path and method in methods:
                return True

        return False

    def _add_security_headers(self, response: Response) -> Response:
        """Add security headers to response"""

        security_headers = {
            "X-Content-Type-Options": "nosniff",
            "X-Frame-Options": "DENY",
            "X-XSS-Protection": "1; mode=block",
            "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
            "Content-Security-Policy": (
                "default-src 'self'; "
                "script-src 'self' 'unsafe-inline' https://cdnjs.cloudflare.com; "
                "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
                "font-src 'self' https://fonts.gstatic.com; "
                "img-src 'self' data: https:; "
                "connect-src 'self' wss: ws:; "
                "frame-ancestors 'none'"
            ),
            "Referrer-Policy": "strict-origin-when-cross-origin",
            "Permissions-Policy": "geolocation=(), microphone=(), camera=()"
        }

        for header, value in security_headers.items():
            response.headers[header] = value

        return response


class RequestMonitoringMiddleware(BaseHTTPMiddleware):
    """
    Request Monitoring Middleware

    Monitors request patterns, performance metrics, and system health
    for operational intelligence and anomaly detection.
    """

    def __init__(self, app):
        super().__init__(app)
        self.request_metrics = {}
        self.performance_data = []

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        start_time = time.time()

        # Generate request ID
        request_id = str(uuid.uuid4())
        request.state.request_id = request_id

        # Log request start
        await self._log_request_start(request, request_id)

        try:
            # Process request
            response = await call_next(request)

            # Calculate metrics
            processing_time = time.time() - start_time

            # Log request completion
            await self._log_request_completion(request, response, request_id, processing_time)

            # Update performance metrics
            await self._update_performance_metrics(request, processing_time)

            # Add request ID to response headers
            response.headers["X-Request-ID"] = request_id

            return response

        except Exception as e:
            processing_time = time.time() - start_time
            await self._log_request_error(request, str(e), request_id, processing_time)
            raise

    async def _log_request_start(self, request: Request, request_id: str):
        """Log request start for tracing"""

        log_data = {
            "event": "request_start",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "query_params": str(request.query_params),
            "client_ip": getattr(request.client, "host", "unknown"),
            "user_agent": request.headers.get("user-agent", "")[:100],
            "timestamp": datetime.utcnow().isoformat()
        }

        logger.info("Request started", extra=log_data)

    async def _log_request_completion(self, request: Request, response: Response, request_id: str, processing_time: float):
        """Log successful request completion"""

        log_data = {
            "event": "request_complete",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "status_code": response.status_code,
            "processing_time_ms": round(processing_time * 1000, 2),
            "response_size": len(response.body) if hasattr(response, "body") else 0,
            "timestamp": datetime.utcnow().isoformat()
        }

        # Log with appropriate level based on performance
        if processing_time > 5.0:
            logger.warning("Slow request", extra=log_data)
        elif processing_time > 2.0:
            logger.info("Request completed (slow)", extra=log_data)
        else:
            logger.debug("Request completed", extra=log_data)

    async def _log_request_error(self, request: Request, error: str, request_id: str, processing_time: float):
        """Log request error"""

        log_data = {
            "event": "request_error",
            "request_id": request_id,
            "method": request.method,
            "path": request.url.path,
            "error": error,
            "processing_time_ms": round(processing_time * 1000, 2),
            "timestamp": datetime.utcnow().isoformat()
        }

        logger.error("Request failed", extra=log_data)

    async def _update_performance_metrics(self, request: Request, processing_time: float):
        """Update performance metrics for monitoring"""

        endpoint = f"{request.method}:{request.url.path}"
        current_time = time.time()

        # Initialize endpoint metrics if not exists
        if endpoint not in self.request_metrics:
            self.request_metrics[endpoint] = {
                "count": 0,
                "total_time": 0.0,
                "min_time": float("inf"),
                "max_time": 0.0,
                "recent_requests": []
            }

        metrics = self.request_metrics[endpoint]

        # Update aggregate metrics
        metrics["count"] += 1
        metrics["total_time"] += processing_time
        metrics["min_time"] = min(metrics["min_time"], processing_time)
        metrics["max_time"] = max(metrics["max_time"], processing_time)

        # Track recent requests (last 100)
        metrics["recent_requests"].append({
            "timestamp": current_time,
            "processing_time": processing_time
        })

        # Keep only recent requests
        metrics["recent_requests"] = metrics["recent_requests"][-100:]

        # Clean old metrics (older than 1 hour)
        cutoff_time = current_time - 3600
        for endpoint_key, endpoint_metrics in self.request_metrics.items():
            endpoint_metrics["recent_requests"] = [
                req for req in endpoint_metrics["recent_requests"]
                if req["timestamp"] > cutoff_time
            ]

    def get_performance_summary(self) -> Dict[str, Any]:
        """Get performance metrics summary"""

        summary = {
            "total_endpoints": len(self.request_metrics),
            "timestamp": datetime.utcnow().isoformat(),
            "endpoints": {}
        }

        for endpoint, metrics in self.request_metrics.items():
            if metrics["count"] > 0:
                avg_time = metrics["total_time"] / metrics["count"]
                recent_count = len(metrics["recent_requests"])

                summary["endpoints"][endpoint] = {
                    "total_requests": metrics["count"],
                    "recent_requests": recent_count,
                    "avg_processing_time_ms": round(avg_time * 1000, 2),
                    "min_processing_time_ms": round(metrics["min_time"] * 1000, 2),
                    "max_processing_time_ms": round(metrics["max_time"] * 1000, 2)
                }

        return summary

# Export middleware classes
__all__ = [
    "ZeroTrustSecurityMiddleware",
    "RequestMonitoringMiddleware"
]
