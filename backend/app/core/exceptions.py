"""
Afarensis Enterprise Exception Handling

Centralized exception handling with proper HTTP status codes,
structured error responses, and regulatory compliance logging.
"""

import logging
from typing import Dict, Any, Optional, Union
from fastapi import HTTPException, Request, status
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from starlette.exceptions import HTTPException as StarletteHTTPException
import traceback

from app.core.logging import audit_logger, get_correlation_id


logger = logging.getLogger(__name__)


class AfarensisException(Exception):
    """Base exception for Afarensis-specific errors"""
    
    def __init__(
        self, 
        message: str, 
        error_code: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None
    ):
        self.message = message
        self.error_code = error_code or self.__class__.__name__
        self.details = details or {}
        super().__init__(self.message)


class ValidationError(AfarensisException):
    """Data validation errors"""
    pass


class AuthenticationError(AfarensisException):
    """Authentication failures"""
    pass


class AuthorizationError(AfarensisException):
    """Authorization/permission failures"""
    pass


class ResourceNotFoundError(AfarensisException):
    """Resource not found errors"""
    pass


class ResourceConflictError(AfarensisException):
    """Resource conflict errors (e.g., duplicate creation)"""
    pass


class ExternalServiceError(AfarensisException):
    """External service integration errors"""
    pass


class ProcessingError(AfarensisException):
    """Evidence processing errors"""
    pass


class RegulatoryComplianceError(AfarensisException):
    """Regulatory compliance violations"""
    pass


class DataIntegrityError(AfarensisException):
    """Data integrity violations"""
    pass


class SystemConfigurationError(AfarensisException):
    """System configuration errors"""
    pass


class RateLimitExceededError(AfarensisException):
    """Rate limit exceeded errors"""
    pass


class FileProcessingError(AfarensisException):
    """File processing and upload errors"""
    pass


class NetworkError(AfarensisException):
    """Network connectivity errors"""
    pass


class SecurityError(AfarensisException):
    """Security-related errors"""
    pass


# HTTP Exception mapping
EXCEPTION_STATUS_MAP = {
    ValidationError: status.HTTP_422_UNPROCESSABLE_ENTITY,
    AuthenticationError: status.HTTP_401_UNAUTHORIZED,
    AuthorizationError: status.HTTP_403_FORBIDDEN,
    ResourceNotFoundError: status.HTTP_404_NOT_FOUND,
    ResourceConflictError: status.HTTP_409_CONFLICT,
    ExternalServiceError: status.HTTP_502_BAD_GATEWAY,
    ProcessingError: status.HTTP_422_UNPROCESSABLE_ENTITY,
    RegulatoryComplianceError: status.HTTP_422_UNPROCESSABLE_ENTITY,
    DataIntegrityError: status.HTTP_422_UNPROCESSABLE_ENTITY,
    SystemConfigurationError: status.HTTP_500_INTERNAL_SERVER_ERROR,
    RateLimitExceededError: status.HTTP_429_TOO_MANY_REQUESTS,
    FileProcessingError: status.HTTP_422_UNPROCESSABLE_ENTITY,
    NetworkError: status.HTTP_503_SERVICE_UNAVAILABLE,
}


def create_error_response(
    error: Union[Exception, AfarensisException],
    status_code: int,
    request: Optional[Request] = None
) -> Dict[str, Any]:
    """Create standardized error response"""
    
    correlation_id = get_correlation_id()
    
    # Base error response — use .detail for HTTPException, str() otherwise
    message = getattr(error, 'detail', None) or str(error)
    error_response = {
        "error": {
            "type": error.__class__.__name__,
            "message": message,
            "correlation_id": correlation_id,
            "timestamp": None  # Will be set by JSON encoder
        },
        # Also set top-level "detail" for compatibility with clients that expect it
        "detail": message,
    }
    
    # Add additional details for Afarensis exceptions
    if isinstance(error, AfarensisException):
        error_response["error"]["code"] = error.error_code
        if error.details:
            error_response["error"]["details"] = error.details
    
    # Add request context if available
    if request:
        error_response["error"]["request"] = {
            "method": request.method,
            "url": str(request.url).split('?')[0],
            "user_agent": request.headers.get("User-Agent"),
        }
    
    # Log error for monitoring
    logger.error(
        f"Request error: {error.__class__.__name__}: {str(error)}",
        extra={
            "error_type": error.__class__.__name__,
            "status_code": status_code,
            "correlation_id": correlation_id,
            "request_url": str(request.url) if request else None,
            "request_method": request.method if request else None,
        },
        exc_info=True if not isinstance(error, AfarensisException) else False
    )
    
    return error_response


async def afarensis_exception_handler(
    request: Request, 
    exc: AfarensisException
) -> JSONResponse:
    """Handle Afarensis-specific exceptions"""
    
    status_code = EXCEPTION_STATUS_MAP.get(type(exc), status.HTTP_500_INTERNAL_SERVER_ERROR)
    error_response = create_error_response(exc, status_code, request)
    
    # Log regulatory compliance violations with high severity
    if isinstance(exc, RegulatoryComplianceError):
        audit_logger.log_system_event(
            event="Regulatory compliance violation",
            event_type="compliance",
            details={
                "violation_type": exc.error_code,
                "message": exc.message,
                "details": exc.details,
                "request_url": str(request.url),
            },
            severity="error"
        )
    
    # Log authorization failures for security monitoring
    elif isinstance(exc, (AuthenticationError, AuthorizationError)):
        audit_logger.log_system_event(
            event="Security violation",
            event_type="security",
            details={
                "security_event": exc.error_code,
                "message": exc.message,
                "ip_address": request.client.host if request.client else "unknown",
                "user_agent": request.headers.get("User-Agent"),
            },
            severity="warning"
        )
    
    return JSONResponse(
        status_code=status_code,
        content=error_response,
        headers={
            "X-Error-Type": exc.__class__.__name__,
            "X-Correlation-ID": get_correlation_id(),
        }
    )


async def http_exception_handler(
    request: Request, 
    exc: StarletteHTTPException
) -> JSONResponse:
    """Handle standard HTTP exceptions"""
    
    error_response = create_error_response(exc, exc.status_code, request)
    
    return JSONResponse(
        status_code=exc.status_code,
        content=error_response,
        headers={
            "X-Error-Type": "HTTPException",
            "X-Correlation-ID": get_correlation_id(),
        }
    )


async def validation_exception_handler(
    request: Request, 
    exc: RequestValidationError
) -> JSONResponse:
    """Handle request validation errors"""
    
    # Extract validation details
    validation_details = []
    for error in exc.errors():
        validation_details.append({
            "field": ".".join(str(loc) for loc in error["loc"]),
            "message": error["msg"],
            "type": error["type"],
            "input": error.get("input")
        })
    
    validation_error = ValidationError(
        message="Request validation failed",
        error_code="VALIDATION_ERROR",
        details={"validation_errors": validation_details}
    )
    
    error_response = create_error_response(
        validation_error, 
        status.HTTP_422_UNPROCESSABLE_ENTITY, 
        request
    )
    
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=error_response,
        headers={
            "X-Error-Type": "ValidationError",
            "X-Correlation-ID": get_correlation_id(),
        }
    )


async def general_exception_handler(
    request: Request, 
    exc: Exception
) -> JSONResponse:
    """Handle unexpected exceptions"""
    
    # Log full traceback for debugging
    logger.error(
        f"Unhandled exception: {exc.__class__.__name__}: {str(exc)}",
        extra={
            "correlation_id": get_correlation_id(),
            "request_url": str(request.url),
            "request_method": request.method,
            "traceback": traceback.format_exc(),
        },
        exc_info=True
    )
    
    # Log security event for potential attacks
    audit_logger.log_system_event(
        event="Unhandled exception",
        event_type="error",
        details={
            "exception_type": exc.__class__.__name__,
            "request_url": str(request.url),
            "request_method": request.method,
            "ip_address": request.client.host if request.client else "unknown",
        },
        severity="error"
    )
    
    # Create generic error response (don't expose internal details)
    error_response = {
        "error": {
            "type": "InternalServerError",
            "message": "An internal server error occurred",
            "correlation_id": get_correlation_id(),
            "code": "INTERNAL_SERVER_ERROR"
        }
    }
    
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content=error_response,
        headers={
            "X-Error-Type": "InternalServerError", 
            "X-Correlation-ID": get_correlation_id(),
        }
    )


def setup_exception_handlers(app):
    """Setup all exception handlers for the FastAPI app"""
    
    # Afarensis-specific exceptions
    app.add_exception_handler(AfarensisException, afarensis_exception_handler)
    
    # Standard HTTP exceptions
    app.add_exception_handler(StarletteHTTPException, http_exception_handler)
    
    # Validation exceptions
    app.add_exception_handler(RequestValidationError, validation_exception_handler)
    
    # Catch-all for unexpected exceptions
    app.add_exception_handler(Exception, general_exception_handler)
    
    logger.info("[INIT] Exception handlers configured")


# Convenience functions for raising common exceptions
def raise_not_found(resource: str, identifier: str = None):
    """Raise a resource not found error"""
    message = f"{resource} not found"
    if identifier:
        message += f" (ID: {identifier})"
    
    raise ResourceNotFoundError(
        message=message,
        error_code="RESOURCE_NOT_FOUND",
        details={"resource": resource, "identifier": identifier}
    )


def raise_validation_error(field: str, message: str, value: Any = None):
    """Raise a validation error for a specific field"""
    raise ValidationError(
        message=f"Validation error for field '{field}': {message}",
        error_code="FIELD_VALIDATION_ERROR",
        details={"field": field, "value": value, "validation_message": message}
    )


def raise_authorization_error(resource: str, permission: str):
    """Raise an authorization error"""
    raise AuthorizationError(
        message=f"Insufficient permissions to access {resource}",
        error_code="INSUFFICIENT_PERMISSIONS",
        details={"resource": resource, "required_permission": permission}
    )


def raise_rate_limit_error(limit: int, window: str):
    """Raise a rate limit exceeded error"""
    raise RateLimitExceededError(
        message=f"Rate limit exceeded: {limit} requests per {window}",
        error_code="RATE_LIMIT_EXCEEDED",
        details={"limit": limit, "window": window}
    )


def raise_external_service_error(service: str, error_details: str):
    """Raise an external service error"""
    raise ExternalServiceError(
        message=f"External service error: {service}",
        error_code="EXTERNAL_SERVICE_ERROR",
        details={"service": service, "error": error_details}
    )


def raise_processing_error(operation: str, details: Dict[str, Any] = None):
    """Raise a processing error"""
    raise ProcessingError(
        message=f"Processing error during {operation}",
        error_code="PROCESSING_ERROR",
        details={"operation": operation, **(details or {})}
    )
