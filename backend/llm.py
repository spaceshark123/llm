from langchain_groq import ChatGroq
from langchain_core.prompts import ChatPromptTemplate
from langchain_core.output_parsers import StrOutputParser
import json
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()
GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
if not GROQ_API_KEY:
    raise ValueError("GROQ_API_KEY is not set in environment variables.")
TEMPERATURE = float(os.getenv("TEMPERATURE", 0.7))
MODEL_NAME = os.getenv("MODEL_NAME", "llama-3.1-8b-instant")

SYSTEM_PROMPT = """You are a helpful and knowledgeable AI LLM assistant that answers questions. Your responses should be formatted in markdown."""

# Initialize Groq LLM
llm = ChatGroq(
    model_name=MODEL_NAME,
    temperature=TEMPERATURE,
    api_key=GROQ_API_KEY
)

# Create a simple prompt
prompt = ChatPromptTemplate.from_messages([
    ("system", SYSTEM_PROMPT),
    ("user", "{input}")
])

parser = StrOutputParser()

# Create the chain
chain = prompt | llm | parser

def chat(input: str) -> dict:
    result = chain.invoke({"input": input})
    return result

# Example usage
if __name__ == "__main__":
    user = """What is the capital of France?"""
    response = chat(user)
    print("Response:", response)