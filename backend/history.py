from datetime import datetime
from typing import List, Dict, Any
from langchain_core.messages import BaseMessage
from langchain_core.chat_history import BaseChatMessageHistory

class ChatMessageHistoryWithTimestamps(BaseChatMessageHistory):
    """Chat message history that stores timestamps with each message."""
    
    def __init__(self):
        self.messages: List[BaseMessage] = []
        self.timestamps: List[datetime] = []
        self.metadata: Dict[str, Any] = {}  # Store metadata by message index
    
    def add_message(self, message: BaseMessage) -> None:
        """Add a message with current timestamp."""
        self.messages.append(message)
        self.timestamps.append(datetime.now())
    
    def add_message_metadata(self, message_index: int, meta: Dict[str, Any]) -> None:
        """Store metadata for a message."""
        self.metadata[str(message_index)] = meta
    
    def get_message_metadata(self, message_index: int) -> Dict[str, Any]:
        """Retrieve metadata for a message."""
        return self.metadata.get(str(message_index), {})
    
    def clear(self) -> None:
        """Clear all messages and timestamps."""
        self.messages = []
        self.timestamps = []
        self.metadata = {}
    
    def get_messages_with_timestamps(self) -> List[tuple[BaseMessage, datetime]]:
        """Return list of (message, timestamp) tuples."""
        return list(zip(self.messages, self.timestamps))