# LLM Chat Application

A full-stack Retrieval-Augmented Generation (RAG) chat application that enables users to interact with an AI assistant using their own documents and web sources as context.

## Quick Links

- **[Architecture Documentation](./ARCHITECTURE.md)** - System design, data flow, and technical details
- **[API Documentation](./API_DOCS.md)** - Complete REST API reference with examples
- **[Setup Guide](./SETUP.md)** - Installation and configuration instructions

## Features

- 💬 **Interactive Chat**: Real-time conversation with AI assistant
- 📄 **Multi-Format Support**: PDFs, DOCX, images (with OCR), and web URLs
- 🔍 **Vector Search**: Semantic document retrieval using embeddings
- 🚀 **RAG Pipeline**: Intelligent context retrieval with overflow prevention
- 📊 **Session Management**: Per-user isolated conversations and documents
- 🔐 **Type-Safe**: Full TypeScript frontend and Python type hints
- ⚡ **Fast Inference**: Powered by Groq LLM API

## Tech Stack

### Backend
- **Framework**: Flask with CORS support
- **LLM**: Groq (llama-3.1-8b-instant)
- **Embeddings**: HuggingFace (all-mpnet-base-v2)
- **Vector Store**: Chroma with persistent storage
- **Document Processing**: pypdf, python-docx, EasyOCR
- **Web Scraping**: Selenium + BeautifulSoup

### Frontend
- **Framework**: React 19 with TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Components**: Radix UI
- **Document Rendering**: pdf.js, Mammoth

## Project Structure

```
llm/
├── backend/                 # Python Flask API
│   ├── app.py              # Main Flask application & route handlers
│   ├── llm.py              # LLM chat and retrieval logic
│   ├── chroma.py           # Vector database management
│   ├── db.py               # Session database caching
│   ├── history.py          # Chat history with timestamps
│   ├── embeddings.py       # Embedding initialization
│   ├── extractors.py       # Document extraction (PDF, DOCX, OCR, URLs)
│   ├── logger.py           # Centralized logging
│   ├── config.py           # Configuration management
│   ├── app_types.py        # Type definitions (renamed to avoid shadowing stdlib)
│   └── requirements.txt    # Python dependencies
│
├── frontend/               # React TypeScript application
│   ├── src/
│   │   ├── App.tsx        # Main application component
│   │   ├── main.tsx       # Entry point
│   │   ├── components/
│   │   │   ├── chat-interface.tsx    # Main chat UI
│   │   │   ├── chat-input.tsx        # Message input & source selection
│   │   │   ├── chat-messages.tsx     # Message display
│   │   │   ├── source-manager.tsx    # File/URL management
│   │   │   └── ui/                   # Reusable UI components
│   │   ├── lib/
│   │   │   └── utils.ts              # Utility functions
│   │   └── types/
│   │       └── chat.ts               # TypeScript types
│   ├── package.json
│   ├── vite.config.ts
│   └── tsconfig.json
│
├── ARCHITECTURE.md         # System architecture documentation
├── API_DOCS.md            # REST API reference
├── SETUP.md               # Installation and configuration guide
└── README.md              # This file
```

## Module Overview

### Backend Modules

#### `app.py` - Flask REST API
Primary entry point serving all API endpoints:
- `/api/chat` - Process messages with RAG context
- `/api/sources` - Manage uploaded documents
- `/api/urls` - Manage web sources
- `/api/history` - Chat history retrieval and clearing
- `/api/sessions` - Session management

#### `llm.py` - LLM & Chat Logic
Orchestrates LLM interactions and context retrieval:
- `chat()` - Main chat function with session history
- `retrieve_context()` - Vector store querying
- `get_session_history()` - Session history management
- Integration with Groq API

#### `chroma.py` - Vector Database Management
Handles document chunking and vector storage:
- `RecursiveCharacterTextSplitter` - 300-token chunks with 100-token overlap
- `add_single_document()` - Index new documents
- `update_database()` - Process modified files
- `rebuild_database()` - Full database rebuild
- `remove_documents_by_source()` - Delete indexed content

#### `extractors.py` - Document Text Extraction
Modular document processing with graceful fallbacks:
- `PDFExtractor` - Text + OCR for scanned pages
- `DOCXExtractor` - Structured document parsing
- `ImageExtractor` - EasyOCR-based image text extraction
- `URLExtractor` - Selenium screenshots + HTML parsing
- `DocumentExtractorFactory` - Unified extraction interface

#### `db.py` - Session Database Caching
Manages per-session vector databases:
- `get_session_db()` - Get or create session database
- `clear_session_db()` - Delete session data
- In-memory caching to prevent reconnections

#### `history.py` - Chat History with Metadata
Conversation tracking with rich metadata:
- `ChatMessageHistoryWithTimestamps` - Messages with timestamps
- Per-message metadata storage (sources, files, URLs)
- Session-scoped in-memory storage

#### `config.py` - Configuration Management
Centralized configuration from environment variables:
- LLM settings (model, temperature)
- RAG settings (enabled, top-k)
- Chunking configuration
- Path and resource limits
- Error messages and feature flags

#### `logger.py` - Structured Logging
Application-wide logging configuration:
- Console and file handlers
- Rotating file logs
- Multiple logger instances per module

#### `app_types.py` - Type Definitions
TypeScript-like type safety in Python:
- `ChatMessage` - Message structure
- `RetrievalResult` - Vector search results
- `ExtractionResult` - Document processing results
- Type aliases for clarity

### Frontend Components

#### `chat-interface.tsx`
Main UI component displaying:
- Chat message history
- Message sender information
- Source attribution
- Loading states and errors

#### `chat-input.tsx`
User input handling:
- Multiline text input
- Source selection checkboxes
- Send button with states
- Keyboard shortcuts

#### `source-manager.tsx`
Document and URL management:
- File upload with drag-and-drop
- URL input form
- Source listing
- Delete functionality

## Getting Started

### 1. Quick Setup

```bash
# Clone repository
git clone <repo>
cd llm

# Create .env file
cp .env.sample .env
# Edit .env and add GROQ_API_KEY

# Backend setup
cd backend
pip install -r requirements.txt

# Frontend setup
cd frontend
npm install
```

### 2. Run Application

```bash
# Terminal 1 - Backend
cd backend
python app.py

# Terminal 2 - Frontend
cd frontend
npm run dev
```

Visit `http://localhost:5173` in your browser.

### 3. Try It Out

1. Upload a PDF or paste a URL
2. Type a question in the chat
3. Select the sources you want to include
4. Watch as the AI answers with context

## Key Concepts

### RAG (Retrieval-Augmented Generation)
- Documents are split into 300-token chunks (100 overlap)
- Chunks are embedded using all-mpnet-base-v2 (384-dim vectors)
- User queries retrieve top-5 most relevant chunks
- Context prepended to user message for LLM
- References included in response

### Context Overflow Prevention
1. **Fixed retrieval depth**: Top-5 documents only
2. **Chunk sizing**: 300 tokens prevents individual bloat
3. **Source filtering**: Users select specific sources
4. **Error handling**: 413 errors caught and reported
5. **Token monitoring**: Oversized inputs return friendly error

### Session Isolation
- Each session has separate data directory: `data/{session_id}/`
- Each session has separate Chroma database: `chroma/{session_id}/`
- Clean separation prevents cross-session contamination
- Cleanup on session deletion

## API Examples

### Chat with Context

```bash
curl -X POST http://localhost:5050/api/chat \
  -H "Session-ID: my-session" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is this about?",
    "selectedSources": [{"name": "document.pdf", "size": 1024}]
  }'
```

### Upload Document

```bash
curl -X POST http://localhost:5050/api/sources \
  -H "Session-ID: my-session" \
  -F "file=@document.pdf"
```

### Get Chat History

```bash
curl -X GET http://localhost:5050/api/history \
  -H "Session-ID: my-session"
```

See [API_DOCS.md](./API_DOCS.md) for complete reference.

## Configuration

Create `.env` file with:

```ini
GROQ_API_KEY=your_key_here
MODEL_NAME=llama-3.1-8b-instant
TEMPERATURE=0.7
RAG_ENABLED=true
RAG_TOP_K=5
BACKEND_PORT=5050
VITE_API_URL=http://localhost:5050/api
```

See [SETUP.md](./SETUP.md) for detailed configuration.

## Documentation

- **[ARCHITECTURE.md](./ARCHITECTURE.md)** - Deep dive into system design
  - Component interactions
  - Data flow examples
  - Performance considerations
  - Error handling strategies
  
- **[API_DOCS.md](./API_DOCS.md)** - Complete API reference
  - All endpoints with examples
  - Request/response formats
  - Error codes and handling
  - Code examples in multiple languages

- **[SETUP.md](./SETUP.md)** - Installation guide
  - Prerequisites and dependencies
  - Step-by-step setup
  - Troubleshooting
  - Development workflow

## Development

### Code Quality

- **Type Safety**: Python type hints, TypeScript frontend
- **Logging**: Structured logging across all modules
- **Error Handling**: Graceful degradation and user-friendly errors
- **Documentation**: Comprehensive docstrings and API docs

### Adding Features

1. **New Document Format**: Add extractor to `extractors.py`
2. **New LLM Model**: Update `config.py` and `llm.py`
3. **New Endpoint**: Add route in `app.py`, document in `API_DOCS.md`
4. **New UI Component**: Create in `frontend/src/components/`

## Performance Notes

- **Embedding Generation**: ~50-100 embeddings/second on CPU
- **PDF OCR**: 1-2 minutes for 100 pages
- **Chat Response**: 1-3 seconds typical
- **Vector Search**: O(n) but optimized by Chroma
- **Recommended Max Documents**: 100+ files per session

## Security Considerations

- Session IDs are client-managed (no auth)
- File uploads validated before processing
- URLs validated before fetching
- No authentication layer (add for production)
- Resource limits prevent abuse

## Future Improvements

- [ ] User authentication and authorization
- [ ] Persistent session storage
- [ ] Streaming responses
- [ ] Advanced search (hybrid keyword + semantic)
- [ ] Batch document processing
- [ ] Analytics and usage tracking
- [ ] Custom embedding models
- [ ] Multi-turn RAG improvements

## License

MIT

## Support

For issues, questions, or suggestions, please refer to the documentation or check the [GitHub Issues](https://github.com/spaceshark123/llm/issues).