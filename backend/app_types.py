"""
Type definitions and data classes for the LLM Chat application.
"""

from dataclasses import dataclass
from typing import List, Dict, Any, Optional
from datetime import datetime


@dataclass
class SourceMetadata:
    """Metadata for a retrieved document source."""
    name: str
    path: str
    score: float


@dataclass
class FileMetadata:
    """Metadata for uploaded file."""
    name: str
    size: int


@dataclass
class ChatMessage:
    """Represents a chat message with metadata."""
    id: str
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime
    originalInput: Optional[str] = None
    sources: Optional[List[str]] = None
    fileMetadata: Optional[List[FileMetadata]] = None
    urls: Optional[List[str]] = None
    truncatedContent: Optional[str] = None
    isStreaming: bool = False


@dataclass
class RetrievalResult:
    """Result from vector store retrieval."""
    context: str
    sources: List[SourceMetadata]


@dataclass
class ExtractionResult:
    """Result from document extraction."""
    text: str
    format: str
    source_name: str
    metadata: Dict[str, Any]


@dataclass
class URLExtractionResult:
    """Result from URL extraction."""
    url: str
    text: str
    method: str  # "selenium" or "beautifulsoup"
    metadata: Dict[str, Any]


@dataclass
class ChunkInfo:
    """Information about a text chunk."""
    content: str
    source: str
    start_index: int
    metadata: Dict[str, Any]


# Type aliases for clarity
SessionID = str
MessageIndex = int
DocumentPath = str
VectorDB = Any  # Chroma DB type
Embedding = Any  # HuggingFaceEmbeddings type
