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

# Session store (for conversation histories)
store = {}

print(f"RAG Enabled: {RAG_ENABLED}")
        
def retrieve_context(db: Chroma, query: str, top_k: int = RAG_TOP_K) -> tuple[str, list[dict]]:
    """Retrieve relevant context from the vector store.
    
    Returns:
        tuple: (context_text, sources_metadata)
    """
    if not db:
        return "", []
    
    try:
        # Search for relevant documents
        results = db.similarity_search_with_score(query, k=top_k)
        
        if not results:
            return "", []
        
        # Format context
        context_parts = []
        sources = []
        
        for i, (doc, score) in enumerate(results, 1):
            # Add document content
            context_parts.append(f"[Document {i}]\n{doc.page_content}\n")
            
            # Extract source info
            source = doc.metadata.get('source', 'Unknown')
            sources.append({
                'name': os.path.basename(source),
                'path': source,
                'score': float(score)
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

def chat(input_str: str, session_id: str = "default", db: Chroma = None, file_contents: dict = None, file_metadata: list = None, urls: list = None) -> str:
    """Send a message and get a response with conversation history.
    
    Args:
        input_str: The user's message
        session_id: The session ID for conversation history
        file_contents: Dictionary mapping file names to their extracted text content
        file_metadata: List of file metadata objects with name, type, size
        urls: List of URLs included with the message
    """
    # Get session history and current message count
    history = get_session_history(session_id)
    user_message_index = len(history.messages)
    
    # Combine RAG context with user input
    full_input = input_str
    rag_sources = []
    
    # Add RAG context if enabled
    if RAG_ENABLED and db:
        context, sources = retrieve_context(db=db, query=input_str)
        if context:
            full_input = f"""Context from knowledge base:
                        {context}

                        ---

                        User question: {input_str}

                        Please answer the user's question using the provided context when relevant."""
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
    if file_metadata:
        user_metadata['fileMetadata'] = file_metadata
    if urls:
        user_metadata['urls'] = urls
    if user_metadata:
        history.add_message_metadata(user_message_index, user_metadata)
    
    # Store metadata for the AI response message
    ai_message_index = len(history.messages) - 1
    ai_metadata = {}
    
    # Combine all sources
    all_sources = []
    # if file_metadata:
    #     all_sources.extend([f['name'] for f in file_metadata])
    # if urls:
    #     all_sources.extend(urls)
    if rag_sources:
        all_sources.extend([s['name'].replace(".md", "") for s in rag_sources])
        all_sources = list(set(all_sources))  # Remove duplicates
        
    if all_sources:
        ai_metadata['sources'] = all_sources
        # if rag_sources:
        #     ai_metadata['ragSources'] = rag_sources
    
    if ai_metadata:
        history.add_message_metadata(ai_message_index, ai_metadata)
    
    return response

def clear_session(session_id: str):
    """Clear the message history for a session."""
    if session_id in store:
        del store[session_id]
    
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

# Example usage
if __name__ == "__main__":
    print("User: Hi, my name is Joe.")
    print("Assistant:", chat("Hi, my name is Joe."))
    print("\nUser: What's my name?")
    print("Assistant:", chat("What's my name?"))
    
    from db import db
    
    # Test RAG
    if db:
        print("\n--- Testing RAG ---")
        print("User: What information do you have in your knowledge base?")
        print("Assistant:", chat("What information do you have in your knowledge base?", db=db))