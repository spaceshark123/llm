from chroma import get_or_create_db
from embeddings import embeddings
import os
from dotenv import load_dotenv
import shutil

# Load environment variables
load_dotenv()
CHROMA_PATH = os.getenv("CHROMA_PATH", "chroma")

# clear chroma db
if os.path.exists(CHROMA_PATH):
    shutil.rmtree(CHROMA_PATH)

db = get_or_create_db(embeddings)