from chroma import get_or_create_db, get_session_chroma_path
from embeddings import embeddings
import os
from dotenv import load_dotenv
import shutil

# Load environment variables
load_dotenv()
CHROMA_BASE_PATH = os.getenv("CHROMA_PATH", "chroma")

# Cache for session databases to avoid recreating connections
_db_cache = {}

def get_session_db(session_id: str):
    """Get or create a Chroma database for a specific session."""
    if session_id not in _db_cache:
        _db_cache[session_id] = get_or_create_db(embeddings, session_id)
    return _db_cache[session_id]

def clear_session_db(session_id: str):
    """Clear the database for a specific session."""
    # Remove from cache
    if session_id in _db_cache:
        del _db_cache[session_id]
    
    # Delete the chroma directory for this session
    chroma_path = get_session_chroma_path(session_id)
    if os.path.exists(chroma_path):
        try:
            shutil.rmtree(chroma_path, ignore_errors=True)
            print(f"Cleared chroma database for session: {session_id}")
        except Exception as e:
            print(f"Warning: Could not clear chroma database for session {session_id}: {e}")

# Only clear all databases on first import, not on Flask reloads
# Use an environment variable to track this
if os.environ.get('CHROMA_DB_CLEARED') != 'true':
    if os.path.exists(CHROMA_BASE_PATH):
        try:
            shutil.rmtree(CHROMA_BASE_PATH, ignore_errors=True)
            os.environ['CHROMA_DB_CLEARED'] = 'true'
            print("Cleared all chroma databases on startup")
        except Exception as e:
            print(f"Warning: Could not clear CHROMA_BASE_PATH: {e}")
            os.environ['CHROMA_DB_CLEARED'] = 'true'