import shutil
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import DirectoryLoader
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
import os
import hashlib
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
DATA_PATH = os.getenv("DATA_PATH", "data")
CHROMA_BASE_PATH = os.getenv("CHROMA_PATH", "chroma")
CHUNK_SIZE = 300
CHUNK_OVERLAP = 100

def initialize_embeddings():
	"""Initialize the HuggingFace embeddings."""
	embeddings = HuggingFaceEmbeddings(
		model_name="all-mpnet-base-v2",
		model_kwargs={'device': 'cpu'},
		encode_kwargs={'normalize_embeddings': True}
	)
	return embeddings

def get_file_hash(filepath: str) -> str:
	"""Generate a hash of file contents to detect changes."""
	with open(filepath, 'rb') as f:
		return hashlib.md5(f.read()).hexdigest()

def get_session_chroma_path(session_id: str) -> str:
	"""Get the chroma database path for a specific session."""
	return os.path.join(CHROMA_BASE_PATH, session_id)

def get_session_metadata_file(session_id: str) -> str:
	"""Get the metadata file path for a specific session."""
	return os.path.join(get_session_chroma_path(session_id), "processed_files.txt")

def load_processed_files(session_id: str) -> dict:
	"""Load the record of previously processed files and their hashes."""
	metadata_file = get_session_metadata_file(session_id)
	if not os.path.exists(metadata_file):
		return {}
	
	processed = {}
	with open(metadata_file, 'r') as f:
		for line in f:
			if line.strip():
				filepath, file_hash = line.strip().split('|')
				processed[filepath] = file_hash
	return processed

def save_processed_files(session_id: str, processed: dict):
	"""Save the record of processed files."""
	chroma_path = get_session_chroma_path(session_id)
	os.makedirs(chroma_path, exist_ok=True)
	metadata_file = get_session_metadata_file(session_id)
	with open(metadata_file, 'w') as f:
		for filepath, file_hash in processed.items():
			f.write(f"{filepath}|{file_hash}\n")

def get_new_or_modified_files(session_id: str, processed_files: dict) -> list[str]:
	"""Identify new or modified files in the session's data directory."""
	new_or_modified = []
	session_data_path = os.path.join(DATA_PATH, session_id)
	
	if not os.path.exists(session_data_path):
		return []
	
	for filepath in Path(session_data_path).glob("*.md"):
		filepath_str = str(filepath)
		current_hash = get_file_hash(filepath_str)
		
		# File is new or modified
		if filepath_str not in processed_files or processed_files[filepath_str] != current_hash:
			new_or_modified.append(filepath_str)
	
	return new_or_modified

def load_specific_documents(filepaths: list[str]) -> list[Document]:
	"""Load specific documents by filepath."""
	documents = []
	for filepath in filepaths:
		loader = DirectoryLoader(
			os.path.dirname(filepath),
			glob=os.path.basename(filepath)
		)
		documents.extend(loader.load())
	return documents

def load_all_documents(session_id: str):
	"""Load all documents from the session's data directory."""
	session_data_path = os.path.join(DATA_PATH, session_id)
	if not os.path.exists(session_data_path):
		return []
	loader = DirectoryLoader(session_data_path, glob="*.md")
	documents = loader.load()
	return documents

def split_text(documents: list[Document]) -> list[Document]:
	"""Split documents into chunks."""
	text_splitter = RecursiveCharacterTextSplitter(
		chunk_size=CHUNK_SIZE,
		chunk_overlap=CHUNK_OVERLAP,
		length_function=len,
		add_start_index=True,
	)
	chunks = text_splitter.split_documents(documents)
	print(f"Split {len(documents)} documents into {len(chunks)} chunks.")
	
	if chunks:
		document = chunks[0]
		print("Sample chunk:")
		print(document.page_content)
		print(document.metadata)
	
	return chunks

def get_or_create_db(embeddings: HuggingFaceEmbeddings, session_id: str) -> Chroma:
	"""Get existing Chroma DB for a session or create a new one."""
	chroma_path = get_session_chroma_path(session_id)
	if os.path.exists(chroma_path):
		# Load existing database
		db = Chroma(
			persist_directory=chroma_path,
			embedding_function=embeddings
		)
		print(f"Loaded existing database from {chroma_path}")
		return db
	else:
		# Create new empty database
		os.makedirs(chroma_path, exist_ok=True)
		db = Chroma(
			persist_directory=chroma_path,
			embedding_function=embeddings
		)
		print(f"Created new database at {chroma_path}")
		return db

def remove_documents_by_source(db: Chroma, source: str):
	"""Remove all chunks from a specific source document."""
	try:
		# Get all documents with this source
		results = db.get(where={"source": source})
		if results['ids']:
			db.delete(ids=results['ids'])
			print(f"Removed {len(results['ids'])} chunks from {source}")
	except Exception as e:
		print(f"Error removing documents: {e}")

def add_documents_to_chroma(db: Chroma, embeddings: HuggingFaceEmbeddings, chunks: list[Document]):
	"""Add new document chunks to existing Chroma DB."""
	if not chunks:
		print("No chunks to add.")
		return
	
	# Group chunks by source to handle updates
	sources = set(chunk.metadata.get('source', '') for chunk in chunks)
	
	# Remove old versions of updated documents
	for source in sources:
		remove_documents_by_source(db, source)
		
	print(f"Removed old chunks for sources: {sources}")
	
	# Add new chunks
	db.add_documents(chunks)
	print(f"Added {len(chunks)} chunks to database.")

def rebuild_database(embeddings: HuggingFaceEmbeddings, session_id: str):
	"""Completely rebuild the database for a session from scratch."""
	# Clear out the database
	chroma_path = get_session_chroma_path(session_id)
	if os.path.exists(chroma_path):
		shutil.rmtree(chroma_path)
	
	documents = load_all_documents(session_id)
	chunks = split_text(documents)
	
	if not chunks:
		print(f"No documents to rebuild for session {session_id}")
		return
	
	# Create new DB
	db = Chroma.from_documents(
		chunks, embeddings, persist_directory=chroma_path
	)
	print(f"Rebuilt database with {len(chunks)} chunks.")
	
	# Update processed files record
	processed = {}
	session_data_path = os.path.join(DATA_PATH, session_id)
	if os.path.exists(session_data_path):
		for filepath in Path(session_data_path).glob("*.md"):
			processed[str(filepath)] = get_file_hash(str(filepath))
	save_processed_files(session_id, processed)

def update_database(db: Chroma, embeddings: HuggingFaceEmbeddings, session_id: str):
	"""Update the database with new or modified documents only."""
	processed_files = load_processed_files(session_id)
	new_or_modified = get_new_or_modified_files(session_id, processed_files)
	
	if not new_or_modified:
		print(f"No new or modified files for session {session_id}. Database is up to date.")
		return
	
	print(f"Found {len(new_or_modified)} new or modified files:")
	for filepath in new_or_modified:
		print(f"  - {filepath}")
	
	# Load and process only new/modified documents
	documents = load_specific_documents(new_or_modified)
	chunks = split_text(documents)
	
	# Add to existing database
	add_documents_to_chroma(db, embeddings, chunks)

	# Update processed files record
	for filepath in new_or_modified:
		processed_files[filepath] = get_file_hash(filepath)
	save_processed_files(session_id, processed_files)
	
	print(f"Database update complete for session {session_id}!")

def add_single_document(db: Chroma, embeddings: HuggingFaceEmbeddings, filepath: str, session_id: str):
	"""Add or update a single document in the database."""
	if not os.path.exists(filepath):
		print(f"File not found: {filepath}")
		return
	
	print(f"Processing file: {filepath}")
	
	# Load and process the document
	documents = load_specific_documents([filepath])
	chunks = split_text(documents)
	
	# Add to database
	add_documents_to_chroma(db, embeddings, chunks)

	# Update processed files record
	processed_files = load_processed_files(session_id)
	processed_files[filepath] = get_file_hash(filepath)
	save_processed_files(session_id, processed_files)
	
	print(f"Successfully added/updated: {filepath}")

# Main execution
if __name__ == "__main__":
	embeddings = initialize_embeddings()

	import sys
	
	if len(sys.argv) > 1:
		command = sys.argv[1]
		session_id = sys.argv[2] if len(sys.argv) > 2 else "default"
		
		if command == "rebuild":
			# Rebuild entire database
			rebuild_database(embeddings, session_id)
		elif command == "update":
			# Update with new/modified files
			db = get_or_create_db(embeddings, session_id)
			update_database(db, embeddings, session_id)
		elif command == "add" and len(sys.argv) > 3:
			# Add specific file
			filepath = sys.argv[3]
			db = get_or_create_db(embeddings, session_id)
			add_single_document(db, embeddings, filepath, session_id)
		else:
			print("Usage:")
			print("  python script.py rebuild <session_id>  - Rebuild entire database for session")
			print("  python script.py update <session_id>   - Update with new/modified files for session")
			print("  python script.py add <session_id> <filepath> - Add specific file to session")
	else:
		# Default: show usage
		print("Usage: Please specify command and session_id")