"""
Logging configuration module for the LLM Chat application.

Provides structured logging with multiple handlers (console, file, rotating file).
"""

import logging
import logging.handlers
import os
from typing import Optional
from datetime import datetime

# Log levels
DEBUG = logging.DEBUG
INFO = logging.INFO
WARNING = logging.WARNING
ERROR = logging.ERROR
CRITICAL = logging.CRITICAL


class LogConfig:
    """Configuration for application logging."""
    
    # Log directory
    LOG_DIR = os.getenv('LOG_DIR', 'logs')
    
    # Log levels
    CONSOLE_LEVEL = os.getenv('CONSOLE_LOG_LEVEL', 'INFO')
    FILE_LEVEL = os.getenv('FILE_LOG_LEVEL', 'DEBUG')
    
    # Log formats
    SIMPLE_FORMAT = '%(name)s - %(levelname)s - %(message)s'
    DETAILED_FORMAT = '%(asctime)s - %(name)s - %(levelname)s - [%(filename)s:%(lineno)d] - %(message)s'
    
    # File logging
    MAX_BYTES = 10 * 1024 * 1024  # 10MB
    BACKUP_COUNT = 5


def setup_logging(name: str, level: int = logging.INFO) -> logging.Logger:
    """Set up and return a configured logger.
    
    Args:
        name: Logger name (typically __name__)
        level: Logging level
        
    Returns:
        Configured logger instance
    """
    logger = logging.getLogger(name)
    logger.setLevel(level)
    
    # Skip if already configured
    if logger.handlers:
        return logger
    
    # Create logs directory if it doesn't exist
    os.makedirs(LogConfig.LOG_DIR, exist_ok=True)
    
    # Console handler
    console_handler = logging.StreamHandler()
    console_handler.setLevel(getattr(logging, LogConfig.CONSOLE_LEVEL))
    console_formatter = logging.Formatter(LogConfig.SIMPLE_FORMAT)
    console_handler.setFormatter(console_formatter)
    logger.addHandler(console_handler)
    
    # File handler (rotating)
    try:
        log_file = os.path.join(LogConfig.LOG_DIR, f"{name}.log")
        file_handler = logging.handlers.RotatingFileHandler(
            log_file,
            maxBytes=LogConfig.MAX_BYTES,
            backupCount=LogConfig.BACKUP_COUNT
        )
        file_handler.setLevel(getattr(logging, LogConfig.FILE_LEVEL))
        file_formatter = logging.Formatter(LogConfig.DETAILED_FORMAT)
        file_handler.setFormatter(file_formatter)
        logger.addHandler(file_handler)
    except Exception as e:
        # Fail gracefully if file handler can't be set up
        logger.warning(f"Could not set up file logging: {e}")
    
    return logger


def get_logger(name: str) -> logging.Logger:
    """Get or create a logger by name."""
    return logging.getLogger(name)


# Application-level loggers
app_logger = setup_logging('llm_app')
extraction_logger = setup_logging('llm_extraction')
rag_logger = setup_logging('llm_rag')
chat_logger = setup_logging('llm_chat')
database_logger = setup_logging('llm_database')


if __name__ == '__main__':
    # Test logging
    logger = setup_logging('test')
    logger.debug('Debug message')
    logger.info('Info message')
    logger.warning('Warning message')
    logger.error('Error message')
    logger.critical('Critical message')
