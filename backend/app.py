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

try:
	import pypdf
	PDF_AVAILABLE = True
except ImportError:
	PDF_AVAILABLE = False
	print("Warning: pypdf not installed. PDF processing will be limited.")

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

DATA_DIR = 'data'
if not os.path.exists(DATA_DIR):
	os.makedirs(DATA_DIR)

load_dotenv()
PORT = int(os.getenv('BACKEND_PORT', 5050))

app = Flask(__name__)
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['CORS_RESOURCES'] = {r"/*": {"origins": "*"}}
app.config['CORS_SUPPORTS_CREDENTIALS'] = True

CORS(app)

def extract_text_from_image(image_file):
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
					# Get file size before reading
					pdf_file.seek(0, os.SEEK_END)
					file_size = pdf_file.tell()
					pdf_file.seek(0)
					
					files.append({
						'name': pdf_file.filename,
						'type': 'application/pdf',
						'size': file_size
					})
		
		# Process uploaded image files (PNG, JPG, JPEG, GIF)
		if 'image_files' in request.files:
			image_files = request.files.getlist('image_files')
			for image_file in image_files:
				print(f"Processing uploaded image: {image_file.filename}")
				image_text = extract_text_from_image(image_file)
				file_contents[image_file.filename] = image_text
				
				# Add to file metadata if not already there
				file_exists = any(f['name'] == image_file.filename for f in files)
				if not file_exists:
					# Get file size before reading
					image_file.seek(0, os.SEEK_END)
					file_size = image_file.tell()
					image_file.seek(0)
					
					files.append({
						'name': image_file.filename,
						'type': image_file.content_type or 'image/unknown',
						'size': file_size
					})

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
	reply = chat(message, session_id=session_id, file_contents=file_contents, file_metadata=files, urls=urls)
	return jsonify({'reply': reply})

# upload/delete source
@app.route('/api/sources', methods=['POST', 'DELETE'])
def source_endpoint():
	session_id = request.headers.get('Session-ID')
	if not session_id or session_id.strip() == "":
		return jsonify({'error': 'Session-ID header is required'}), 400
	
	if request.method == 'DELETE':
		# delete file by filename
		filename = request.args.get('filename')
		if not filename:
			return jsonify({'error': 'filename parameter is required for DELETE'}), 400
		session_folder = os.path.join(DATA_DIR, session_id)
		file_path = os.path.join(session_folder, filename)
		if os.path.exists(file_path):
			os.remove(file_path)
			return jsonify({'message': f'File {filename} deleted from session {session_id}'}), 200
		else:
			return jsonify({'error': f'File {filename} not found in session {session_id}'}), 404
	elif request.method == 'POST':
		if 'file' not in request.files:
			return jsonify({'error': 'No file part in the request'}), 400

		file = request.files['file']
		if file.filename == '':
			return jsonify({'error': 'No selected file'}), 400
		
		# store file in data folder in session subfolder
		session_folder = os.path.join(DATA_DIR, session_id)
		if not os.path.exists(session_folder):
			os.makedirs(session_folder)
		file_path = os.path.join(session_folder, file.filename)
		file.save(file_path)
		return jsonify({'message': f'File saved to {file_path}'}), 200

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
		session_history = get_session_history(session_id)
		history = session_history.get_messages_with_timestamps()
		print("Fetched history for session:", session_id, history)
		history_serialized = [
			{
				'id': str(index),
				'role': 'assistant' if isinstance(msg, AIMessage) else 'user',
				'content': msg.content,
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