from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory
from langchain_community.vectorstores import Chroma
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_community.document_loaders import DirectoryLoader
import os
from dotenv import load_dotenv
from history import ChatMessageHistoryWithTimestamps

# Load environment variables
load_dotenv()

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in environment variables.")

TEMPERATURE = float(os.getenv("TEMPERATURE", "0.7"))
MODEL_NAME = os.getenv("MODEL_NAME", "llama-3.1-8b-instant")
SYSTEM_PROMPT = """You are a helpful and knowledgeable AI assistant. Respond in markdown."""
CHROMA_PATH = "chroma"

# Session store (for conversation histories)
store = {}

def get_session_history(session_id: str) -> ChatMessageHistoryWithTimestamps:
    """Return or create message history for a session."""
    if session_id not in store:
        store[session_id] = ChatMessageHistoryWithTimestamps()
    return store[session_id]

def chat(input_str: str, session_id: str = "default", file_contents: dict = None, file_metadata: list = None, urls: list = None) -> str:
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
    
    # Prepare file context if files are provided
    file_context = ""
    if file_metadata and file_contents:
        file_context = "\n\n[FILE CONTEXT]\n"
        for file_info in file_metadata:
            file_name = file_info.get('name', 'unknown')
            file_type = file_info.get('type', 'unknown')
            file_context += f"\n--- {file_name} ({file_type}) ---\n"
            if file_name in file_contents:
                file_context += file_contents[file_name]
            else:
                file_context += "[File content not available]"
        file_context += "\n[END FILE CONTEXT]\n"
    
    # Combine file context with user input
    full_input = file_context + input_str if file_context else input_str
    
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
        
        
    # Store metadata for the user message that was just added
    user_metadata = {}
    if file_metadata:
        user_metadata['fileMetadata'] = file_metadata
    if urls:
        user_metadata['urls'] = urls
    if user_metadata:
        history.add_message_metadata(user_message_index, user_metadata)
    
    # Store metadata for the AI response message
    ai_message_index = len(history.messages) - 1  # AI message was just added
    ai_metadata = {}
    if file_metadata or urls:
        ai_metadata['sources'] = [f['name'] for f in file_metadata] if file_metadata else []
        if urls:
            ai_metadata['sources'].extend(urls)
    if ai_metadata and ai_metadata['sources']:
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
    # test getting session history
    print("session history:", get_session_history("default").messages)