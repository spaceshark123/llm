from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_chroma import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import DirectoryLoader
import os
from dotenv import load_dotenv
from history import ChatMessageHistoryWithTimestamps
from chroma import initialize_embeddings, get_or_create_db
from embeddings import embeddings

# Load environment variables
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in environment variables.")

TEMPERATURE = float(os.getenv("TEMPERATURE", "0.7"))
MODEL_NAME = os.getenv("MODEL_NAME", "llama-3.1-8b-instant")
CHROMA_PATH = os.getenv("CHROMA_PATH", "chroma")
RAG_ENABLED = os.getenv("RAG_ENABLED", "true").lower() == "true"
RAG_TOP_K = int(os.getenv("RAG_TOP_K", "5"))
SYSTEM_PROMPT = """You are a helpful and knowledgeable AI assistant. Respond in markdown.

When provided with context from documents, use that information to answer questions accurately.
If the context doesn't contain relevant information, say so and answer based on your general knowledge."""

current_llm = None
available_models = ["llama-3.1-8b-instant", "llama-3.3-70b-versatile", "openai/gpt-oss-120b", "groq/compound"]
VALID_MODELS = ["allam-2-7b",  "groq/compound",  "groq/compound-mini",  "llama-3.1-8b-instant",  "llama-3.3-70b-versatile",  "meta-llama/llama-4-maverick-17b-128e-instruct",  "meta-llama/llama-4-scout-17b-16e-instruct",  "meta-llama/llama-guard-4-12b",  "meta-llama/llama-prompt-guard-2-22m",  "meta-llama/llama-prompt-guard-2-86m",  "moonshotai/kimi-k2-instruct",  "moonshotai/kimi-k2-instruct-0905",  "openai/gpt-oss-120b",  "openai/gpt-oss-20b",  "openai/gpt-oss-safeguard-20b",  "playai-tts",  "playai-tts-arabic",  "qwen/qwen3-32b",  "whisper-large-v3",  "whisper-large-v3-turbo"]

def rebuild_chain():
    """Rebuild the chain with the current LLM model."""
    initialize_chain()

def set_model(model_name: str):
    """Switch the LLM model at runtime."""
    global current_llm, MODEL_NAME
    if model_name not in available_models:
        raise ValueError(f"Model {model_name} is not available.")
    MODEL_NAME = model_name
    rebuild_chain()
    return model_name

def add_model(model_name: str):
    """Add a new model to the available models list."""
    global available_models
    if not model_name or not isinstance(model_name, str):
        raise ValueError("Model name must be a non-empty string.")
    if model_name in available_models:
        raise ValueError(f"Model {model_name} is already in the available models list.")
    available_models.append(model_name)
    print(f"Added model {model_name} to available models. Current list: {available_models}")
    return model_name

# Session store (for conversation histories)
store = {}

print(f"RAG Enabled: {RAG_ENABLED}")

def retrieve_context(db: Chroma, query: str, top_k: int = RAG_TOP_K, selected_sources: list = None, source_name_mapping: dict = None) -> tuple[str, list[dict]]:
    """Retrieve relevant context from the vector store.
    
    Returns:
        tuple: (context_text, sources_metadata)
    """
    if not db:
        return "", []
    
    try:
        # Search for relevant documents
        print(f"RAG: Searching with filter: {selected_sources if selected_sources else 'No filter'}")
        results = db.similarity_search_with_score(query, k=top_k, filter={"source": {"$in": selected_sources}} if selected_sources else None)
        
        print(f"RAG: Found {len(results)} results")
        if not results:
            return "", []
        
        # Format context
        context_parts = []
        sources = []
        
        for i, (doc, distance) in enumerate(results, 1):
            # Extract source info
            source = doc.metadata.get('source', 'Unknown')
            source_original = source
            if source_name_mapping and source in source_name_mapping:
                source = source_name_mapping[source]
            # Add document content
            context_parts.append(f"[Document {i} - {source}]\n{doc.page_content}\n")
            
            # Convert L2 distance to similarity score (0-1 range)
            # Formula: similarity = 1 / (1 + distance)
            similarity_score = 1 / (1 + float(distance))
            
            sources.append({
                'name': os.path.basename(source_original),
                'path': source_original,
                'score': similarity_score
            })
        
        context_text = "\n".join(context_parts)
        return context_text, sources
        
    except Exception as e:
        print(f"Error retrieving context: {e}")
        return "", []

def get_session_history(session_id: str) -> ChatMessageHistoryWithTimestamps:
    """Return or create message history for a session."""
    if session_id not in store:
        store[session_id] = ChatMessageHistoryWithTimestamps()
    return store[session_id]

def chat(input_str: str, session_id: str = "default", db: Chroma = None, selected_sources: list = None, source_name_mapping: dict = None) -> str:
    """Send a message and get a response with conversation history.
    
    Args:
        input_str: The user's message
        session_id: The session ID for conversation history
        db: Optional Chroma DB for RAG
        selected_sources: Optional list of selected source document names for RAG filtering. Each source has {name: str, size: int}
    """
    # Get session history and current message count
    history = get_session_history(session_id)
    user_message_index = len(history.messages)
    
    # Combine RAG context with user input
    full_input = input_str
    rag_sources = []
    
    # Add RAG context if enabled
    if RAG_ENABLED and db and selected_sources is not None and len(selected_sources) > 0:
        print(f"RAG: Processing selected sources: {selected_sources}")
        selected_sources_names = [s['name'] for s in selected_sources if 'name' in s]
        print(f"RAG: Filtered source names: {selected_sources_names}")
        context, sources = retrieve_context(db=db, query=input_str, selected_sources=selected_sources_names, source_name_mapping=source_name_mapping)
        if context:
            full_input = f"""Context from knowledge base:
                        {context}

                        ---

                        User question: {input_str}

                        Please answer the user's question using the provided context when relevant. When referencing context, refer to them as [X] where:
                        - For files, X is the source after the dash in the document title after all directory paths are stripped away and the .md extension is removed, but keep the extension right before the .md (example: data/session-0000/xxx.docx.md becomes xxx.docx).
                        - For URLs, use a markdown link where X (the label) is the domain/subdomain name (example: https://example.com/some/page becomes example.com and https://sub.example.com/some/page becomes sub.example.com) and the url is the full URL.
                        """
            rag_sources = sources
            print(f"Retrieved {len(sources)} relevant documents for RAG")
    
    response = None
    try:
        response = chat_with_history.invoke(
            {"input": full_input},
            config={"configurable": {"session_id": session_id}}
        )
    except Exception as e:
        print("Error during chat invocation:", e)
        if("413" in str(e)):
            # prompt too large
            return "Error: The input is too large for the model to process. Please reduce the size of your input."
        if("429" in str(e)):
            return "Error: Rate limit exceeded. Please try again later."
        return "Error: An unexpected error occurred while processing your request."
        
        
    # Store metadata for the user message
    user_metadata = {}
    if selected_sources:
        user_metadata['fileMetadata'] = selected_sources
    user_metadata['originalInput'] = input_str
    if user_metadata:
        history.add_message_metadata(user_message_index, user_metadata)
    
    # Store metadata for the AI response message
    ai_message_index = len(history.messages) - 1
    ai_metadata = {}
    
    # Combine all sources with their scores
    all_sources = []
    if rag_sources:
        for source in rag_sources:
            source_name = source['name'].replace(".md", "")
            score = source.get('score', 0)
            # Format as "source_name (score: 0.85)"
            all_sources.append({
                'name': source_name,
                'score': score
            })
        
    if all_sources:
        ai_metadata['sources'] = all_sources
    
    if ai_metadata:
        history.add_message_metadata(ai_message_index, ai_metadata)
    
    return response

def clear_session(session_id: str):
    """Clear the message history for a session."""
    if session_id in store:
        del store[session_id]

# Global variables for LLM chain (will be initialized below)
llm = None
prompt = None
chain = None
chat_with_history = None

def initialize_chain():
    """Initialize the LLM chain. Called on startup and after model changes."""
    global llm, prompt, chain, chat_with_history, MODEL_NAME
    
    # Initialize LLM
    llm = ChatGroq(
        model_name=MODEL_NAME,
        temperature=TEMPERATURE,
        api_key=GROQ_API_KEY,
    )

    # Prompt with history placeholder
    prompt = ChatPromptTemplate.from_messages([
        ("system", SYSTEM_PROMPT),
        MessagesPlaceholder(variable_name="chat_history"),
        ("human", "{input}")
    ])

    # Create chain
    chain = prompt | llm | StrOutputParser()

    # Wrap chain with message history
    chat_with_history = RunnableWithMessageHistory(
        chain,
        get_session_history=get_session_history,
        input_messages_key="input",
        history_messages_key="chat_history",
    )
    
    print(f"Chain initialized with model: {MODEL_NAME}")

# Initialize chain on startup
initialize_chain()

# Example usage
if __name__ == "__main__":
    print("User: Hi, my name is Joe.")
    print("Assistant:", chat("Hi, my name is Joe."))
    print("\nUser: What's my name?")
    print("Assistant:", chat("What's my name?"))
    
    from db import get_session_db
    
    # Test RAG with session-specific db
    test_session = "test_session"
    session_db = get_session_db(test_session)
    
    if session_db:
        print("\n--- Testing RAG ---")
        print("User: What information do you have in your knowledge base?")
        print("Assistant:", chat("What information do you have in your knowledge base?", db=session_db, session_id=test_session))