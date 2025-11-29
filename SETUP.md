# Setup and Installation Guide

## Prerequisites

- Python 3.9+
- Node.js 16+ and npm
- Git
- 4GB RAM minimum (8GB recommended)

## Quick Start

### 1. Clone and Navigate

```bash
git clone https://github.com/spaceshark123/llm.git
cd llm
```

### 2. Environment Setup

Create a `.env` file in the project root:

```ini
# Required: Groq API Key
GROQ_API_KEY=your_groq_api_key_here

# LLM Configuration
MODEL_NAME=llama-3.1-8b-instant
TEMPERATURE=0.7

# Path Configuration
DATA_PATH=data
TEMP_PATH=temp
CHROMA_PATH=chroma

# Server Configuration
BACKEND_PORT=5050
VITE_API_URL=http://localhost:5050/api
```

**Get Groq API Key:**
1. Visit https://console.groq.com
2. Sign up or log in
3. Navigate to API Keys
4. Create new API key
5. Copy to `.env`

### 3. Backend Setup

```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Verify installation
python -c "import langchain; import chroma; print('✓ Dependencies OK')"
```

**Key Dependencies:**
- `flask` & `flask-cors`: API server
- `langchain-groq`: LLM integration
- `langchain-chroma`: Vector database
- `langchain-huggingface`: Embeddings
- `pypdf`: PDF text extraction
- `python-docx`: DOCX parsing
- `easyocr`: Image/scanned PDF OCR
- `selenium`: Web screenshot capture
- `beautifulsoup4`: HTML parsing

### 4. Frontend Setup

```bash
cd frontend

# Install Node dependencies
npm install

# Verify build
npm run build
```

**Key Dependencies:**
- `react` & `react-dom`: UI framework
- `typescript`: Type safety
- `tailwindcss`: Styling
- `radix-ui`: Component library
- `pdfjs-dist`: PDF rendering
- `mammoth`: DOCX preview

### 5. Run the Application

**Terminal 1 - Backend:**
```bash
cd backend
python app.py
```

Expected output:
```
WARNING in app.factory (werkzeug): Resource exhausted
 * Serving Flask app 'app'
 * Running on http://127.0.0.1:5050
EasyOCR initialized successfully
Embeddings initialized.
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
```

Expected output:
```
VITE v4.x.x  ready in 123 ms

➜  Local:   http://localhost:5173/
```

**Access the Application:**
- Frontend: http://localhost:5173
- API: http://localhost:5050/api

## Detailed Component Setup

### Backend Components

#### 1. Flask Application (`app.py`)

**Purpose**: REST API server handling all document and chat operations

**Key Initialization:**
```python
# CORS enabled for frontend access
CORS(app)

# OCR reader initialized on startup
initialize_easyocr()

# Environment variables loaded
load_dotenv()
```

**Data Directories Created:**
- `data/{session_id}/` - Extracted document text
- `chroma/{session_id}/` - Vector database per session

#### 2. LLM Module (`llm.py`)

**Purpose**: Chat processing with RAG context retrieval

**Initialization:**
```python
from langchain_groq import ChatGroq

llm = ChatGroq(
    model_name=MODEL_NAME,
    temperature=TEMPERATURE,
    api_key=GROQ_API_KEY
)
```

**Configuration Variables:**
- `RAG_ENABLED`: Enable/disable retrieval
- `RAG_TOP_K`: Number of chunks to retrieve (default 5)
- `SYSTEM_PROMPT`: System message for LLM

#### 3. Vector Store Module (`chroma.py`)

**Purpose**: Document chunking and vector database management

**Chunking Configuration:**
```python
CHUNK_SIZE = 300        # Tokens per chunk
CHUNK_OVERLAP = 100     # 33% overlap ratio
```

**Text Splitter:**
```python
RecursiveCharacterTextSplitter(
    chunk_size=300,
    chunk_overlap=100,
    separators=["\n\n", "\n", " "]  # Split hierarchy
)
```

**Embedding Model:**
```python
HuggingFaceEmbeddings(
    model_name="all-mpnet-base-v2",
    model_kwargs={'device': 'cpu'},
    encode_kwargs={'normalize_embeddings': True}
)
```

#### 4. Session Database Module (`db.py`)

**Purpose**: Session-scoped database caching and management

**In-Memory Cache:**
```python
_db_cache = {}  # {session_id: Chroma}
```

**Session Functions:**
- `get_session_db(session_id)` - Get or create DB
- `clear_session_db(session_id)` - Delete session data

#### 5. History Module (`history.py`)

**Purpose**: Conversation history with timestamps and metadata

**Data Structure:**
```python
class ChatMessageHistoryWithTimestamps:
    messages: List[BaseMessage]           # Chat messages
    timestamps: List[datetime]            # Message timestamps
    metadata: Dict[str, Dict[str, Any]]   # Per-message metadata
```

**Metadata Storage:**
```python
{
    'originalInput': str,          # User input before RAG prepend
    'fileMetadata': List[Dict],    # Files used
    'sources': List[str],          # Retrieved documents
    'urls': List[str],             # Web sources used
}
```

### Frontend Components

#### 1. Main Application (`src/App.tsx`)

**Purpose**: Application shell and routing

**Key Features:**
- Session initialization
- Page-level layout
- Error boundaries

#### 2. Chat Interface (`src/components/chat-interface.tsx`)

**Purpose**: Main chat UI with message display

**Key Features:**
- Message list with auto-scroll
- Real-time message rendering
- Source attribution display
- Error message handling

#### 3. Chat Input (`src/components/chat-input.tsx`)

**Purpose**: User message input with source selection

**Key Features:**
- Multiline text input
- Source checkboxes
- Send button with loading state
- Keyboard shortcuts (Ctrl+Enter to send)

#### 4. Source Manager (`src/components/source-manager.tsx`)

**Purpose**: File and URL management

**Key Features:**
- File upload with drag-and-drop
- URL input form
- Source list with delete buttons
- File type icons

#### 5. UI Components (`src/components/ui/`)

**Radix UI Based:**
- `button.tsx` - Styled button component
- `input.tsx` - Styled input field
- `dialog.tsx` - Modal dialog
- `avatar.tsx` - User/assistant avatars

## Environment Variables Reference

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `GROQ_API_KEY` | Groq API key for LLM access | `gsk_...` |

### Optional with Defaults

| Variable | Default | Description |
|----------|---------|-------------|
| `MODEL_NAME` | `llama-3.1-8b-instant` | Groq model to use |
| `TEMPERATURE` | `0.7` | Response randomness (0-1) |
| `DATA_PATH` | `data` | Directory for extracted text |
| `TEMP_PATH` | `temp` | Temporary file storage |
| `CHROMA_PATH` | `chroma` | Vector database storage |
| `RAG_ENABLED` | `true` | Enable/disable RAG |
| `RAG_TOP_K` | `5` | Documents to retrieve per query |
| `BACKEND_PORT` | `5050` | Flask server port |
| `VITE_API_URL` | `http://localhost:5050/api` | API endpoint URL |

## Troubleshooting

### Python Installation Issues

**Problem**: Module not found errors
```bash
# Verify Python version
python --version  # Should be 3.9+

# Reinstall dependencies
pip install --upgrade pip
pip install -r requirements.txt --force-reinstall
```

**Problem**: EasyOCR fails to initialize
```bash
# EasyOCR requires downloading models (~100MB)
# First run will be slow, check internet connection

# Manual download:
python -c "import easyocr; easyocr.Reader(['en'])"
```

**Problem**: Groq API key issues
```bash
# Verify key in .env file
echo $GROQ_API_KEY

# Test connection:
python -c "from langchain_groq import ChatGroq; ChatGroq(api_key='your_key')"
```

### Node.js Build Issues

**Problem**: npm install fails
```bash
# Clear cache and reinstall
npm cache clean --force
rm -rf node_modules package-lock.json
npm install
```

**Problem**: Vite dev server won't start
```bash
# Check if port 5173 is available
# Windows: netstat -ano | findstr 5173
# Mac/Linux: lsof -i :5173

# Use different port:
npm run dev -- --port 5174
```

### CORS Errors

**Problem**: Frontend can't connect to backend
```
Access to XMLHttpRequest blocked by CORS policy
```

**Solution**: Verify CORS configuration in `backend/app.py`:
```python
CORS(app)  # Should be called after Flask initialization
```

Check frontend API URL in `.env`:
```
VITE_API_URL=http://localhost:5050/api
```

### Vector Database Issues

**Problem**: Chroma initialization fails
```bash
# Delete corrupted database
rm -rf chroma/

# Restart backend
python app.py
```

**Problem**: Embedding model download fails
```bash
# Manually cache embeddings model
python -c "
from langchain_huggingface import HuggingFaceEmbeddings
embeddings = HuggingFaceEmbeddings(model_name='all-mpnet-base-v2')
print('Model cached successfully')
"
```

### Performance Issues

**Problem**: Slow document uploads
```
# Check file size (max recommended: 50MB)
# OCR on scanned PDFs is slow (1-2 minutes for 100 pages)
# Check CPU usage: task manager or top command
```

**Problem**: Slow chat responses
```
# Reduce RAG_TOP_K (default 5, try 3)
# Reduce number of selected sources
# Check Groq API status: https://status.groq.com
```

## Development Workflow

### Backend Development

```bash
cd backend

# Install in editable mode
pip install -e .

# Run with debug
python app.py
# Automatically reloads on file changes

# Run tests (if available)
pytest
```

### Frontend Development

```bash
cd frontend

# Dev mode with HMR
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Lint check
npm run lint
```

### Adding New Dependencies

**Backend:**
```bash
cd backend
pip install <package>
pip freeze > requirements.txt
```

**Frontend:**
```bash
cd frontend
npm install <package>
npm install --save-dev <dev-package>  # For dev dependencies
git add package.json package-lock.json
```

## Production Deployment

### Backend (Gunicorn)

```bash
pip install gunicorn

# Run with 4 workers
gunicorn -w 4 -b 0.0.0.0:5050 app:app
```

### Frontend (Build)

```bash
cd frontend
npm run build
# Output in dist/ directory

# Serve with any static server:
python -m http.server 3000 -d dist
```

### Environment Changes for Production

```ini
# .env.production
GROQ_API_KEY=your_key

# Disable debug mode
FLASK_ENV=production

# Frontend API URL
VITE_API_URL=https://your-domain.com/api

# Database paths (use absolute paths)
DATA_PATH=/var/app/data
CHROMA_PATH=/var/app/chroma
```

### Security Checklist

- [ ] Add authentication layer
- [ ] Use HTTPS/TLS
- [ ] Validate all file uploads
- [ ] Implement rate limiting
- [ ] Add CSRF protection
- [ ] Use secrets manager for API keys
- [ ] Enable HTTPS CORS only
- [ ] Add request size limits
- [ ] Set up logging and monitoring

## Getting Help

### Debug Mode

**Backend logging:**
```bash
# Set Flask debug
FLASK_ENV=development FLASK_DEBUG=1 python app.py
```

**Check error logs:**
```bash
# View recent errors
tail -f logs/error.log  # If configured

# Check console output for stack traces
```

### Common Resources

- [Groq Documentation](https://console.groq.com/docs)
- [LangChain Documentation](https://python.langchain.com)
- [Chroma Documentation](https://docs.trychroma.com)
- [React Documentation](https://react.dev)
- [Flask Documentation](https://flask.palletsprojects.com)

