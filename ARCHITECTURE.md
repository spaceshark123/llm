# LLM Chat Application - Architecture Documentation

## Overview

This is a full-stack RAG (Retrieval-Augmented Generation) chat application that allows users to chat with an AI assistant using their own documents and web sources as context. The system uses vector embeddings for efficient document retrieval and prevents context overflow through intelligent chunking and filtering strategies.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Frontend (React/TypeScript)             │
│  - Chat UI with message history                             │
│  - Document/URL source management                           │
│  - Session-based conversation tracking                      │
└────────────────────────┬────────────────────────────────────┘
                         │ REST API
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 Backend (Flask/Python)                      │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  API Layer (app.py)                                 │    │
│  │  - /api/chat: Process user messages                 │    │
│  │  - /api/sources: Manage file uploads                │    │
│  │  - /api/urls: Manage web source extraction          │    │
│  │  - /api/history: Retrieve/clear chat history        │    │
│  └─────────────────────────────────────────────────────┘    │
│                         │                                   │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │  Document Processing Layer                          │    │
│  │  ┌──────────────┐ ┌────────────┐ ┌──────────────┐   │    │
│  │  │ Extractors   │ │ Chunking   │ │ Vector Store │   │    │
│  │  │ - OCR        │ │ - Split    │ │ - Chroma DB  │   │    │
│  │  │ - PDF Parser │ │ - Overlap  │ │ - Embedding  │   │    │
│  │  │ - DOCX Parse │ │            │ │   Functions  │   │    │
│  │  │ - Web Scrap  │ │            │ │              │   │    │
│  │  └──────────────┘ └────────────┘ └──────────────┘   │    │
│  └─────────────────────────────────────────────────────┘    │
│                         │                                   │
│  ┌──────────────────────┴──────────────────────────────┐    │
│  │  LLM & Retrieval Layer (llm.py)                     │    │
│  │  - Context retrieval with scoring                   │    │
│  │  - RAG pipeline orchestration                       │    │
│  │  - Conversation history management                  │    │
│  │  - LLM chain execution (Groq)                       │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│                 External Services                           │
│  - Groq LLM (llama-3.1-8b-instant)                          │
│  - HuggingFace Embeddings (all-mpnet-base-v2)               │
│  - EasyOCR for image text extraction                        │
│  - Selenium for web screenshot capture                      │
└─────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. Frontend Layer (`frontend/src/`)

**Chat Interface** (`components/chat-interface.tsx`):
- Session management
- Real-time message streaming
- User input handling

**Source Manager** (`components/source-manager.tsx`):
- File upload capability
- URL submission
- Source listing and deletion

**UI Components** (`components/ui/`):
- Reusable components built with Radix UI
- Button, Input, Dialog, Avatar components

### 2. Backend API Layer (`backend/app.py`)

**Primary Endpoints**:

- `POST /api/chat`: Submit message and get AI response
  - Accepts: `message` (string), `selectedSources` (array)
  - Returns: `reply` (string with markdown formatting)
  - Session-aware: Uses `Session-ID` header

- `POST /api/sources`: Upload document
  - Accepts: multipart form data with file
  - Processes: PDF, DOCX, PNG, JPG, etc.
  - Returns: Success message

- `GET /api/sources`: List uploaded files for session
- `DELETE /api/sources`: Remove file from session

- `POST /api/urls`: Submit URL for extraction
  - Accepts: JSON with `url` field
  - Returns: URL hash and session ID
  - Auto-generates session if not provided

- `GET /api/urls`: List web sources for session
- `DELETE /api/urls`: Remove URL from session

- `GET /api/history`: Retrieve chat history with timestamps
- `DELETE /api/history`: Clear session and delete history

### 3. Document Processing Pipeline

#### 3.1 Document Extraction (`app.py` functions)

**OCR Pipeline** (`extract_image_text`):
- Uses EasyOCR with confidence threshold (0.3)
- Converts images to RGB before processing
- Handles RGBA, grayscale, and other formats
- Returns annotated text with confidence filtering

**PDF Processing** (`extract_pdf_text`):
- First attempts text extraction via pypdf
- Falls back to EasyOCR for scanned pages
- Uses PyMuPDF for rendering scanned pages to images
- Per-page annotation for source tracking

**DOCX/DOC Processing** (`extract_docx_text`):
- Extracts text from paragraphs, tables, headers, and footers
- Handles both modern .docx (XML) and legacy .doc (binary) formats
- Preserves document structure in output

**URL Extraction** (`extract_url_text`):
- Primary: Selenium screenshot + EasyOCR for visual content
- Fallback: BeautifulSoup HTML parsing
- Combines both approaches for maximum coverage

#### 3.2 Document Storage

**File Storage** (`DATA_PATH/session_id/`):
- All extracted text stored as `.md` files
- Naming convention: `{filename}.md` for uploads, `{hash}.web.md` for URLs
- Session-isolated storage prevents cross-session data leakage

#### 3.3 Chunking Strategy (`chroma.py`)

**Chunk Configuration**:
```python
CHUNK_SIZE = 300  # tokens per chunk
CHUNK_OVERLAP = 100  # 33% overlap for context continuity
```

**RecursiveCharacterTextSplitter**:
- Splits by: `\n\n` (paragraphs) → `\n` (sentences) → ` ` (words)
- Preserves document structure intelligently
- Maintains metadata about source and position
- Adds `start_index` for reference tracking

**Rationale**:
- **300 tokens**: Balances context quality with retrieval precision
  - ~200-400 words per chunk
  - Fits within LLM context window comfortably
  - Provides meaningful semantic units
  
- **100 token overlap**: Prevents context breaks
  - Spans multiple chunks when relevant
  - Ensures smooth transitions between chunks
  - 33% overlap ratio (industry standard)

### 4. Vector Store & Retrieval (`chroma.py`, `llm.py`)

#### 4.1 Embeddings

**Model**: `all-mpnet-base-v2` (HuggingFace)
- 384-dimensional vectors
- Multi-lingual support
- Optimized for semantic search
- CPU-friendly (no GPU required)

**Initialization** (`embeddings.py`):
- Lazy loading on first use
- Normalized embeddings enabled for cosine similarity
- Error handling for initialization failures

#### 4.2 Vector Store (Chroma)

**Session-Based Architecture**:
- Each session gets isolated Chroma database
- Path: `chroma/{session_id}/`
- Metadata tracking: `processed_files.txt`

**Database Operations**:

```python
# Creation & Loading
get_or_create_db(embeddings, session_id) -> Chroma

# Adding Documents
add_single_document(db, embeddings, filepath, session_id)
add_documents_to_chroma(db, embeddings, chunks)

# Updating
update_database(db, embeddings, session_id)  # New/modified only
rebuild_database(embeddings, session_id)     # Full rebuild

# Deletion
remove_documents_by_source(db, source_path)  # By source file
clear_session_db(session_id)                 # Entire session
```

#### 4.3 Retrieval & Filtering

**Similarity Search** (`retrieve_context`):
```python
results = db.similarity_search_with_score(
    query=user_message,
    k=RAG_TOP_K,  # Default: 5 documents
    filter={"source": {"$in": selected_sources}}  # Optional filtering
)
```

**Context Composition**:
- Combines top-K results with relevance scores
- Formats as: `[Document {i} - {source}]\n{content}`
- Prepends context to user query for LLM processing
- Includes source attribution for user reference

**Context Overflow Prevention**:
1. **Fixed top-K**: Limits retrieval to top 5 documents
2. **Chunk size**: 300 tokens keeps individual contexts bounded
3. **Source filtering**: Users select specific sources to limit scope
4. **LLM token limits**: Error handling for oversized inputs (413 errors)

### 5. LLM & Conversation Management (`llm.py`)

**LLM Configuration**:
- Model: `llama-3.1-8b-instant` (via Groq)
- Temperature: Configurable (default: 0.7)
- API: Groq for fast inference

**Chat Pipeline**:
1. Retrieve session history
2. Query vector store if RAG enabled & sources selected
3. Prepend context to user message
4. Invoke LLM chain with conversation history
5. Store response with metadata (sources, timestamp)
6. Handle errors (rate limiting, oversized inputs)

**Conversation History** (`history.py`):
- Type: `ChatMessageHistoryWithTimestamps`
- Stores: Messages + timestamps + metadata
- Per-session storage in memory
- Metadata includes: Original input, sources, file references

**Response Metadata**:
```python
{
    'originalInput': user_message,
    'fileMetadata': [selected files],
    'sources': [retrieved document names],
    'urls': [web sources used],
    'timestamp': ISO format datetime
}
```

### 6. Session Management (`db.py`)

**Session Lifecycle**:
1. **Creation**: Auto-created on first request
2. **Storage**: `DATA_PATH/{session_id}/` for documents
3. **Database**: `CHROMA_PATH/{session_id}/` for vectors
4. **Cleanup**: Full deletion via `DELETE /api/history`

**Caching**:
- `_db_cache`: In-memory cache of Chroma databases
- Prevents repeated instantiation
- Cleared per session on deletion

## Data Flow Examples

### Example 1: Document Upload & Retrieval

```
1. User uploads PDF
   ↓
2. Backend receives multipart form data
   ↓
3. PDF text extracted (text + OCR fallback)
   ↓
4. Text saved as session_id/filename.pdf.md
   ↓
5. File loaded and split into 300-token chunks (100-overlap)
   ↓
6. Chunks embedded using all-mpnet-base-v2
   ↓
7. Vectors stored in Chroma with metadata (source, position)
   ↓
8. Frontend displays file in source list
   ↓
9. User selects file and asks question
   ↓
10. Similarity search retrieves top-5 chunks
    ↓
11. Context prepended to user message
    ↓
12. LLM generates response with document references
```

### Example 2: Context Overflow Prevention

```
Scenario: User has 50MB of documents

1. Upload triggers chunking with 300-token size
   → Creates ~3000+ manageable chunks
   
2. Similarity search limited to k=5
   → Retrieves only 5 most relevant chunks
   → ~1500 tokens max from retrieval
   
3. User can filter to specific sources
   → Reduces search space further
   
4. System monitors total context size
   → If error 413 received, returns user-friendly message
   → "Input too large, reduce document selection"
```

## Configuration

**Environment Variables** (`.env`):
```ini
GROQ_API_KEY=your_key_here          # Required
MODEL_NAME=llama-3.1-8b-instant     # LLM model
TEMPERATURE=0.7                      # Response randomness
DATA_PATH=data                        # Document storage
CHROMA_PATH=chroma                    # Vector DB storage
RAG_ENABLED=true                      # Enable/disable RAG
RAG_TOP_K=5                           # Retrieval depth
BACKEND_PORT=5050                     # Flask port
VITE_API_URL=http://localhost:5050   # API endpoint
```

## Performance Considerations

### Chunking Strategy Impact
- **Larger chunks (500+)**: Fewer requests, but diluted relevance
- **Smaller chunks (100)**: More precise, but more requests
- **300 + 100 overlap**: Balanced approach for most use cases

### Embedding Efficiency
- all-mpnet-base-v2: ~50-100 embeddings/second on CPU
- 384-dimensional vectors: Small storage footprint
- Cosine similarity: O(n) search complexity (acceptable for <100k chunks)

### Database Operations
- **Add**: O(n) - Linear with chunk count (one-time on upload)
- **Query**: O(n) - But Chroma optimizes with indexing
- **Delete**: O(n) - Full table scan for source matching

### Context Management
- Max context per request: ~8000 tokens (LLM limit minus buffer)
- Top-5 retrieval: ~1500 tokens typical
- Buffer for conversation history: ~2000 tokens
- User input: ~500 tokens typical

## Error Handling

### Document Processing
- Missing extractors: Graceful fallback with error messages
- Corrupted files: Caught and reported to user
- Unsupported formats: User-friendly error

### Retrieval
- Empty vector DB: Returns empty context, answer from LLM knowledge
- Network errors: Retried with exponential backoff
- Oversized context: 413 error caught and reported

### LLM Errors
- **429 (Rate Limited)**: User-friendly message to retry later
- **413 (Payload Too Large)**: Suggest reducing document selection
- **Other**: Generic error message with retry option

## Extensibility

### Adding New Document Formats
1. Create extractor function in app.py
2. Update `extract_document_text()` dispatcher
3. Ensure output format: plain text or annotated markdown

### Modifying Chunking Strategy
1. Update `CHUNK_SIZE` and `CHUNK_OVERLAP` in chroma.py
2. Adjust LLM system prompt if needed
3. Re-run `rebuild_database()` for existing data

### Changing Embedding Models
1. Update `initialize_embeddings()` in chroma.py
2. Select model from HuggingFace (ensure similar dimensions for compatibility)
3. Clear existing Chroma databases (dimensions differ)

## Security Considerations

1. **Session Isolation**: Each user session has separate data and vector DB
2. **File Validation**: Multipart file uploads validated before processing
3. **URL Validation**: URLs parsed and validated before fetching
4. **Resource Limits**: Top-K and chunk size prevent abuse
5. **No Auth**: Currently open access - add authentication for production

## Future Improvements

1. **Persistent Sessions**: Store chat history in database
2. **User Authentication**: Per-user session isolation
3. **Batch Processing**: Queue system for large document uploads
4. **Advanced Filtering**: Hybrid search (keyword + semantic)
5. **Streaming Responses**: Real-time token generation to frontend
6. **Analytics**: Track retrieval performance and user patterns
