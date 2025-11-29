# API Documentation

## Base URL

```
http://localhost:5050/api
```

## Authentication

Currently, the API uses session-based identification:
- **Session-ID Header**: Required for most requests
- Format: Any unique string (e.g., UUID, timestamp)
- Sessions are isolated and auto-created on first use

## Endpoints

### 1. Chat

#### POST /api/chat

Send a message and receive an AI response with context from selected sources.

**Headers:**
```
Session-ID: <string>  (required)
Content-Type: application/json
```

**Request Body (JSON):**
```json
{
  "message": "What is in my documents?",
  "selectedSources": [
    {
      "name": "document.pdf",
      "size": 1024
    },
    {
      "name": "webpage.web",
      "size": 2048
    }
  ]
}
```

**Response (200 OK):**
```json
{
  "reply": "Based on your documents, I found..."
}
```

**Error Responses:**
- `400 Bad Request`: Missing message or Session-ID
- `413 Payload Too Large`: Input exceeds model limits (reduce document selection)
- `429 Too Many Requests`: Rate limit exceeded
- `500 Internal Server Error`: LLM processing failed

**Notes:**
- Markdown formatting supported in response
- RAG context automatically retrieved if enabled
- Only selected sources are searched ([] = LLM knowledge only)
- Response includes source citations

---

### 2. Sources (File Uploads)

#### POST /api/sources

Upload a document file for processing and indexing.

**Headers:**
```
Session-ID: <string>  (required)
Content-Type: multipart/form-data
```

**Request Body (FormData):**
```
file: <binary>  (PDF, DOCX, PNG, JPG, GIF, BMP, TIFF)
```

**Response (200 OK):**
```json
{
  "message": "File saved to data/session-123/document.pdf.md"
}
```

**Supported Formats:**
- PDF (`.pdf`) - Text extraction + OCR for scanned pages
- DOCX (`.docx`) - Paragraphs, tables, headers, footers
- Images (`.png`, `.jpg`, `.jpeg`, `.gif`, `.bmp`, `.tiff`) - EasyOCR text extraction
- DOC (`.doc`) - Limited support, convert to DOCX for best results

**Processing Flow:**
1. Text extracted using appropriate method
2. Saved as `{filename}.md` in session folder
3. Split into 300-token chunks (100-token overlap)
4. Embedded and stored in Chroma vector database
5. Metadata tracked for update detection

**Error Responses:**
- `400 Bad Request`: No file provided
- `400 Bad Request`: Empty filename
- `415 Unsupported Media Type`: File format not supported

**Notes:**
- Large files may take time to process
- OCR on scanned PDFs requires EasyOCR (check server logs)
- Progress visible in server logs

---

#### GET /api/sources

List all uploaded files in the current session.

**Headers:**
```
Session-ID: <string>  (required)
```

**Response (200 OK):**
```json
{
  "files": [
    {
      "name": "document.pdf",
      "extension": "pdf"
    },
    {
      "name": "presentation.docx",
      "extension": "docx"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Missing Session-ID

---

#### DELETE /api/sources

Remove a file from the session and delete its vectors from the database.

**Headers:**
```
Session-ID: <string>  (required)
```

**Query Parameters:**
```
filename: <string>  (required, without .md extension)
```

**Example:**
```
DELETE /api/sources?filename=document.pdf
```

**Response (200 OK):**
```json
{
  "message": "File document.pdf deleted from session session-123"
}
```

**Error Responses:**
- `400 Bad Request`: Missing filename parameter
- `404 Not Found`: File doesn't exist in session

---

### 3. URLs (Web Sources)

#### POST /api/urls

Submit a URL for content extraction and indexing.

**Headers:**
```
Session-ID: <string>  (optional - auto-generated if missing)
Content-Type: application/json
```

**Request Body (JSON):**
```json
{
  "url": "https://example.com/article"
}
```

**Response (200 OK):**
```json
{
  "message": "URL processed successfully",
  "urlHash": "a3b5c2d8e1f9",
  "url": "https://example.com/article",
  "name": "a3b5c2d8e1f9.web",
  "sessionId": "session-123"
}
```

**Processing Methods:**
1. **Selenium Screenshot + EasyOCR**: For visual content (default)
   - Captures full page screenshot
   - Runs OCR on screenshot for text extraction
   - Handles dynamic/JavaScript-rendered content

2. **BeautifulSoup Fallback**: For static HTML
   - Parses HTML structure
   - Extracts text content
   - Used if Selenium unavailable

**Content Storage:**
- Saved as `{urlHash}.web.md` in session folder
- Format: `URL: {url}\n\n{extracted_text}`
- Indexed in Chroma like regular documents

**Error Responses:**
- `400 Bad Request`: URL not provided or invalid format
- `400 Bad Request`: Invalid URL format (missing scheme/netloc)
- `500 Internal Server Error`: Content extraction failed

**Notes:**
- URL validation performed before processing
- Long pages may take 3-5 seconds (Selenium rendering)
- Session auto-created if not provided in headers
- Returns `sessionId` for client-side tracking

---

#### GET /api/urls

List all web sources in the current session.

**Headers:**
```
Session-ID: <string>  (required)
```

**Response (200 OK):**
```json
{
  "urls": [
    {
      "url": "https://example.com/article",
      "urlHash": "a3b5c2d8e1f9",
      "name": "a3b5c2d8e1f9.web"
    },
    {
      "url": "https://docs.example.org",
      "urlHash": "b4c6d3e9f2a0",
      "name": "b4c6d3e9f2a0.web"
    }
  ]
}
```

**Error Responses:**
- `400 Bad Request`: Missing Session-ID

---

#### DELETE /api/urls

Remove a URL source from the session.

**Headers:**
```
Session-ID: <string>  (required)
```

**Query Parameters:**
```
urlHash: <string>  (required)
```

**Example:**
```
DELETE /api/urls?urlHash=a3b5c2d8e1f9
```

**Response (200 OK):**
```json
{
  "message": "URL deleted successfully"
}
```

**Error Responses:**
- `400 Bad Request`: Missing urlHash parameter
- `404 Not Found`: URL doesn't exist in session

---

### 4. Chat History

#### GET /api/history

Retrieve full chat history for a session.

**Headers:**
```
Session-ID: <string>  (required)
```

**Response (200 OK):**
```json
{
  "history": [
    {
      "id": "0",
      "role": "user",
      "content": "What's in the PDF?",
      "originalInput": "What's in the PDF?",
      "sources": ["document.pdf"],
      "timestamp": "2024-01-15T10:30:45.123456",
      "isStreaming": false,
      "truncatedContent": "What's in the PDF?",
      "fileMetadata": [
        {
          "name": "document.pdf",
          "size": 1024
        }
      ],
      "urls": []
    },
    {
      "id": "1",
      "role": "assistant",
      "content": "The PDF contains...",
      "originalInput": null,
      "sources": ["document.pdf"],
      "timestamp": "2024-01-15T10:30:48.654321",
      "isStreaming": false,
      "truncatedContent": "The PDF contains...",
      "fileMetadata": null,
      "urls": []
    }
  ]
}
```

**Message Object Structure:**
- `id`: Sequential message index
- `role`: "user" or "assistant"
- `content`: Full message text
- `originalInput`: Original user input (without RAG context prepended)
- `sources`: List of document sources used in response
- `timestamp`: ISO 8601 timestamp
- `isStreaming`: Always false (streaming not yet implemented)
- `truncatedContent`: Full content (truncation not yet implemented)
- `fileMetadata`: Uploaded files metadata for user messages
- `urls`: Web sources used

**Error Responses:**
- `400 Bad Request`: Missing Session-ID

---

#### DELETE /api/history

Clear all chat history and delete session data.

**Headers:**
```
Session-ID: <string>  (required)
```

**Response (200 OK):**
```json
{
  "message": "Session cleared"
}
```

**Effects:**
- Deletes all messages and timestamps
- Removes session folder: `data/{session_id}/`
- Removes vector database: `chroma/{session_id}/`
- Session can be re-used after deletion

**Error Responses:**
- `400 Bad Request`: Missing Session-ID

---

### 5. Sessions

#### GET /api/sessions

List all active sessions on the server.

**Response (200 OK):**
```json
{
  "sessions": [
    "session-123456",
    "session-789012",
    "user-abc-def"
  ]
}
```

**Notes:**
- Returns directory names from `DATA_PATH`
- Useful for debugging and session management
- No Session-ID header required

---

## RAG Configuration

### Query Parameters (Environment Variables)

**RAG_ENABLED** (default: `true`)
- Controls whether context retrieval is performed
- Set to `false` to disable RAG completely

**RAG_TOP_K** (default: `5`)
- Number of document chunks to retrieve per query
- Higher values = more context but slower
- Typical range: 3-10

### Context Management

**Automatic Prevention:**
1. Top-K limiting: Only 5 most relevant chunks retrieved
2. Chunk sizing: 300-token chunks prevent individual bloat
3. Source filtering: Users select specific sources to search
4. Error handling: Oversized inputs return 413 error

**Manual Override:**
- Unselect all sources to query LLM without RAG context
- Remove large documents to reduce search space

---

## Error Handling

### Standard Error Response Format

```json
{
  "error": "Description of what went wrong"
}
```

### Common HTTP Status Codes

| Code | Meaning | Action |
|------|---------|--------|
| 200 | Success | Operation completed |
| 400 | Bad Request | Fix request format or parameters |
| 404 | Not Found | Check resource names |
| 413 | Payload Too Large | Reduce document selection |
| 429 | Rate Limited | Wait before retrying |
| 500 | Server Error | Check server logs |

### Specific Error Messages

| Error | Cause | Solution |
|-------|-------|----------|
| "Input is required" | Empty message field | Provide non-empty message |
| "Session-ID header is required" | Missing header | Add Session-ID header |
| "File saved to ..." | Success | File indexed and searchable |
| "Input too large for the model" | Context overflow | Reduce document selection |
| "Rate limit exceeded" | API quota hit | Wait and retry |

---

## Rate Limiting

Currently no rate limiting enforced. For production:

**Recommended:**
- 100 requests/minute per session
- 10 MB max file size
- 50 URLs per session
- 10,000 chunks per session max

---

## Code Examples

### JavaScript/TypeScript

```typescript
// Send a chat message
const response = await fetch('http://localhost:5050/api/chat', {
  method: 'POST',
  headers: {
    'Session-ID': 'my-session-123',
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    message: 'What is this about?',
    selectedSources: [
      { name: 'document.pdf', size: 1024 }
    ]
  })
});

const data = await response.json();
console.log(data.reply);
```

### Python

```python
import requests

# Upload a file
session_id = 'my-session-123'
files = {'file': open('document.pdf', 'rb')}
headers = {'Session-ID': session_id}

response = requests.post(
    'http://localhost:5050/api/sources',
    headers=headers,
    files=files
)
print(response.json())

# Get chat response
response = requests.post(
    'http://localhost:5050/api/chat',
    headers=headers,
    json={
        'message': 'What is this about?',
        'selectedSources': [{'name': 'document.pdf', 'size': 1024}]
    }
)
print(response.json()['reply'])
```

### cURL

```bash
# Send chat message
curl -X POST http://localhost:5050/api/chat \
  -H "Session-ID: my-session-123" \
  -H "Content-Type: application/json" \
  -d '{
    "message": "What is this about?",
    "selectedSources": [{"name": "document.pdf", "size": 1024}]
  }'

# Upload file
curl -X POST http://localhost:5050/api/sources \
  -H "Session-ID: my-session-123" \
  -F "file=@document.pdf"

# Get chat history
curl -X GET http://localhost:5050/api/history \
  -H "Session-ID: my-session-123"
```
