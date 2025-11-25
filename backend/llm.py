from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate, MessagesPlaceholder
from langchain_core.output_parsers import StrOutputParser
from langchain_core.runnables.history import RunnableWithMessageHistory
from langchain_core.chat_history import InMemoryChatMessageHistory
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

# Session store
store = {}

def get_session_history(session_id: str) -> ChatMessageHistoryWithTimestamps:
    """Return or create message history for a session."""
    if session_id not in store:
        store[session_id] = ChatMessageHistoryWithTimestamps()
    return store[session_id]

# Wrap chain with message history
chat_with_history = RunnableWithMessageHistory(
    chain,
    get_session_history=get_session_history,
    input_messages_key="input",
    history_messages_key="chat_history",
)

def chat(input_str: str, session_id: str = "default") -> str:
    """Send a message and get a response with conversation history."""
    response = chat_with_history.invoke(
        {"input": input_str},
        config={"configurable": {"session_id": session_id}}
    )
    return response

def clear_session(session_id: str):
    """Clear the message history for a session."""
    if session_id in store:
        del store[session_id]

# Example usage
if __name__ == "__main__":
    print("User: Hi, my name is Joe.")
    print("Assistant:", chat("Hi, my name is Joe."))
    print("\nUser: What's my name?")
    print("Assistant:", chat("What's my name?"))
    # test getting session history
    print("session history:", get_session_history("default").messages)