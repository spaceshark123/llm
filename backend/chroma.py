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
CHROMA_PATH = os.getenv("CHROMA_PATH", "chroma")
CHUNK_SIZE = 300
CHUNK_OVERLAP = 100
METADATA_FILE = os.path.join(CHROMA_PATH, "processed_files.txt")

embeddings = HuggingFaceEmbeddings(
    model_name="all-mpnet-base-v2",
    model_kwargs={'device': 'cpu'},
    encode_kwargs={'normalize_embeddings': True}
)
print("Initialized HuggingFaceEmbeddings")

def get_file_hash(filepath: str) -> str:
    """Generate a hash of file contents to detect changes."""
    with open(filepath, 'rb') as f:
        return hashlib.md5(f.read()).hexdigest()

def load_processed_files() -> dict:
    """Load the record of previously processed files and their hashes."""
    if not os.path.exists(METADATA_FILE):
        return {}
    
    processed = {}
    with open(METADATA_FILE, 'r') as f:
        for line in f:
            if line.strip():
                filepath, file_hash = line.strip().split('|')
                processed[filepath] = file_hash
    return processed

def save_processed_files(processed: dict):
    """Save the record of processed files."""
    os.makedirs(CHROMA_PATH, exist_ok=True)
    with open(METADATA_FILE, 'w') as f:
        for filepath, file_hash in processed.items():
            f.write(f"{filepath}|{file_hash}\n")

def get_new_or_modified_files(processed_files: dict) -> list[str]:
    """Identify new or modified files in the data directory."""
    new_or_modified = []
    
    for filepath in Path(DATA_PATH).glob("*.md"):
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

def load_all_documents():
    """Load all documents from the data directory."""
    loader = DirectoryLoader(DATA_PATH, glob="*.md")
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

def get_or_create_db() -> Chroma:
    """Get existing Chroma DB or create a new one."""
    if os.path.exists(CHROMA_PATH):
        # Load existing database
        db = Chroma(
            persist_directory=CHROMA_PATH,
            embedding_function=embeddings
        )
        print(f"Loaded existing database from {CHROMA_PATH}")
        return db
    else:
        # Create new empty database
        os.makedirs(CHROMA_PATH, exist_ok=True)
        db = Chroma(
            persist_directory=CHROMA_PATH,
            embedding_function=embeddings
        )
        print(f"Created new database at {CHROMA_PATH}")
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

def add_documents_to_chroma(chunks: list[Document]):
    """Add new document chunks to existing Chroma DB."""
    if not chunks:
        print("No chunks to add.")
        return
    
    db = get_or_create_db()
    
    # Group chunks by source to handle updates
    sources = set(chunk.metadata.get('source', '') for chunk in chunks)
    
    # Remove old versions of updated documents
    for source in sources:
        remove_documents_by_source(db, source)
        
    print(f"Removed old chunks for sources: {sources}")
    
    # Add new chunks
    db.add_documents(chunks)
    print(f"Added {len(chunks)} chunks to {CHROMA_PATH}.")

def rebuild_database():
    """Completely rebuild the database from scratch."""
    # Clear out the database
    if os.path.exists(CHROMA_PATH):
        shutil.rmtree(CHROMA_PATH)
    
    documents = load_all_documents()
    chunks = split_text(documents)
    
    # Create new DB
    db = Chroma.from_documents(
        chunks, embeddings, persist_directory=CHROMA_PATH
    )
    print(f"Rebuilt database with {len(chunks)} chunks.")
    
    # Update processed files record
    processed = {}
    for filepath in Path(DATA_PATH).glob("*.md"):
        processed[str(filepath)] = get_file_hash(str(filepath))
    save_processed_files(processed)

def update_database():
    """Update the database with new or modified documents only."""
    processed_files = load_processed_files()
    new_or_modified = get_new_or_modified_files(processed_files)
    
    if not new_or_modified:
        print("No new or modified files. Database is up to date.")
        return
    
    print(f"Found {len(new_or_modified)} new or modified files:")
    for filepath in new_or_modified:
        print(f"  - {filepath}")
    
    # Load and process only new/modified documents
    documents = load_specific_documents(new_or_modified)
    chunks = split_text(documents)
    
    # Add to existing database
    add_documents_to_chroma(chunks)
    
    # Update processed files record
    for filepath in new_or_modified:
        processed_files[filepath] = get_file_hash(filepath)
    save_processed_files(processed_files)
    
    print("Database update complete!")

def add_single_document(filepath: str):
    """Add or update a single document in the database."""
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
    
    print(f"Processing file: {filepath}")
    
    # Load and process the document
    documents = load_specific_documents([filepath])
    chunks = split_text(documents)
    
    # Add to database
    add_documents_to_chroma(chunks)
    
    # Update processed files record
    processed_files = load_processed_files()
    processed_files[filepath] = get_file_hash(filepath)
    save_processed_files(processed_files)
    
    print(f"Successfully added/updated: {filepath}")

# Main execution
if __name__ == "__main__":
    import sys
    
    if len(sys.argv) > 1:
        command = sys.argv[1]
        
        if command == "rebuild":
            # Rebuild entire database
            rebuild_database()
        elif command == "update":
            # Update with new/modified files
            update_database()
        elif command == "add" and len(sys.argv) > 2:
            # Add specific file
            filepath = sys.argv[2]
            add_single_document(filepath)
        else:
            print("Usage:")
            print("  python script.py rebuild  - Rebuild entire database")
            print("  python script.py update   - Update with new/modified files")
            print("  python script.py add <filepath> - Add specific file")
    else:
        # Default: update database
        update_database()