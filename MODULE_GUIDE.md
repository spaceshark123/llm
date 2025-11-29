# Backend Module Guide

A detailed guide to each backend module and how they work together.

## Module Overview

```
Backend Architecture (Python/Flask)
└── API Layer (app.py)
    ├── Document Processing Pipeline
    │   └── extractors.py (PDF, DOCX, OCR, URLs)
    ├── Vector Retrieval
    │   ├── chroma.py (Chunking, Embedding, Storage)
    │   └── db.py (Session DB Management)
    ├── LLM Interaction
    │   └── llm.py (Chat, RAG, History)
    └── Supporting
        ├── config.py (Configuration)
        ├── logger.py (Logging)
        ├── app_types.py (Type Definitions)
        ├── history.py (Chat History)
        └── embeddings.py (Embeddings Initialization)
```

## Core Modules

### 1. `app.py` - REST API Server

**Purpose**: Main Flask application serving all endpoints

**Key Components**:
- Flask app initialization with CORS
- Route handlers for `/api/chat`, `/api/sources`, `/api/urls`, `/api/history`, `/api/sessions`
- Document extraction pipeline
- Error handling and response formatting

**Key Functions**:
```python
@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
    """Handle chat requests with RAG context"""
    
@app.route('/api/sources', methods=['POST', 'DELETE', 'GET'])
def source_endpoint():
    """Manage uploaded document files"""
    
@app.route('/api/urls', methods=['POST', 'DELETE', 'GET'])
def url_endpoint():
    """Manage web source URLs"""
    
@app.route('/api/history', methods=['GET', 'DELETE'])
def history_endpoint():
    """Get or clear chat history"""
```

**Dependencies**: Flask, CORS, document extractors, LLM, database

**Environment Setup**:
```python
from extractors import extract_document, extract_url
from llm import chat, get_session_history
from db import get_session_db
```

---

### 2. `extractors.py` - Document Text Extraction

**Purpose**: Modular document processing with graceful fallbacks

**Architecture**: Factory pattern with pluggable extractors

**Supported Formats**:
- **PDF** (`PDFExtractor`): Text extraction + OCR for scanned pages
- **DOCX/DOC** (`DOCXExtractor`): Paragraphs, tables, headers, footers
- **Images** (`ImageExtractor`): PNG, JPG, GIF, BMP, TIFF with EasyOCR
- **URLs** (`URLExtractor`): Screenshot + OCR or HTML parsing

**Key Classes**:

```python
class DocumentExtractor(ABC):
    """Abstract base class for all extractors"""
    @abstractmethod
    def can_extract(self, filename: str) -> bool: pass
    @abstractmethod
    def extract(self, file_obj) -> str: pass

class PDFExtractor(DocumentExtractor):
    """Handles PDF files with OCR fallback"""
    
class DOCXExtractor(DocumentExtractor):
    """Handles DOCX/DOC files"""
    
class ImageExtractor(DocumentExtractor):
    """Handles images with EasyOCR"""
    
class URLExtractor(DocumentExtractor):
    """Handles URL content extraction"""

class DocumentExtractorFactory:
    """Factory for selecting appropriate extractor"""
    def extract_document(self, file_obj) -> str
    def extract_url(self, url: str) -> str
```

**Usage**:
```python
from extractors import extract_document, extract_url

# Extract from file
text = extract_document(file_obj)

# Extract from URL
text = extract_url("https://example.com")
```

**Error Handling**:
- Graceful fallbacks for missing libraries
- Confidence-based filtering for OCR results
- User-friendly error messages

**OCR Pipeline** (Image & Scanned PDF):
1. Capture screenshot or extract page image
2. Convert to RGB for compatibility
3. Run EasyOCR with confidence threshold (0.3)
4. Filter low-confidence results
5. Join text with newlines

**Web Extraction Pipeline**:
1. Try Selenium screenshot + OCR (for visual content)
2. Fallback to BeautifulSoup HTML parsing
3. Return best available extraction

---

### 3. `chroma.py` - Vector Database Management

**Purpose**: Document chunking, embedding, and vector storage

**Key Concepts**:

**Chunking Strategy**:
- Size: 300 tokens (optimal balance of context and retrieval precision)
- Overlap: 100 tokens (33% overlap for context continuity)
- Method: RecursiveCharacterTextSplitter
- Splitting order: Paragraph (`\n\n`) → Sentence (`\n`) → Word (` `)

**Rationale**:
- 300 tokens ≈ 200-400 words ≈ small paragraph
- Fits well in LLM context window
- Maintains semantic boundaries
- 33% overlap prevents context breaks across chunks

**Key Functions**:

```python
# Initialization
initialize_embeddings() -> HuggingFaceEmbeddings
get_or_create_db(embeddings, session_id) -> Chroma

# Document Operations
load_all_documents(session_id) -> List[Document]
load_specific_documents(filepaths) -> List[Document]
split_text(documents) -> List[Document]

# Database Management
add_single_document(db, embeddings, filepath, session_id) -> None
add_documents_to_chroma(db, embeddings, chunks) -> None
update_database(db, embeddings, session_id) -> None
rebuild_database(embeddings, session_id) -> None

# Cleanup
remove_documents_by_source(db, source) -> None

# File Change Tracking
get_file_hash(filepath) -> str
load_processed_files(session_id) -> Dict[str, str]
save_processed_files(session_id, processed) -> None
get_new_or_modified_files(session_id, processed_files) -> List[str]
```

**Change Detection**:
- Each document tracked by MD5 hash
- Only changed files re-processed
- Metadata stored in `processed_files.txt`
- Efficient incremental updates

**Example Usage**:
```python
from chroma import get_or_create_db, add_single_document
from embeddings import embeddings

# Get session database
db = get_or_create_db(embeddings, "session-123")

# Add document
add_single_document(db, embeddings, "data/session-123/doc.md", "session-123")
```

---

### 4. `llm.py` - LLM Chat & Context Retrieval

**Purpose**: Orchestrate chat, context retrieval, and conversation history

**Key Concepts**:

**RAG Pipeline**:
1. User sends message
2. Query vector store for top-K most relevant chunks
3. Prepend context to user message
4. Send to LLM with full conversation history
5. Store response with source metadata

**Context Overflow Prevention**:
- Top-K limiting: Retrieve only top 5 documents
- Chunk sizing: 300 tokens prevents individual bloat
- Source filtering: Users select specific sources
- Error handling: 413 errors caught for oversized input

**Key Components**:

```python
def retrieve_context(db: Chroma, query: str, top_k: int, 
                     selected_sources: Optional[List[str]]) 
                     -> Tuple[str, List[SourceMetadata]]:
    """Retrieve relevant context from vector store"""
    
def chat(input_str: str, session_id: str, db: Chroma,
         selected_sources: Optional[List]) -> str:
    """Process message with RAG context and return response"""
    
def get_session_history(session_id: str) -> ChatMessageHistoryWithTimestamps:
    """Get or create conversation history for session"""
    
def clear_session(session_id: str) -> None:
    """Clear conversation history for session"""
```

**LLM Configuration**:
- Model: Groq llama-3.1-8b-instant (via API)
- Temperature: 0.7 (default, configurable)
- System Prompt: Instructions for assistant behavior

**Context Composition**:
```python
Context from knowledge base:
[Document 1 - source.pdf]
{chunk content}

[Document 2 - webpage.web]
{chunk content}

---

User question: {original_question}
```

**Source Citation**:
- Retrieval returns source metadata (filename, path, relevance score)
- Response includes sources used
- Frontend displays source attribution

**Example Usage**:
```python
from llm import chat, get_session_history
from db import get_session_db

# Get session database
db = get_session_db("session-123")

# Chat with context
response = chat(
    input_str="What is this about?",
    session_id="session-123",
    db=db,
    selected_sources=[{"name": "doc.pdf", "size": 1024}]
)

# Get history
history = get_session_history("session-123")
messages = history.get_messages_with_timestamps()
```

---

### 5. `db.py` - Session Database Caching

**Purpose**: Manage per-session Chroma database instances

**Key Concepts**:

**Session Isolation**:
- Each session: separate data directory (`data/{session_id}/`)
- Each session: separate Chroma database (`chroma/{session_id}/`)
- No cross-session data leakage
- Clean deletion on session clear

**In-Memory Caching**:
- Cache session databases to prevent reconnections
- Improves performance for repeated queries
- Cleared per session on deletion

**Key Functions**:

```python
def get_session_db(session_id: str) -> Chroma:
    """Get or create session database (with caching)"""
    
def clear_session_db(session_id: str) -> None:
    """Delete session database and clear cache"""
```

**Example Usage**:
```python
from db import get_session_db, clear_session_db

# Get session database
db = get_session_db("session-123")

# Use database...

# Clean up session
clear_session_db("session-123")
```

---

### 6. `config.py` - Configuration Management

**Purpose**: Centralized configuration from environment variables

**Configuration Categories**:

| Category | Variables | Purpose |
|----------|-----------|---------|
| API | BACKEND_PORT, DEBUG | Server configuration |
| LLM | GROQ_API_KEY, MODEL_NAME, TEMPERATURE | LLM settings |
| RAG | RAG_ENABLED, RAG_TOP_K | Retrieval settings |
| Chunking | CHUNK_SIZE, CHUNK_OVERLAP | Text splitting |
| Embeddings | EMBEDDING_MODEL, EMBEDDING_DEVICE | Embedding model |
| Paths | DATA_PATH, CHROMA_PATH, LOG_DIR | Directory paths |
| OCR | OCR_CONFIDENCE_THRESHOLD, OCR_LANGUAGES | OCR settings |
| Limits | MAX_FILE_SIZE_MB, MAX_URL_LENGTH, REQUEST_TIMEOUT | Resource limits |

**Usage**:
```python
from config import Config, SYSTEM_PROMPT, ERROR_MESSAGES

# Access configuration
print(Config.MODEL_NAME)  # "llama-3.1-8b-instant"
print(Config.CHUNK_SIZE)  # 300
print(Config.RAG_TOP_K)   # 5

# Use messages
print(ERROR_MESSAGES['input_too_large'])

# Get all config (excludes sensitive keys)
config_dict = Config.to_dict()

# Validate configuration
Config.validate()
```

---

### 7. `history.py` - Chat History with Metadata

**Purpose**: Store conversation with timestamps and rich metadata

**Data Structure**:

```python
class ChatMessageHistoryWithTimestamps(BaseChatMessageHistory):
    messages: List[BaseMessage]           # Chat messages
    timestamps: List[datetime]            # Timestamps
    metadata: Dict[str, Dict[str, Any]]   # Per-message metadata
```

**Metadata Per Message**:
```python
{
    'originalInput': str,                    # Original user input
    'fileMetadata': List[Dict],             # Files used
    'sources': List[str],                   # Retrieved documents
    'urls': List[str],                      # Web sources used
}
```

**Key Methods**:

```python
def add_message(self, message: BaseMessage) -> None:
    """Add message with current timestamp"""
    
def add_message_metadata(self, message_index: int, 
                         meta: Dict[str, Any]) -> None:
    """Store metadata for a message"""
    
def get_message_metadata(self, message_index: int) 
                         -> Dict[str, Any]:
    """Retrieve metadata for a message"""
    
def get_messages_with_timestamps(self) 
                                 -> List[Tuple[BaseMessage, datetime]]:
    """Return list of (message, timestamp) tuples"""
```

**Example Usage**:
```python
from history import ChatMessageHistoryWithTimestamps
from langchain_core.messages import HumanMessage, AIMessage

# Create history
history = ChatMessageHistoryWithTimestamps()

# Add message
history.add_message(HumanMessage(content="Hello"))

# Add metadata
history.add_message_metadata(0, {'sources': ['doc.pdf']})

# Retrieve
messages = history.get_messages_with_timestamps()
for msg, ts in messages:
    print(f"{ts}: {msg.content}")
```

---

### 8. `logger.py` - Structured Logging

**Purpose**: Centralized logging configuration

**Features**:
- Console handler (INFO level by default)
- File handler with rotating logs (DEBUG level)
- Module-specific loggers
- Configurable via environment variables

**Module Loggers**:
```python
from logger import app_logger, extraction_logger, rag_logger, chat_logger, database_logger

app_logger.info("Application started")
extraction_logger.debug("Extracting PDF...")
rag_logger.info("Retrieved 5 documents")
```

---

### 9. `app_types.py` - Type Definitions

**Purpose**: Type safety and IDE support

**Key Types**:

```python
@dataclass
class ChatMessage:
    id: str
    role: str  # "user" or "assistant"
    content: str
    timestamp: datetime
    originalInput: Optional[str] = None
    sources: Optional[List[str]] = None
    # ... more fields

@dataclass
class RetrievalResult:
    context: str
    sources: List[SourceMetadata]

@dataclass
class ExtractionResult:
    text: str
    format: str
    source_name: str
    metadata: Dict[str, Any]
```

---

### 10. `embeddings.py` - Embeddings Initialization

**Purpose**: Central initialization of embeddings model

**Implementation**:
```python
from chroma import initialize_embeddings

# Lazy initialization on first import
embeddings = initialize_embeddings()
```

**Model Details**:
- Model: all-mpnet-base-v2
- Dimensions: 384
- Speed: ~50-100 embeddings/second on CPU
- Support: Multi-lingual

---

## Data Flow Examples

### Example 1: Document Upload

```
POST /api/sources (file)
    ↓
app.py: source_endpoint()
    ↓
extract_document(file_obj) → extractors.py
    ↓
DocumentExtractorFactory.extract_document()
    ├─→ PDFExtractor / DOCXExtractor / ImageExtractor
    └─→ Returns: extracted text
    ↓
Save to: data/{session_id}/{filename}.md
    ↓
get_session_db(session_id) → db.py
    ↓
chroma.py: add_single_document()
    ├─→ load_specific_documents([filepath])
    ├─→ split_text(documents) → 300-token chunks
    ├─→ add_documents_to_chroma(db, chunks)
    └─→ Update processed_files.txt
    ↓
Response: {"message": "File saved"}
```

### Example 2: Chat with RAG

```
POST /api/chat {message, selectedSources}
    ↓
app.py: chat_endpoint()
    ↓
llm.py: chat(input_str, session_id, db, selected_sources)
    ↓
retrieve_context(db, query, top_k, selected_sources)
    ├─→ chroma.py: db.similarity_search_with_score()
    ├─→ Filter by selected sources
    ├─→ Return top-5 chunks with scores
    └─→ Compose context string
    ↓
Prepend context to user message:
    "Context from knowledge base:\n[Document 1]...\n---\nUser question: ..."
    ↓
Invoke LLM chain:
    ├─→ System prompt
    ├─→ Conversation history (from history.py)
    ├─→ Full input with context
    └─→ Get response
    ↓
Store message metadata:
    - User message: originalInput, fileMetadata
    - AI response: sources (from retrieval)
    ↓
Response: {"reply": "Based on your documents, ..."}
```

### Example 3: Context Overflow Prevention

```
Scenario: User uploads 1GB of data

1. Upload → Extract & chunk (300-token size)
   Result: ~5000 chunks

2. User asks question
   
3. Vector search:
   - Query vector store
   - Limit to top-K (default: 5)
   - Size: ~1500 tokens max from retrieval
   
4. Prepend to message:
   - Conversation history: ~2000 tokens
   - Context: ~1500 tokens
   - User input: ~500 tokens
   - Total: ~4000 tokens (comfortable within LLM limit)
   
5. If context too large (413 error):
   - Catch error
   - Return user-friendly message:
     "Input too large, reduce document selection"
```

---

## Integration Patterns

### Pattern 1: Adding New Document Format

1. Create new extractor class in `extractors.py`:
```python
class NewFormatExtractor(DocumentExtractor):
    def can_extract(self, filename: str) -> bool:
        return filename.lower().endswith('.newformat')
    
    def extract(self, file_obj) -> str:
        # Extraction logic
        pass
```

2. Register in factory:
```python
self._extractors.append(NewFormatExtractor())
```

3. Test with app endpoint

### Pattern 2: Customizing Chunking

1. Edit `chroma.py`:
```python
CHUNK_SIZE = 500  # Increase for larger chunks
CHUNK_OVERLAP = 150  # Increase overlap ratio
```

2. Rebuild databases:
```bash
python backend/chroma.py rebuild <session_id>
```

### Pattern 3: Changing LLM Model

1. Update `config.py`:
```python
MODEL_NAME = "llama-3.3-70b-versatile"
```

2. Restart backend
3. Adjust system prompt if needed

---

## Performance Optimization Tips

1. **Reduce RAG_TOP_K** for faster responses
2. **Increase CHUNK_SIZE** for broader context
3. **Use session caching** (already implemented in `db.py`)
4. **Batch document uploads** to leverage change detection
5. **Monitor log files** for bottlenecks

---

## Troubleshooting

### Module Import Errors

```python
# Check if optional dependencies available
try:
    import pypdf
    PDF_AVAILABLE = True
except ImportError:
    PDF_AVAILABLE = False
    logger.warning("pypdf not installed...")
```

### OCR Not Working

```bash
# Download EasyOCR models
python -c "import easyocr; easyocr.Reader(['en'])"
```

### Embedding Model Download

```bash
# Cache embeddings model
python -c "from langchain_huggingface import HuggingFaceEmbeddings; embeddings = HuggingFaceEmbeddings(model_name='all-mpnet-base-v2')"
```

### Vector Database Issues

```bash
# Rebuild corrupted database
rm -rf chroma/session_id
python backend/chroma.py rebuild session_id
```

