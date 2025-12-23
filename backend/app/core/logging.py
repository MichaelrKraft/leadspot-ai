"""
Structured logging configuration with JSON formatting and sensitive data masking.
"""
import json
import logging
import re
import sys
from contextvars import ContextVar
from datetime import datetime
from typing import Any

# Context variable for request ID
request_id_ctx: ContextVar[str | None] = ContextVar('request_id', default=None)
user_id_ctx: ContextVar[str | None] = ContextVar('user_id', default=None)

# Sensitive data patterns to mask
SENSITIVE_PATTERNS = [
    (re.compile(r'"password"\s*:\s*"[^"]*"'), '"password": "***"'),
    (re.compile(r'"api_key"\s*:\s*"[^"]*"'), '"api_key": "***"'),
    (re.compile(r'"token"\s*:\s*"[^"]*"'), '"token": "***"'),
    (re.compile(r'"secret"\s*:\s*"[^"]*"'), '"secret": "***"'),
    (re.compile(r'"authorization"\s*:\s*"[^"]*"'), '"authorization": "***"'),
]


class SensitiveDataFilter(logging.Filter):
    """Filter to mask sensitive data in log messages."""

    def filter(self, record: logging.LogRecord) -> bool:
        if hasattr(record, 'msg') and isinstance(record.msg, str):
            for pattern, replacement in SENSITIVE_PATTERNS:
                record.msg = pattern.sub(replacement, record.msg)
        return True


class JSONFormatter(logging.Formatter):
    """Custom JSON formatter for structured logging."""

    def format(self, record: logging.LogRecord) -> str:
        log_data: dict[str, Any] = {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'level': record.levelname,
            'logger': record.name,
            'message': record.getMessage(),
        }

        # Add request ID if available
        request_id = request_id_ctx.get()
        if request_id:
            log_data['request_id'] = request_id

        # Add user ID if available
        user_id = user_id_ctx.get()
        if user_id:
            log_data['user_id'] = user_id

        # Add exception info if present
        if record.exc_info:
            log_data['exception'] = self.formatException(record.exc_info)

        # Add extra fields
        if hasattr(record, 'extra_fields'):
            log_data.update(record.extra_fields)

        # Add standard fields
        log_data.update({
            'module': record.module,
            'function': record.funcName,
            'line': record.lineno,
        })

        return json.dumps(log_data)


def setup_logging(log_level: str = "INFO") -> None:
    """
    Configure structured logging for the application.

    Args:
        log_level: Logging level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
    """
    # Get root logger
    root_logger = logging.getLogger()
    root_logger.setLevel(log_level)

    # Remove existing handlers
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create console handler with JSON formatter
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(JSONFormatter())
    console_handler.addFilter(SensitiveDataFilter())

    root_logger.addHandler(console_handler)

    # Set specific log levels for noisy libraries
    logging.getLogger('uvicorn.access').setLevel(logging.WARNING)
    logging.getLogger('httpx').setLevel(logging.WARNING)
    logging.getLogger('urllib3').setLevel(logging.WARNING)


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger instance with the specified name.

    Args:
        name: Logger name (typically __name__)

    Returns:
        Configured logger instance
    """
    return logging.getLogger(name)


def set_request_context(request_id: str | None = None, user_id: str | None = None) -> None:
    """
    Set request context for logging.

    Args:
        request_id: Unique request identifier
        user_id: User identifier
    """
    if request_id:
        request_id_ctx.set(request_id)
    if user_id:
        user_id_ctx.set(user_id)


def clear_request_context() -> None:
    """Clear request context."""
    request_id_ctx.set(None)
    user_id_ctx.set(None)


def log_with_context(
    logger: logging.Logger,
    level: int,
    message: str,
    **extra_fields: Any
) -> None:
    """
    Log a message with additional context fields.

    Args:
        logger: Logger instance
        level: Log level
        message: Log message
        **extra_fields: Additional fields to include in log
    """
    record = logger.makeRecord(
        logger.name,
        level,
        "(unknown file)",
        0,
        message,
        (),
        None
    )
    record.extra_fields = extra_fields
    logger.handle(record)
