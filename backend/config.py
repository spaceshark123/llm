"""
Centralized configuration management for the LLM Chat application.

All configuration values are loaded from environment variables with sensible defaults.
"""

import os
from typing import Dict, Any
from dotenv import load_dotenv

# Load environment variables
load_dotenv()


class Config:
    """Application configuration class."""
    
    # ============ API Configuration ============
    BACKEND_PORT: int = int(os.getenv('BACKEND_PORT', '5050'))
    DEBUG: bool = os.getenv('FLASK_ENV', 'production') == 'development'
    
    # ============ LLM Configuration ============
    GROQ_API_KEY: str = os.getenv('GROQ_API_KEY', '')
    if not GROQ_API_KEY:
        raise ValueError('GROQ_API_KEY environment variable is required')
    
    MODEL_NAME: str = os.getenv('MODEL_NAME', 'llama-3.1-8b-instant')
    TEMPERATURE: float = float(os.getenv('TEMPERATURE', '0.7'))
    
    # Validate temperature range
    if not 0 <= TEMPERATURE <= 2:
        raise ValueError(f'TEMPERATURE must be between 0 and 2, got {TEMPERATURE}')
    
    # ============ RAG Configuration ============
    RAG_ENABLED: bool = os.getenv('RAG_ENABLED', 'true').lower() == 'true'
    RAG_TOP_K: int = int(os.getenv('RAG_TOP_K', '5'))
    
    # Validate RAG_TOP_K
    if RAG_TOP_K < 1:
        raise ValueError(f'RAG_TOP_K must be at least 1, got {RAG_TOP_K}')
    
    # ============ Chunking Configuration ============
    CHUNK_SIZE: int = int(os.getenv('CHUNK_SIZE', '300'))
    CHUNK_OVERLAP: int = int(os.getenv('CHUNK_OVERLAP', '100'))
    
    # Validate chunk configuration
    if CHUNK_SIZE < 50:
        raise ValueError(f'CHUNK_SIZE must be at least 50, got {CHUNK_SIZE}')
    if CHUNK_OVERLAP >= CHUNK_SIZE:
        raise ValueError(f'CHUNK_OVERLAP must be less than CHUNK_SIZE')
    
    # ============ Embedding Configuration ============
    EMBEDDING_MODEL: str = os.getenv('EMBEDDING_MODEL', 'all-mpnet-base-v2')
    EMBEDDING_DEVICE: str = os.getenv('EMBEDDING_DEVICE', 'cpu')
    
    # ============ Path Configuration ============
    DATA_PATH: str = os.getenv('DATA_PATH', 'data')
    TEMP_PATH: str = os.getenv('TEMP_PATH', 'temp')
    CHROMA_PATH: str = os.getenv('CHROMA_PATH', 'chroma')
    LOG_DIR: str = os.getenv('LOG_DIR', 'logs')
    
    # Create directories if they don't exist
    for path in [DATA_PATH, TEMP_PATH, CHROMA_PATH, LOG_DIR]:
        os.makedirs(path, exist_ok=True)
    
    # ============ OCR Configuration ============
    OCR_CONFIDENCE_THRESHOLD: float = float(os.getenv('OCR_CONFIDENCE_THRESHOLD', '0.3'))
    OCR_LANGUAGES: str = os.getenv('OCR_LANGUAGES', 'en')
    
    # ============ Request Configuration ============
    MAX_FILE_SIZE_MB: int = int(os.getenv('MAX_FILE_SIZE_MB', '50'))
    MAX_URL_LENGTH: int = int(os.getenv('MAX_URL_LENGTH', '2048'))
    REQUEST_TIMEOUT_SECONDS: int = int(os.getenv('REQUEST_TIMEOUT_SECONDS', '30'))
    
    # ============ Frontend Configuration ============
    VITE_API_URL: str = os.getenv('VITE_API_URL', 'http://localhost:5050/api')
    
    # ============ CORS Configuration ============
    CORS_ORIGINS: str = os.getenv('CORS_ORIGINS', '*')
    
    @classmethod
    def to_dict(cls) -> Dict[str, Any]:
        """Convert configuration to dictionary (excludes sensitive keys)."""
        excluded_keys = {'GROQ_API_KEY'}
        return {
            key: getattr(cls, key)
            for key in dir(cls)
            if not key.startswith('_') and key.isupper() and key not in excluded_keys
        }
    
    @classmethod
    def validate(cls) -> None:
        """Validate all configuration values."""
        # Check required API key
        if not cls.GROQ_API_KEY:
            raise ValueError('GROQ_API_KEY is required')
        
        # Check paths are writable
        for path in [cls.DATA_PATH, cls.TEMP_PATH, cls.CHROMA_PATH, cls.LOG_DIR]:
            if not os.access(path, os.W_OK):
                raise ValueError(f'Directory {path} is not writable')
        
        # Check numeric ranges
        assert 0 <= cls.TEMPERATURE <= 2, 'TEMPERATURE out of range'
        assert 0 < cls.OCR_CONFIDENCE_THRESHOLD < 1, 'OCR_CONFIDENCE_THRESHOLD out of range'
        assert cls.CHUNK_SIZE > 0, 'CHUNK_SIZE must be positive'
        assert cls.CHUNK_OVERLAP >= 0, 'CHUNK_OVERLAP must be non-negative'
        assert cls.RAG_TOP_K > 0, 'RAG_TOP_K must be positive'


# System prompts
SYSTEM_PROMPT: str = """You are a helpful and knowledgeable AI assistant. Respond in markdown.

When provided with context from documents, use that information to answer questions accurately.
If the context doesn't contain relevant information, say so and answer based on your general knowledge."""


# Error messages
ERROR_MESSAGES: Dict[str, str] = {
    'no_input': 'Input is required',
    'no_session': 'Session-ID header is required',
    'no_file': 'No file part in the request',
    'no_filename': 'No selected file',
    'unsupported_format': 'Unsupported file format: {format}',
    'input_too_large': 'The input is too large for the model to process. Please reduce the size of your input.',
    'rate_limited': 'Rate limit exceeded. Please try again later.',
    'invalid_url': 'Invalid URL format',
    'no_url': 'URL is required',
    'extraction_failed': 'Failed to process URL: {error}',
}


# Supported file formats
SUPPORTED_FORMATS: Dict[str, list] = {
    'document': ['pdf', 'docx', 'doc'],
    'image': ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff'],
}


# HTTP status codes
HTTP_CODES = {
    'ok': 200,
    'bad_request': 400,
    'not_found': 404,
    'unsupported_media_type': 415,
    'payload_too_large': 413,
    'too_many_requests': 429,
    'internal_error': 500,
}


# Feature flags
FEATURES = {
    'rag': Config.RAG_ENABLED,
    'ocr': True,
    'web_extraction': True,
    'pdf_extraction': True,
    'docx_extraction': True,
}


if __name__ == '__main__':
    # Print configuration (excluding sensitive info)
    print('Configuration:')
    for key, value in sorted(Config.to_dict().items()):
        print(f'  {key}: {value}')
