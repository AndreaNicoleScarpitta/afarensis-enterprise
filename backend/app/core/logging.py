"""
Afarensis Enterprise Logging Configuration

Structured logging setup with regulatory compliance features.
Supports JSON formatting, correlation IDs, and audit trail requirements.
"""

import logging
import logging.config
import sys
import json
from typing import Dict, Any, Optional
from datetime import datetime
import uuid
from contextvars import ContextVar
from pathlib import Path

from app.core.config import settings


# Context variables for request correlation
correlation_id: ContextVar[Optional[str]] = ContextVar('correlation_id', default=None)
user_id: ContextVar[Optional[str]] = ContextVar('user_id', default=None)


class CorrelationFilter(logging.Filter):
    """Add correlation ID and user context to log records"""
    
    def filter(self, record: logging.LogRecord) -> bool:
        record.correlation_id = correlation_id.get()
        record.user_id = user_id.get()
        record.service = "afarensis-enterprise"
        return True


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging"""
    
    def format(self, record: logging.LogRecord) -> str:
        log_entry = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
            "service": getattr(record, 'service', 'afarensis-enterprise'),
            "correlation_id": getattr(record, 'correlation_id', None),
            "user_id": getattr(record, 'user_id', None),
            "module": record.module,
            "function": record.funcName,
            "line": record.lineno,
        }
        
        # Add exception info if present
        if record.exc_info:
            log_entry["exception"] = {
                "type": record.exc_info[0].__name__,
                "message": str(record.exc_info[1]),
                "traceback": self.formatException(record.exc_info)
            }
        
        # Add extra fields from the record
        for key, value in record.__dict__.items():
            if key not in ['name', 'msg', 'args', 'levelname', 'levelno', 'pathname', 
                          'filename', 'module', 'lineno', 'funcName', 'created', 
                          'msecs', 'relativeCreated', 'thread', 'threadName', 
                          'processName', 'process', 'message', 'exc_info', 'exc_text',
                          'stack_info', 'correlation_id', 'user_id', 'service']:
                log_entry[key] = value
        
        return json.dumps(log_entry, default=str)


class AuditLogger:
    """Specialized logger for regulatory audit trails"""
    
    def __init__(self, name: str = "audit"):
        self.logger = logging.getLogger(f"afarensis.audit.{name}")
        self.logger.setLevel(logging.INFO)
        
        # Ensure audit logs always go to file in production
        if settings.is_production and settings.LOG_FILE:
            handler = logging.FileHandler(
                Path(settings.LOG_FILE).parent / "audit.log"
            )
            handler.setFormatter(JSONFormatter())
            handler.addFilter(CorrelationFilter())
            self.logger.addHandler(handler)
    
    def log_user_action(
        self, 
        action: str, 
        resource_type: str, 
        resource_id: Optional[str] = None,
        details: Optional[Dict[str, Any]] = None,
        regulatory_significance: bool = False
    ):
        """Log user action for audit trail"""
        self.logger.info(
            f"User action: {action}",
            extra={
                "audit_type": "user_action",
                "action": action,
                "resource_type": resource_type,
                "resource_id": resource_id,
                "details": details or {},
                "regulatory_significance": regulatory_significance,
                "timestamp_utc": datetime.utcnow().isoformat() + "Z"
            }
        )
    
    def log_system_event(
        self, 
        event: str, 
        event_type: str = "system",
        details: Optional[Dict[str, Any]] = None,
        severity: str = "info"
    ):
        """Log system event"""
        self.logger.log(
            getattr(logging, severity.upper(), logging.INFO),
            f"System event: {event}",
            extra={
                "audit_type": "system_event",
                "event": event,
                "event_type": event_type,
                "details": details or {},
                "timestamp_utc": datetime.utcnow().isoformat() + "Z"
            }
        )
    
    def log_data_access(
        self,
        table: str,
        operation: str,
        record_count: int = 1,
        filters: Optional[Dict[str, Any]] = None
    ):
        """Log data access for compliance"""
        self.logger.info(
            f"Data access: {operation} on {table}",
            extra={
                "audit_type": "data_access",
                "table": table,
                "operation": operation,
                "record_count": record_count,
                "filters": filters or {},
                "timestamp_utc": datetime.utcnow().isoformat() + "Z"
            }
        )


def setup_logging():
    """Configure application logging"""
    
    # Get log level
    log_level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    
    # Choose formatter based on config
    if settings.LOG_FORMAT.lower() == "json":
        formatter_class = JSONFormatter
    else:
        formatter_class = logging.Formatter
        formatter = logging.Formatter(
            fmt='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )
    
    # Configure root logger
    logging.root.setLevel(log_level)
    
    # Clear existing handlers
    for handler in logging.root.handlers[:]:
        logging.root.removeHandler(handler)
    
    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(log_level)
    
    if settings.LOG_FORMAT.lower() == "json":
        console_handler.setFormatter(JSONFormatter())
    else:
        console_handler.setFormatter(formatter)
    
    console_handler.addFilter(CorrelationFilter())
    logging.root.addHandler(console_handler)
    
    # File handler for production
    if settings.LOG_FILE:
        file_handler = logging.FileHandler(settings.LOG_FILE)
        file_handler.setLevel(log_level)
        
        if settings.LOG_FORMAT.lower() == "json":
            file_handler.setFormatter(JSONFormatter())
        else:
            file_handler.setFormatter(formatter)
        
        file_handler.addFilter(CorrelationFilter())
        logging.root.addHandler(file_handler)
    
    # Suppress noisy third-party loggers
    logging.getLogger("uvicorn.access").setLevel(logging.WARNING)
    logging.getLogger("databases").setLevel(logging.WARNING)
    logging.getLogger("asyncpg").setLevel(logging.WARNING)
    
    # Set application logger levels
    logging.getLogger("afarensis").setLevel(log_level)
    
    logger = logging.getLogger(__name__)
    logger.info(f"[INIT] Logging configured - Level: {settings.LOG_LEVEL}, Format: {settings.LOG_FORMAT}")


def get_correlation_id() -> str:
    """Get or create correlation ID for request tracking"""
    current_id = correlation_id.get()
    if current_id is None:
        current_id = str(uuid.uuid4())
        correlation_id.set(current_id)
    return current_id


def set_correlation_id(id_value: str):
    """Set correlation ID for request tracking"""
    correlation_id.set(id_value)


def set_user_context(user_id_value: Optional[str]):
    """Set user context for logging"""
    user_id.set(user_id_value)


# Create global audit logger
audit_logger = AuditLogger()
