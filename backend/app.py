from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
from llm import chat, get_session_history, clear_session
from langchain_core.messages import HumanMessage, AIMessage
from dotenv import load_dotenv
from history import ChatMessageHistoryWithTimestamps

try:
	import pypdf
	PDF_AVAILABLE = True
except ImportError:
	PDF_AVAILABLE = False
	print("Warning: pypdf not installed. PDF processing will be limited.")

load_dotenv()
PORT = int(os.getenv('BACKEND_PORT', 5050))

app = Flask(__name__)
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['CORS_RESOURCES'] = {r"/*": {"origins": "*"}}
app.config['CORS_SUPPORTS_CREDENTIALS'] = True

CORS(app)

def extract_pdf_text(pdf_file):
	"""Extract text from PDF file using pypdf."""
	if not PDF_AVAILABLE:
		return f"[PDF processing unavailable - pypdf not installed]"
	
	try:
		reader = pypdf.PdfReader(pdf_file)
		text = ""
		for page_num, page in enumerate(reader.pages):
			try:
				text += f"\n--- Page {page_num + 1} ---\n"
				text += page.extract_text()
			except Exception as e:
				text += f"[Failed to extract page {page_num + 1}: {str(e)}]\n"
		return text
	except Exception as e:
		return f"[Failed to process PDF: {str(e)}]"

@app.route('/')
def home():
	return jsonify({'message': 'Welcome to the Chat API!'})

@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
	session_id = request.headers.get('Session-ID')
	
	# Handle both JSON and FormData requests
	message = None
	files = []
	file_contents = {}
	urls = []
	
	if request.is_json:
		# Handle JSON request
		data = request.get_json()
		message = data.get('message')
		files = data.get('files', [])
		file_contents = data.get('fileContents', {})
		urls = data.get('urls', [])
	else:
		# Handle FormData request (for file uploads)
		message = request.form.get('message')
		
		# Parse JSON fields from form data
		file_contents_str = request.form.get('fileContents', '{}')
		file_metadata_str = request.form.get('fileMetadata', '[]')
		urls_str = request.form.get('urls', '[]')
		
		try:
			file_contents = json.loads(file_contents_str)
			files = json.loads(file_metadata_str)
			urls = json.loads(urls_str)
		except json.JSONDecodeError as e:
			print(f"Error parsing JSON from form data: {e}")
			file_contents = {}
			files = []
			urls = []
		
		# Process uploaded PDF files
		if 'pdf_files' in request.files:
			pdf_files = request.files.getlist('pdf_files')
			for pdf_file in pdf_files:
				print(f"Processing uploaded PDF: {pdf_file.filename}")
				pdf_text = extract_pdf_text(pdf_file)
				file_contents[pdf_file.filename] = pdf_text
				
				# Add to file metadata if not already there
				file_exists = any(f['name'] == pdf_file.filename for f in files)
				if not file_exists:
					files.append({
						'name': pdf_file.filename,
						'type': 'application/pdf',
						'size': len(pdf_file.read())
					})
					pdf_file.seek(0)  # Reset file pointer

	print("Message:", message)
	print("Files:", [f.get('name') if isinstance(f, dict) else f for f in files])
	print("File Contents Keys:", list(file_contents.keys()))
	print("URLs:", urls)

	if not message:
		return jsonify({'error': 'Input is required'}), 400
	if not session_id or session_id.strip() == "":
		return jsonify({'error': 'Session-ID header is required'}), 400

	print("chat request for session:", session_id)

	# Pass files and file_contents to chat function
	reply = chat(message, session_id=session_id, file_contents=file_contents, file_metadata=files)
	return jsonify({'reply': reply})

# get/clear session history endpoint
@app.route('/api/history', methods=['GET', 'DELETE'])
def history_endpoint():
    session_id = request.headers.get('Session-ID')
    print("history request for session:", session_id)
    if not session_id:
        return jsonify({'error': 'Session-ID header is required'}), 400
    
    if request.method == 'DELETE':
        clear_session(session_id)
        return jsonify({'message': 'Session cleared'}), 200
    
    if request.method == 'GET':
        '''
        export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  sources: string[]
  timestamp: Date
  isStreaming?: boolean
  truncatedContent?: string
}

        '''
        history = get_session_history(session_id).get_messages_with_timestamps()
        print("Fetched history for session:", session_id, history)
        history_serialized = [
            {
                'id': str(index),
                'role': 'assistant' if isinstance(msg, AIMessage) else 'user',
                'content': msg.content,
                'sources': [],
                'timestamp': timestamp.isoformat(),
                'isStreaming': False,
                'truncatedContent': msg.content,
            }
            for (index, (msg, timestamp)) in enumerate(history)
        ]
        return jsonify({'history': history_serialized}), 200

if __name__ == '__main__':
	app.run(port=PORT, debug=True)