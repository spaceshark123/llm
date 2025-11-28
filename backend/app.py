import shutil
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import io
import numpy as np
from PIL import Image
from llm import chat, get_session_history, clear_session
from langchain_core.messages import HumanMessage, AIMessage
from dotenv import load_dotenv
from history import ChatMessageHistoryWithTimestamps
from chroma import add_single_document, get_or_create_db, rebuild_database, remove_documents_by_source
from embeddings import embeddings

try:
	import pypdf
	PDF_AVAILABLE = True
except ImportError:
	PDF_AVAILABLE = False
	print("Warning: pypdf not installed. PDF processing will be limited.")
 
 # Check for docx availability
try:
	import docx
	DOCX_AVAILABLE = True
except ImportError:
	DOCX_AVAILABLE = False

# Initialize EasyOCR reader globally
ocr_reader = None
EASYOCR_AVAILABLE = False

def initialize_easyocr():
	"""Initialize EasyOCR reader with error handling."""
	global ocr_reader, EASYOCR_AVAILABLE
	try:
		import easyocr
		ocr_reader = easyocr.Reader(['en'], gpu=False)
		EASYOCR_AVAILABLE = True
		print("EasyOCR initialized successfully")
	except ImportError:
		EASYOCR_AVAILABLE = False
		ocr_reader = None
		print("Warning: easyocr not installed. Image OCR will be limited.")
	except Exception as e:
		EASYOCR_AVAILABLE = False
		ocr_reader = None
		print(f"Warning: easyocr initialization failed: {e}")

# Initialize on startup
initialize_easyocr()
load_dotenv()

DATA_PATH = os.getenv('DATA_PATH', 'data')
TEMP_PATH = os.getenv('TEMP_PATH', 'temp')
# clear and recreate data folder
if os.path.exists(DATA_PATH):
	shutil.rmtree(DATA_PATH)
os.makedirs(DATA_PATH)

from db import db # initialize db after data is reset (so we start fresh)

PORT = int(os.getenv('BACKEND_PORT', 5050))

app = Flask(__name__)
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['CORS_RESOURCES'] = {r"/*": {"origins": "*"}}
app.config['CORS_SUPPORTS_CREDENTIALS'] = True

CORS(app)

def extract_image_text(image_file):
	"""Extract text from image file using EasyOCR."""
	if not EASYOCR_AVAILABLE or ocr_reader is None:
		return f"[Image OCR unavailable - easyocr not installed]"
	
	try:
		# Read image file into memory
		image_data = image_file.read()
		image_file.seek(0)
		
		# Convert bytes to PIL Image
		image = Image.open(io.BytesIO(image_data))
		
		# Convert to RGB if necessary (handles RGBA, grayscale, etc.)
		if image.mode != 'RGB':
			image = image.convert('RGB')
		
		# Convert to numpy array for easyocr
		image_array = np.array(image)
		
		# Run OCR with confidence threshold
		ocr_result = ocr_reader.readtext(image_array, detail=1)
		
		# Extract text from results (ocr_result is list of tuples: (bbox, text, confidence))
		if not ocr_result:
			return f"[Image File: {image_file.filename}]\nNo text detected in image."
		
		# Extract text with confidence filtering
		text_lines = [item[1] for item in ocr_result if item[2] > 0.3]  # confidence > 0.3
		text = '\n'.join(text_lines)
		
		if not text.strip():
			return f"[Image File: {image_file.filename}]\nNo text detected in image."
		
		return text
	except Exception as e:
		print(f"Image OCR Error for {image_file.filename}: {str(e)}")
		return f"[Image OCR Error: {str(e)}]"

def extract_pdf_text(pdf_file):
	"""Extract text from PDF file using pypdf and EasyOCR fallback."""
	if not PDF_AVAILABLE:
		return f"[PDF processing unavailable - pypdf not installed]"
	
	try:
		# Save file position to restore later
		original_pos = pdf_file.stream.tell() if hasattr(pdf_file, 'stream') else 0
		
		pdf_reader = pypdf.PdfReader(pdf_file)
		text = ""
		
		for page_num, page in enumerate(pdf_reader.pages):
			try:
				# Try text extraction first
				page_text = page.extract_text()
				
				if page_text and page_text.strip():
					text += f"\n--- Page {page_num + 1} ---\n"
					text += page_text
				else:
					# If no text extracted, try EasyOCR fallback on the page
					if EASYOCR_AVAILABLE and ocr_reader is not None:
						text += f"\n--- Page {page_num + 1} (OCR) ---\n"
						try:
							# Try to render PDF page to image for OCR
							try:
								import fitz  # pymupdf
								pdf_file.seek(0)
								doc = fitz.open(stream=pdf_file.read(), filetype="pdf")
								page_image = doc[page_num].get_pixmap(matrix=fitz.Matrix(2, 2))
								
								# Convert pixmap to numpy array
								image_data = page_image.tobytes("ppm")
								image = Image.open(io.BytesIO(image_data))
								image_array = np.array(image)
								
								# Run OCR on the page image
								ocr_result = ocr_reader.readtext(image_array, detail=1)
								ocr_text = '\n'.join([item[1] for item in ocr_result if item[2] > 0.3])
								text += ocr_text if ocr_text.strip() else "[No text detected on page]\n"
								doc.close()
							except ImportError:
								text += "[pymupdf not installed - cannot OCR scanned PDF pages]\n"
						except Exception as ocr_error:
							text += f"[OCR failed for page {page_num + 1}: {str(ocr_error)}]\n"
					else:
						text += f"[No text on page {page_num + 1}]\n"
			except Exception as e:
				text += f"[Failed to extract page {page_num + 1}: {str(e)}]\n"
		
		return text if text.strip() else "[PDF file had no extractable text]"
	except Exception as e:
		print(f"PDF processing error: {str(e)}")
		return f"[Failed to process PDF: {str(e)}]"

def extract_docx_text(doc_file):
	"""Extract text from DOCX/DOC file."""
	if not DOCX_AVAILABLE:
		return f"[DOCX processing unavailable - python-docx not installed]"
	
	try:
		# Get filename
		filename = getattr(doc_file, 'filename', 'document')
		file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
		
		# Handle old .doc format (binary)
		if file_extension == 'doc':
			return handle_old_doc_format(doc_file, filename)
		
		# Handle .docx format (modern XML-based)
		# Read file into memory
		file_data = doc_file.read()
		doc_file.seek(0)  # Reset file position
		
		# Load document from bytes
		doc = docx.Document(io.BytesIO(file_data))
		
		# Extract all text from paragraphs
		text_parts = []
		
		# Extract paragraphs
		for paragraph in doc.paragraphs:
			if paragraph.text.strip():
				text_parts.append(paragraph.text)
		
		# Extract text from tables
		for table in doc.tables:
			for row in table.rows:
				row_text = []
				for cell in row.cells:
					if cell.text.strip():
						row_text.append(cell.text.strip())
				if row_text:
					text_parts.append(' | '.join(row_text))
		
		# Extract text from headers and footers
		for section in doc.sections:
			# Header
			if section.header:
				for paragraph in section.header.paragraphs:
					if paragraph.text.strip():
						text_parts.append(f"[Header: {paragraph.text}]")
			
			# Footer
			if section.footer:
				for paragraph in section.footer.paragraphs:
					if paragraph.text.strip():
						text_parts.append(f"[Footer: {paragraph.text}]")
		
		# Combine all text
		text = '\n'.join(text_parts)
		
		if not text.strip():
			return f"[Document File: {filename}]\nNo text detected in document."
		
		return text
		
	except Exception as e:
		print(f"DOCX processing error for {filename}: {str(e)}")
		return f"[Failed to process document: {str(e)}]"


def handle_old_doc_format(doc_file, filename):
	"""Handle old .doc format (binary/OLE format)."""
	# Old .doc files are complex binary format
	# Best approach: inform user to convert to .docx or use OCR on PDF export
	
	return f"[Old .doc format detected for {filename}. Please convert to .docx or PDF for better text extraction.]"


def extract_document_text(doc_file):
	"""
	Unified function to extract text from various document formats.
	Automatically detects format based on file extension.
	"""
	filename = getattr(doc_file, 'filename', 'document')
	file_extension = filename.lower().split('.')[-1] if '.' in filename else ''
	
	if file_extension in ['docx', 'doc']:
		return extract_docx_text(doc_file)
	elif file_extension == 'pdf':
		return extract_pdf_text(doc_file)
	elif file_extension in ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff']:
		return extract_image_text(doc_file)
	else:
		return f"[Unsupported file format: {file_extension}]"

@app.route('/')
def home():
	return jsonify({'message': 'Welcome to the Chat API!'})

@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
	session_id = request.headers.get('Session-ID')

	# make session folder if not exists
	session_folder = os.path.join(DATA_PATH, session_id)
	if not os.path.exists(session_folder):
		os.makedirs(session_folder)

	# Handle both JSON and FormData requests
	message = None
	files = []
	file_contents = {}
	urls = []
	
	if request.is_json:
		# Handle JSON request
		data = request.get_json()
		message = data.get('message')
		selected_sources = data.get('selectedSources', [])
	else:
		# Handle FormData request (for file uploads)
		message = request.form.get('message')
		
		# Parse JSON fields from form data
		selected_sources_str = request.form.get('selectedSources', '[]')
		try: 
			selected_sources = json.loads(selected_sources_str)
		except json.JSONDecodeError:
			selected_sources = []

	print("Message:", message)
	print("Selected Sources:", selected_sources)

	if not message:
		return jsonify({'error': 'Input is required'}), 400
	if not session_id or session_id.strip() == "":
		return jsonify({'error': 'Session-ID header is required'}), 400

	print("chat request for session:", session_id)

	# Pass files and file_contents to chat function
	source_names = [f"data/{session_id}/{src['name']}.md" for src in selected_sources if src]
	sources = [{'name': source_names[idx], 'size': selected_sources[idx]['size']} for idx in range(len(selected_sources)) if selected_sources[idx]]
	reply = chat(message, session_id=session_id, db=db, selected_sources=sources)
	return jsonify({'reply': reply})

# upload/delete/get sources
@app.route('/api/sources', methods=['POST', 'DELETE', 'GET'])
def source_endpoint():
	session_id = request.headers.get('Session-ID')
	if not session_id or session_id.strip() == "":
		return jsonify({'error': 'Session-ID header is required'}), 400
	
	if request.method == 'DELETE':
		# delete file by filename
		filename = request.args.get('filename')
		if not filename:
			return jsonify({'error': 'filename parameter is required for DELETE'}), 400
		session_folder = os.path.join(DATA_PATH, session_id)
		file_path = os.path.join(session_folder, filename + '.md')
		if os.path.exists(file_path):
			os.remove(file_path)
			# TODO: also remove from chroma vector store
			remove_documents_by_source(db, file_path)
			return jsonify({'message': f'File {filename} deleted from session {session_id}'}), 200
		else:
			return jsonify({'error': f'File {filename} not found in session {session_id}'}), 404
	elif request.method == 'POST':
		if 'file' not in request.files:
			return jsonify({'error': 'No file part in the request'}), 400

		file = request.files['file']
		if file.filename == '':
			return jsonify({'error': 'No selected file'}), 400
		
		# use ocr to extract text if image, pdf, or docx
		extracted_text = extract_document_text(file)
		print(f"Extracted text from {file.filename}:\n{extracted_text[:500]}...")  # Print first 500 chars

		# store file in data folder in session subfolder as .md file with extracted text
		session_folder = os.path.join(DATA_PATH, session_id)
		if not os.path.exists(session_folder):
			os.makedirs(session_folder)
		file_path = os.path.join(session_folder, f"{file.filename}.md")
		with open(file_path, 'w') as f:
			f.write(extracted_text)
   
		# save to chroma vector store as well
		add_single_document(db, embeddings, filepath=file_path)
		return jsonify({'message': f'File saved to {file_path}'}), 200
	elif request.method == 'GET':
		# list files in session folder
		session_folder = os.path.join(DATA_PATH, session_id)
		if not os.path.exists(session_folder):
			return jsonify({'files': []}), 200
		file_names = [f[:-3] for f in os.listdir(session_folder) if f.endswith('.md')]
		extensions = [file.rsplit('.', 1)[-1].lower() for file in file_names]
		files = [{'name': name, 'extension': ext} for name, ext in zip(file_names, extensions)]
		return jsonify({'files': files}), 200

# get all sessions endpoint
@app.route('/api/sessions', methods=['GET'])
def sessions_endpoint():
	sessions = []
	if os.path.exists(DATA_PATH):
		sessions = [name for name in os.listdir(DATA_PATH) if os.path.isdir(os.path.join(DATA_PATH, name))]
	return jsonify({'sessions': sessions}), 200

# get/clear session history endpoint
@app.route('/api/history', methods=['GET', 'DELETE'])
def history_endpoint():
	session_id = request.headers.get('Session-ID')
	print("history request for session:", session_id)
	if not session_id:
		return jsonify({'error': 'Session-ID header is required'}), 400
	
	if request.method == 'DELETE':
		clear_session(session_id)
		# also delete session folder
		session_folder = os.path.join(DATA_PATH, session_id)
		if os.path.exists(session_folder):
			shutil.rmtree(session_folder)
			print("Cleared history for session:", session_id)
			return jsonify({'message': 'Session cleared'}), 200
		else:
			return jsonify({'message': 'Session folder not found, but history cleared'}), 200
	
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
		session_history = get_session_history(session_id)
		history = session_history.get_messages_with_timestamps()
		print("Fetched history for session:", session_id, history)
		history_serialized = [
			{
				'id': str(index),
				'role': 'assistant' if isinstance(msg, AIMessage) else 'user',
				'content': msg.content,
				'originalInput': session_history.get_message_metadata(index).get('originalInput'),
				'sources': session_history.get_message_metadata(index).get('sources', []),
				'timestamp': timestamp.isoformat(),
				'isStreaming': False,
				'truncatedContent': msg.content,
				'fileMetadata': session_history.get_message_metadata(index).get('fileMetadata'),
				'urls': session_history.get_message_metadata(index).get('urls'),
			}
			for (index, (msg, timestamp)) in enumerate(history)
		]
		return jsonify({'history': history_serialized}), 200

if __name__ == '__main__':
	app.run(port=PORT, debug=True)