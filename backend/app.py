import shutil
from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import json
import io
import requests
from urllib.parse import urlparse, quote
import hashlib
from llm import chat, get_session_history, clear_session
from langchain_core.messages import HumanMessage, AIMessage
from dotenv import load_dotenv
from history import ChatMessageHistoryWithTimestamps
from chroma import add_single_document, rebuild_database, remove_documents_by_source
from embeddings import embeddings
from extractors import extract_document, extract_url as extract_url_from_module

load_dotenv()

DATA_PATH = os.getenv('DATA_PATH', 'data')
TEMP_PATH = os.getenv('TEMP_PATH', 'temp')
# clear and recreate data folder
if os.path.exists(DATA_PATH):
	shutil.rmtree(DATA_PATH)
os.makedirs(DATA_PATH)

from db import get_session_db, clear_session_db  # Import session-aware functions

PORT = int(os.getenv('BACKEND_PORT', 5050))

app = Flask(__name__)
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['CORS_RESOURCES'] = {r"/*": {"origins": "*"}}
app.config['CORS_SUPPORTS_CREDENTIALS'] = True

CORS(app)

def extract_document_text(doc_file):
	"""
	Unified function to extract text from various document formats.
	Delegates to the extractors module which handles all format detection and extraction.
	"""
	return extract_document(doc_file)


def extract_url_text(url: str) -> str:
	"""
	Extract text from URL.
	Delegates to the extractors module which handles both Selenium + OCR and BeautifulSoup fallback.
	"""
	return extract_url_from_module(url)

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

	# Get session-specific database
	session_db = get_session_db(session_id)

	# Pass files and file_contents to chat function
	# Use os.path.join to ensure correct path separators for the OS
	source_names = [os.path.join(DATA_PATH, session_id, f"{src['name']}.md") for src in selected_sources if src]
	sources = [{'name': source_names[idx], 'size': selected_sources[idx]['size']} for idx in range(len(selected_sources)) if selected_sources[idx]]
	print(f"Selected sources from frontend: {selected_sources}")
	print(f"Constructed source paths: {source_names}")
	
	# Verify that the source files actually exist
	for source_path in source_names:
		if os.path.exists(source_path):
			print(f"Found: {source_path}")
		else:
			print(f"Missing: {source_path}")
	
	reply = chat(message, session_id=session_id, db=session_db, selected_sources=sources)
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
			# Remove from session's chroma vector store
			session_db = get_session_db(session_id)
			remove_documents_by_source(session_db, file_path)
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
		with open(file_path, 'w', encoding='utf-8') as f:
			f.write(extracted_text)
   
		# save to chroma vector store as well
		session_db = get_session_db(session_id)
		add_single_document(session_db, embeddings, filepath=file_path, session_id=session_id)
		return jsonify({'message': f'File saved to {file_path}'}), 200
	elif request.method == 'GET':
		# list files in session folder (excluding .web.md files - those are listed via /api/urls)
		session_folder = os.path.join(DATA_PATH, session_id)
		if not os.path.exists(session_folder):
			return jsonify({'files': []}), 200
		# Only include .md files that are NOT .web.md files
		file_names = [f[:-3] for f in os.listdir(session_folder) if f.endswith('.md') and not f.endswith('.web.md')]
		extensions = [file.rsplit('.', 1)[-1].lower() for file in file_names]
		files = [{'name': name, 'extension': ext} for name, ext in zip(file_names, extensions)]
		return jsonify({'files': files}), 200

# URL management endpoint
@app.route('/api/urls', methods=['POST', 'DELETE', 'GET'])
def url_endpoint():
	print(f"========== /api/urls {request.method} request received ==========")
	session_id = request.headers.get('Session-ID')
	
	# Allow empty session for POST - we'll create one automatically
	if request.method == 'POST' and (not session_id or session_id.strip() == ""):
		# Generate a new session ID
		import time
		session_id = f"session-{int(time.time() * 1000)}"
		print(f"No session provided, created new session: {session_id}")
	elif not session_id or session_id.strip() == "":
		return jsonify({'error': 'Session-ID header is required'}), 400
	
	print(f"Session ID: {session_id}")
	
	# Create session folder if it doesn't exist
	session_folder = os.path.join(DATA_PATH, session_id)
	if not os.path.exists(session_folder):
		os.makedirs(session_folder)
		print(f"Created session folder: {session_folder}")
	
	if request.method == 'DELETE':
		# Delete URL by filename
		url_hash = request.args.get('urlHash')
		if not url_hash:
			return jsonify({'error': 'urlHash parameter is required for DELETE'}), 400
		
		file_path = os.path.join(session_folder, f"{url_hash}.web.md")
		if os.path.exists(file_path):
			os.remove(file_path)
			# Remove from session's chroma vector store
			session_db = get_session_db(session_id)
			remove_documents_by_source(session_db, file_path)
			return jsonify({'message': f'URL deleted from session {session_id}'}), 200
		else:
			return jsonify({'error': f'URL not found in session {session_id}'}), 404
			
	elif request.method == 'POST':
		try:
			data = request.get_json()
			print(f"Received POST data: {data}")
			url = data.get('url')
			
			if not url:
				print("ERROR: No URL provided in request")
				return jsonify({'error': 'URL is required'}), 400
			
			# Validate URL
			try:
				parsed = urlparse(url)
				if not parsed.scheme or not parsed.netloc:
					return jsonify({'error': 'Invalid URL format'}), 400
			except Exception:
				return jsonify({'error': 'Invalid URL format'}), 400
			
			print(f"Processing URL: {url}")
			
			# Extract text from URL
			extracted_text = extract_url_text(url)
			print(f"Extracted text from {url}:\n{extracted_text[:500]}...")  # Print first 500 chars
			
			# Create a hash of the URL for the filename
			url_hash = hashlib.md5(url.encode()).hexdigest()[:12]
			
			# Store as .web.md file
			file_path = os.path.join(session_folder, f"{url_hash}.web.md")
			print(f"Saving URL content to: {file_path}")
			with open(file_path, 'w', encoding='utf-8') as f:
				f.write(f"URL: {url}\n\n{extracted_text}")
			
			print(f"File saved, size: {os.path.getsize(file_path)} bytes")
			
			# Add to chroma vector store
			session_db = get_session_db(session_id)
			print(f"Adding to vector store for session: {session_id}")
			add_single_document(session_db, embeddings, filepath=file_path, session_id=session_id)
			
			print(f"URL processing complete: {url_hash}.web")
			return jsonify({
				'message': 'URL processed successfully',
				'urlHash': url_hash,
				'url': url,
				'name': f"{url_hash}.web",
				'sessionId': session_id  # Return session ID in case it was auto-created
			}), 200
			
		except Exception as e:
			print(f"ERROR in URL POST: {str(e)}")
			import traceback
			traceback.print_exc()
			return jsonify({'error': f'Failed to process URL: {str(e)}'}), 500
		
	elif request.method == 'GET':
		# List all URLs in session
		print(f"GET URLs - checking folder: {session_folder}")
		if not os.path.exists(session_folder):
			print("Session folder doesn't exist, returning empty list")
			return jsonify({'urls': []}), 200
		
		urls = []
		all_files = os.listdir(session_folder)
		print(f"Files in session folder: {all_files}")
		
		for filename in all_files:
			if filename.endswith('.web.md'):
				print(f"Found URL file: {filename}")
				file_path = os.path.join(session_folder, filename)
				try:
					# Read the first line to get the URL
					with open(file_path, 'r', encoding='utf-8') as f:
						first_line = f.readline().strip()
						if first_line.startswith('URL: '):
							original_url = first_line[5:]  # Remove 'URL: ' prefix
							url_hash = filename[:-7]  # Remove '.web.md'
							url_obj = {
								'url': original_url,
								'urlHash': url_hash,
								'name': f"{url_hash}.web"
							}
							print(f"  Returning URL object: {url_obj}")
							urls.append(url_obj)
				except Exception as e:
					print(f"Error reading URL file {filename}: {e}")
					continue
		
		print(f"Returning {len(urls)} URLs")
		return jsonify({'urls': urls}), 200
	
	elif request.method == 'DELETE':
		# Delete URL by urlHash
		url_hash = request.args.get('urlHash')
		if not url_hash:
			return jsonify({'error': 'urlHash parameter is required'}), 400
		
		print(f"DELETE URL - urlHash: {url_hash}")
		file_path = os.path.join(session_folder, f"{url_hash}.web.md")
		
		if not os.path.exists(file_path):
			print(f"URL file not found: {file_path}")
			return jsonify({'error': 'URL not found'}), 404
		
		try:
			# Remove from vector store first
			session_db = get_session_db(session_id)
			remove_documents_by_source(session_db, file_path)
			print(f"Removed URL from vector store: {file_path}")
			
			# Then delete the file
			os.remove(file_path)
			print(f"Deleted URL file: {file_path}")
			return jsonify({'message': 'URL deleted successfully'}), 200
		except Exception as e:
			print(f"Error deleting URL: {e}")
			import traceback
			traceback.print_exc()
			return jsonify({'error': f'Failed to delete URL: {str(e)}'}), 500

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
		# Clear session-specific chroma database
		clear_session_db(session_id)
		# also delete session folder
		session_folder = os.path.join(DATA_PATH, session_id)
		if os.path.exists(session_folder):
			shutil.rmtree(session_folder)
			print("Cleared history and database for session:", session_id)
			return jsonify({'message': 'Session cleared'}), 200
		else:
			return jsonify({'message': 'Session folder not found, but history and database cleared'}), 200
	
	if request.method == 'GET':
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
				'urls': session_history.get_message_metadata(index).get('urls', []),
			}
			for (index, (msg, timestamp)) in enumerate(history)
		]
		for item in history_serialized:
			# for each fileMetadata item with .web, that file came from a URL, and the first line is the original URL, which we can extract
			if item['fileMetadata']:
				urls = []
				for file_meta in item['fileMetadata']:
					if '.web' in file_meta['name']:
						# read first line of the file to get original URL
						try:
							with open(file_meta['name'], 'r', encoding='utf-8') as f:
								first_line = f.readline().strip()
								if first_line.startswith('URL: '):
									original_url = first_line[5:]  # Remove 'URL: ' prefix
									urls.append(original_url)
						except Exception as e:
							print(f"Error reading URL from file {file_meta['name']}: {e}")
							continue
				item['urls'] = urls
			# do same for 'sources' field, but replace the original source instead of setting a separate 'urls' field
			if item['sources']:
				updated_sources = []
				for source in item['sources']:
					if '.web' in source:
						# read first line of the file to get original URL
						session_folder = os.path.join(DATA_PATH, session_id)
						file_path = os.path.join(session_folder, source)
						# add .md extension
						file_path_md = file_path + '.md'
						try:
							with open(file_path_md, 'r', encoding='utf-8') as f:
								first_line = f.readline().strip()
								if first_line.startswith('URL: '):
									original_url = first_line[5:]  # Remove 'URL: ' prefix
									updated_sources.append(original_url)
						except Exception as e:
							print(f"Error reading URL from source file {source}: {e}")
							continue
					else:
						updated_sources.append(source)
				item['sources'] = updated_sources
		return jsonify({'history': history_serialized}), 200

if __name__ == '__main__':
	app.run(port=PORT, debug=True)