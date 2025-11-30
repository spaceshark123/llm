# LLM Chat Application

A full-stack Retrieval-Augmented Generation (RAG) chat application that enables users to interact with an AI assistant using their own documents and web sources as context.

## Features

- **Interactive Chat**: Real-time conversation with AI assistant
- **Multi-Format Support**: PDFs, DOCX, images (with OCR), and web URLs
- **Vector Search**: Document chunking and retrieval using embeddings
- **RAG Pipeline**: Intelligent context retrieval with overflow prevention
- **Session Management**: Per-user isolated conversations and documents
- **Markdown Support**: Rich chats with support for displaying bullet points, bold/italic text, code blocks, etc.
- **Full Customization**: Easily swappable LLM and embedding models with Groq API and HuggingFace

## Tech Stack

### Backend

- **Framework**: Flask
- **LLM**: Groq (llama-3.3-70b-versatile, llama-3.1-8b-instant, etc.)
- **Embeddings**: HuggingFace (all-mpnet-base-v2, etc.)
- **Vector Store**: Chroma with persistent storage
- **Document Processing**: pypdf, python-docx, EasyOCR
- **Web Scraping**: Dynamic JS detection and website loading with Selenium + BeautifulSoup

### Frontend

- **Framework**: React + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Components**: ShadCN UI
- **Markdown Rendering**: React Markdown + Syntax Highlighting

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
└── README.md              # This file
```

## Getting Started

### 1. Quick Setup

```bash
# Clone repository
git clone <repo>
cd llm

# Create .env file
cp .env.sample .env
# IMPORTANT: Edit .env and create/add GROQ_API_KEY from https://console.groq.com/keys

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

## Configuration

Create `.env` file with same format as the provided [.env.sample](.env.sample) file. Make sure to set the `GROQ_API_KEY` value by creating an account/key at [GroqCloud](https://console.groq.com/keys):

```ini
# Overall Settings
GROQ_API_KEY=your_api_key_here
DATA_PATH="data"
TEMP_PATH="temp"
CHROMA_PATH="chroma"
BACKEND_PORT=5050
VITE_API_URL=http://localhost:5050/api
USER_AGENT="Mozilla/5.0"

# LLM Settings
TEMPERATURE=0.7
# MAIN CHOICES: llama-3.3-70b-versatile or llama-3.1-8b-instant
MODEL_NAME="llama-3.1-8b-instant" 
# Maximum prompt length in characters
VITE_MAX_PROMPT_LENGTH=5000 

# RAG Settings
RAG_ENABLED=True
RAG_TOP_K=5
CHUNK_SIZE=300
CHUNK_OVERLAP=100
# MAIN CHOICES: all-mpnet-base-v2, sentence-transformers/all-MiniLM-L6-v2, etc.
EMBEDDING_MODEL="all-mpnet-base-v2" 
```

A full list of usable models for the `MODEL_NAME` field can be found [here](https://console.groq.com/docs/rate-limits), along with rate limits for each (RPM/RPD, TPM/TPD)

## Support

For issues, questions, or suggestions, please refer to the documentation or check the [GitHub Issues](https://github.com/spaceshark123/llm/issues).
