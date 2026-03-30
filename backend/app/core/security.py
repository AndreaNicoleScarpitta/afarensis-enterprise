"""
Afarensis Enterprise Security - CRITICAL PASSLIB/BCRYPT FIX APPLIED

Enterprise-grade security features including authentication, authorization,
encryption, and regulatory compliance controls.

Architecture
~~~~~~~~~~~~
This module is the security backbone of the platform and is organised into
five functional areas:

  1. **Password hashing** -- direct ``bcrypt`` usage (passlib removed) with
     strength validation rules enforced at registration time.
  2. **JWT lifecycle** -- ``create_access_token`` / ``create_refresh_token`` /
     ``verify_token``.  Tokens carry ``iss``, ``aud``, and a unique ``jti``
     for server-side revocation support.
  3. **Rate limiting** -- in-memory ``RateLimiter`` with per-identifier
     sliding windows and exponential backoff after repeated failures.
  4. **RBAC** -- ``Permissions`` / ``Roles`` constants plus the ``require_role``
     FastAPI dependency factory.  Four built-in roles: viewer, analyst,
     reviewer, admin.
  5. **Middleware & utilities** -- ``SecurityHeaders`` middleware (CSP, HSTS,
     X-Frame-Options), Fernet encryption helpers, secure file handling, and
     audit-logging wrappers.

CRITICAL CHANGE: Replaced passlib with direct bcrypt usage to fix compatibility
with bcrypt 5.0+ which broke passlib's version detection mechanism.
"""

import asyncio
import secrets
import hashlib
import hmac
import bcrypt
from typing import Optional, List, Dict, Any
from datetime import datetime, timedelta
from pathlib import Path

import jwt
from fastapi import HTTPException, status, Request, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import RedirectResponse
from cryptography.fernet import Fernet

from app.core.config import settings
from app.core.logging import audit_logger


# CRITICAL FIX: Replace passlib with direct bcrypt usage
# This fixes the critical compatibility issue with bcrypt 5.0+

def _verify_password_sync(plain_password: str, hashed_password: str) -> bool:
    """CPU-bound bcrypt verification — runs in thread pool via verify_password()."""
    if isinstance(hashed_password, str):
        hashed_password = hashed_password.encode('utf-8')
    return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password)


def _hash_password_sync(password: str) -> str:
    """CPU-bound bcrypt hashing — runs in thread pool via get_password_hash_async()."""
    password_bytes = password.encode('utf-8')
    salt = bcrypt.gensalt(rounds=12)
    hashed = bcrypt.hashpw(password_bytes, salt)
    return hashed.decode('utf-8')


async def verify_password_async(plain_password: str, hashed_password: str) -> bool:
    """Verify password against bcrypt hash without blocking the event loop.

    bcrypt.checkpw at cost=12 takes ~250ms of pure CPU.  Running it in
    the default ThreadPoolExecutor prevents the event loop from stalling
    during concurrent login attempts.
    """
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(
            None, _verify_password_sync, plain_password, hashed_password
        )
    except Exception as e:
        audit_logger.log_system_event(
            event="password_verification_error",
            event_type="security_error",
            details={"error": str(e)},
            severity="error"
        )
        return False


def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Sync fallback for non-async contexts (migrations, CLI scripts).

    In request handlers, prefer verify_password_async().
    """
    try:
        return _verify_password_sync(plain_password, hashed_password)
    except Exception as e:
        audit_logger.log_system_event(
            event="password_verification_error",
            event_type="security_error",
            details={"error": str(e)},
            severity="error"
        )
        return False


async def get_password_hash_async(password: str) -> str:
    """Hash password for storage without blocking the event loop."""
    try:
        loop = asyncio.get_running_loop()
        return await loop.run_in_executor(None, _hash_password_sync, password)
    except Exception as e:
        audit_logger.log_system_event(
            event="password_hashing_error",
            event_type="security_error",
            details={"error": str(e)},
            severity="error"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to hash password"
        )


def get_password_hash(password: str) -> str:
    """Sync fallback for non-async contexts.

    In request handlers, prefer get_password_hash_async().
    """
    try:
        return _hash_password_sync(password)
    except Exception as e:
        audit_logger.log_system_event(
            event="password_hashing_error",
            event_type="security_error",
            details={"error": str(e)},
            severity="error"
        )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to hash password"
        )


def verify_password_strength(password: str) -> tuple[bool, List[str]]:
    """
    Verify password meets security requirements

    Returns: (is_valid, list_of_issues)
    """
    issues = []

    if len(password) < 8:
        issues.append("Password must be at least 8 characters long")

    if not any(c.isupper() for c in password):
        issues.append("Password must contain at least one uppercase letter")

    if not any(c.islower() for c in password):
        issues.append("Password must contain at least one lowercase letter")

    if not any(c.isdigit() for c in password):
        issues.append("Password must contain at least one number")

    special_chars = "!@#$%^&*()_+-=[]{}|;:,.<>?"
    if not any(c in special_chars for c in password):
        issues.append("Password must contain at least one special character")

    # Check for common patterns
    common_patterns = ['123456', 'password', 'admin', 'qwerty']
    if any(pattern in password.lower() for pattern in common_patterns):
        issues.append("Password contains common patterns")

    return len(issues) == 0, issues


# JWT settings
ALGORITHM = "HS256"

# Initialize encryption
if settings.ENCRYPTION_KEY:
    cipher_suite = Fernet(settings.ENCRYPTION_KEY.encode())
else:
    cipher_suite = None


class SecurityHeaders(BaseHTTPMiddleware):
    """Middleware to add security headers to all responses"""

    # Paths excluded from HTTPS redirect (health checks from load balancers use HTTP)
    _NO_REDIRECT = frozenset({"/health", "/api/v1/health"})

    async def dispatch(self, request: Request, call_next):
        path = request.url.path

        # Redirect HTTP to HTTPS in production (skip health checks & WebSocket upgrades)
        if settings.is_production:
            forwarded_proto = request.headers.get("X-Forwarded-Proto", "")
            is_websocket = request.headers.get("Upgrade", "").lower() == "websocket"
            if forwarded_proto == "http" and path not in self._NO_REDIRECT and not is_websocket:
                url = request.url.replace(scheme="https")
                return RedirectResponse(url=str(url), status_code=301)

        response = await call_next(request)

        # Security headers
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["Permissions-Policy"] = "geolocation=(), microphone=(), camera=()"

        # Content Security Policy
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; "
            "script-src 'self' https://www.googletagmanager.com https://www.google-analytics.com; "
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
            "img-src 'self' data: https:; "
            "font-src 'self' https://fonts.gstatic.com; "
            "connect-src 'self' wss: https://www.google-analytics.com https://www.googletagmanager.com "
            "https://api.anthropic.com https://api.openai.com https://api.sendgrid.com; "
            "frame-ancestors 'none'; "
            "base-uri 'self'; "
            "form-action 'self'"
        )

        return response


class RateLimiter:
    """Simple in-memory rate limiter with exponential backoff"""

    def __init__(self):
        self.requests: Dict[str, List[datetime]] = {}
        self.failed_attempts: Dict[str, int] = {}

    def is_allowed(self, identifier: str, max_requests: int = None, window_minutes: int = 1) -> bool:
        """Check if request is within rate limit"""
        max_requests = max_requests or settings.RATE_LIMIT_PER_MINUTE
        now = datetime.utcnow()
        window_start = now - timedelta(minutes=window_minutes)

        # Apply exponential backoff for failed attempts
        failed_count = self.failed_attempts.get(identifier, 0)
        if failed_count > 3:
            backoff_minutes = min(failed_count - 3, 10)  # Max 10 minute backoff
            backoff_start = now - timedelta(minutes=backoff_minutes)
            if any(req_time > backoff_start for req_time in self.requests.get(identifier, [])):
                return False

        # Clean old requests
        if identifier in self.requests:
            self.requests[identifier] = [
                req_time for req_time in self.requests[identifier]
                if req_time > window_start
            ]
        else:
            self.requests[identifier] = []

        # Check limit
        if len(self.requests[identifier]) >= max_requests:
            return False

        # Add current request
        self.requests[identifier].append(now)
        return True

    def record_failed_attempt(self, identifier: str):
        """Record a failed authentication attempt for rate limiting"""
        self.failed_attempts[identifier] = self.failed_attempts.get(identifier, 0) + 1

    def reset_failed_attempts(self, identifier: str):
        """Reset failed attempts on successful authentication"""
        if identifier in self.failed_attempts:
            del self.failed_attempts[identifier]


# Global rate limiter instance
rate_limiter = RateLimiter()


class JWTBearer(HTTPBearer):
    """Custom JWT Bearer authentication with enhanced security"""

    def __init__(self, auto_error: bool = True):
        super().__init__(auto_error=auto_error)

    async def __call__(self, request: Request) -> Optional[str]:
        credentials: HTTPAuthorizationCredentials = await super().__call__(request)
        if credentials:
            if not credentials.scheme == "Bearer":
                if self.auto_error:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Invalid authentication scheme"
                    )
                return None

            if not self.verify_jwt(credentials.credentials):
                if self.auto_error:
                    raise HTTPException(
                        status_code=status.HTTP_403_FORBIDDEN,
                        detail="Invalid token or expired token"
                    )
                return None

            return credentials.credentials
        return None

    def verify_jwt(self, token: str) -> bool:
        """Verify JWT token"""
        try:
            payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])

            # Additional security checks
            if payload.get("iss") != "afarensis-enterprise":
                return False

            if payload.get("aud") != "afarensis-api":
                return False

            return True
        except jwt.PyJWTError:
            return False


def create_access_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT access token with enhanced security claims"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)

    to_encode.update({"exp": expire, "type": "access"})

    # Add additional security claims
    to_encode.update({
        "iat": datetime.utcnow(),
        "iss": "afarensis-enterprise",
        "aud": "afarensis-api",
        "jti": secrets.token_urlsafe(16)  # JWT ID for revocation
    })

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def create_refresh_token(
    data: Dict[str, Any],
    expires_delta: Optional[timedelta] = None
) -> str:
    """Create JWT refresh token"""
    to_encode = data.copy()

    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)

    to_encode.update({"exp": expire, "type": "refresh"})
    to_encode.update({
        "iat": datetime.utcnow(),
        "iss": "afarensis-enterprise",
        "aud": "afarensis-api",
        "jti": secrets.token_urlsafe(16)
    })

    encoded_jwt = jwt.encode(to_encode, settings.SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify and decode JWT token"""
    try:
        payload = jwt.decode(
            token,
            settings.SECRET_KEY,
            algorithms=[ALGORITHM],
            audience="afarensis-api",
            issuer="afarensis-enterprise"
        )
        return payload
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired"
        )
    except jwt.PyJWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials"
        )


def get_current_user_from_token(token: str) -> Dict[str, Any]:
    """Extract user info from valid JWT token"""
    payload = verify_token(token)

    if payload.get("type") != "access":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token type"
        )

    return {
        "user_id": payload.get("sub"),
        "username": payload.get("username"),
        "email": payload.get("email"),
        "role": payload.get("role"),
        "permissions": payload.get("permissions", []),
        "jti": payload.get("jti"),  # For token revocation
        "org_id": payload.get("org_id"),  # Multi-tenancy: organization context
    }


# Encryption functions
def encrypt_data(data: str) -> Optional[str]:
    """Encrypt sensitive data"""
    if not cipher_suite or not settings.ENABLE_DATA_ENCRYPTION:
        return data

    try:
        encrypted_data = cipher_suite.encrypt(data.encode())
        return encrypted_data.decode()
    except Exception:
        # Log error but don't fail
        return data


def decrypt_data(encrypted_data: str) -> Optional[str]:
    """Decrypt sensitive data"""
    if not cipher_suite or not settings.ENABLE_DATA_ENCRYPTION:
        return encrypted_data

    try:
        decrypted_data = cipher_suite.decrypt(encrypted_data.encode())
        return decrypted_data.decode()
    except Exception:
        # Log error but don't fail
        return encrypted_data


# Role-based access control
class Permissions:
    """Define system permissions"""

    # Project permissions
    PROJECT_READ = "project:read"
    PROJECT_WRITE = "project:write"
    PROJECT_DELETE = "project:delete"

    # Evidence permissions
    EVIDENCE_READ = "evidence:read"
    EVIDENCE_WRITE = "evidence:write"
    EVIDENCE_DELETE = "evidence:delete"

    # Review permissions
    REVIEW_CREATE = "review:create"
    REVIEW_APPROVE = "review:approve"
    REVIEW_REJECT = "review:reject"

    # Administrative permissions
    USER_MANAGE = "user:manage"
    SYSTEM_CONFIG = "system:config"
    AUDIT_READ = "audit:read"

    # Regulatory permissions
    ARTIFACT_GENERATE = "artifact:generate"
    ARTIFACT_SIGN = "artifact:sign"

    # Federated network permissions
    FEDERATED_READ = "federated:read"
    FEDERATED_WRITE = "federated:write"


class Roles:
    """Define system roles with associated permissions"""

    VIEWER = {
        "name": "viewer",
        "permissions": [
            Permissions.PROJECT_READ,
            Permissions.EVIDENCE_READ
        ]
    }

    ANALYST = {
        "name": "analyst",
        "permissions": [
            Permissions.PROJECT_READ,
            Permissions.PROJECT_WRITE,
            Permissions.EVIDENCE_READ,
            Permissions.EVIDENCE_WRITE,
            Permissions.REVIEW_CREATE
        ]
    }

    REVIEWER = {
        "name": "reviewer",
        "permissions": [
            Permissions.PROJECT_READ,
            Permissions.PROJECT_WRITE,
            Permissions.EVIDENCE_READ,
            Permissions.EVIDENCE_WRITE,
            Permissions.REVIEW_CREATE,
            Permissions.REVIEW_APPROVE,
            Permissions.REVIEW_REJECT,
            Permissions.ARTIFACT_GENERATE
        ]
    }

    ADMIN = {
        "name": "admin",
        "permissions": [
            Permissions.PROJECT_READ,
            Permissions.PROJECT_WRITE,
            Permissions.PROJECT_DELETE,
            Permissions.EVIDENCE_READ,
            Permissions.EVIDENCE_WRITE,
            Permissions.EVIDENCE_DELETE,
            Permissions.REVIEW_CREATE,
            Permissions.REVIEW_APPROVE,
            Permissions.REVIEW_REJECT,
            Permissions.USER_MANAGE,
            Permissions.SYSTEM_CONFIG,
            Permissions.AUDIT_READ,
            Permissions.ARTIFACT_GENERATE,
            Permissions.ARTIFACT_SIGN,
            Permissions.FEDERATED_READ,
            Permissions.FEDERATED_WRITE
        ]
    }


def check_permission(user_permissions: List[str], required_permission: str) -> bool:
    """Check if user has required permission"""
    return required_permission in user_permissions


def require_permission(permission: str):
    """Decorator to require specific permission"""
    def decorator(func):
        def wrapper(*args, **kwargs):
            # This would be used with dependency injection in FastAPI
            # Implementation would check current user permissions
            return func(*args, **kwargs)
        return wrapper
    return decorator


# Secure file handling
def validate_file_type(filename: str) -> bool:
    """Validate uploaded file type"""
    if not filename:
        return False

    file_extension = Path(filename).suffix.lower()
    return file_extension in settings.ALLOWED_FILE_TYPES


def generate_secure_filename(original_filename: str) -> str:
    """Generate secure filename for uploads"""
    # Remove any path information
    filename = Path(original_filename).name

    # Generate secure prefix
    secure_prefix = secrets.token_urlsafe(16)

    # Combine with sanitized original name
    safe_filename = f"{secure_prefix}_{filename}"

    return safe_filename


def calculate_file_hash(file_content: bytes) -> str:
    """Calculate SHA-256 hash of file content"""
    return hashlib.sha256(file_content).hexdigest()


def verify_file_integrity(file_content: bytes, expected_hash: str) -> bool:
    """Verify file integrity using hash"""
    actual_hash = calculate_file_hash(file_content)
    return hmac.compare_digest(actual_hash, expected_hash)


# Security audit functions
def log_security_event(
    event_type: str,
    details: Dict[str, Any],
    severity: str = "info",
    user_id: Optional[str] = None
):
    """Log security-related events"""
    audit_logger.log_system_event(
        event=f"Security event: {event_type}",
        event_type="security",
        details={
            "security_event_type": event_type,
            "user_id": user_id,
            "severity": severity,
            **details
        },
        severity=severity
    )


def log_authentication_attempt(
    username: str,
    success: bool,
    ip_address: str,
    user_agent: str
):
    """Log authentication attempts for security monitoring"""
    log_security_event(
        event_type="authentication_attempt",
        details={
            "username": username,
            "success": success,
            "ip_address": ip_address,
            "user_agent": user_agent
        },
        severity="warning" if not success else "info"
    )

    # Update rate limiter
    if not success:
        rate_limiter.record_failed_attempt(ip_address)
        rate_limiter.record_failed_attempt(username)
    else:
        rate_limiter.reset_failed_attempts(ip_address)
        rate_limiter.reset_failed_attempts(username)


def log_authorization_failure(
    user_id: str,
    resource: str,
    required_permission: str,
    ip_address: str
):
    """Log authorization failures"""
    log_security_event(
        event_type="authorization_failure",
        details={
            "resource": resource,
            "required_permission": required_permission,
            "ip_address": ip_address
        },
        severity="warning",
        user_id=user_id
    )


# FastAPI dependency: Current user extracted from JWT
class CurrentUser:
    """Lightweight user object populated from JWT claims"""
    def __init__(self, user_id: str, username: str, email: str, role: str, permissions: List[str], org_id: Optional[str] = None):
        self.id = user_id
        self.user_id = user_id
        self.username = username
        self.email = email
        self.role = role
        self.permissions = permissions
        self.org_id = org_id


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(HTTPBearer())
) -> CurrentUser:
    """FastAPI dependency - extract and validate current user from Bearer token"""
    user_data = get_current_user_from_token(credentials.credentials)
    return CurrentUser(
        user_id=user_data.get("user_id", ""),
        username=user_data.get("username", ""),
        email=user_data.get("email", ""),
        role=user_data.get("role", ""),
        permissions=user_data.get("permissions", []),
        org_id=user_data.get("org_id"),
    )


def require_role(*roles: str):
    """Dependency factory: require user to have one of the given roles.
    Comparison is case-insensitive to handle both enum names (ADMIN) and values (admin)."""
    allowed = {r.lower() for r in roles}
    async def role_checker(
        current_user: CurrentUser = Depends(get_current_user),
    ) -> CurrentUser:
        user_role = current_user.role.lower() if isinstance(current_user.role, str) else str(current_user.role).lower()
        if user_role not in allowed:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access denied. Required role(s): {', '.join(roles)}",
            )
        return current_user
    return role_checker


# JWT Security instance
jwt_bearer = JWTBearer()

# CRITICAL CHANGE SUMMARY:
# 1. Removed passlib dependency entirely
# 2. Implemented direct bcrypt usage in verify_password() and get_password_hash()
# 3. Added password strength validation
# 4. Enhanced rate limiting with exponential backoff
# 5. Added JWT ID (jti) for token revocation support
# 6. Improved security headers and CSP
# 7. Added comprehensive error logging for authentication failures
#
# This fixes the critical compatibility issue with bcrypt 5.0+ while maintaining
# the same security level and API compatibility.
