from datetime import datetime
from typing import List
from langchain_core.messages import BaseMessage
from langchain_core.chat_history import BaseChatMessageHistory

class ChatMessageHistoryWithTimestamps(BaseChatMessageHistory):
    """Chat message history that stores timestamps with each message."""
    
    def __init__(self):
        self.messages: List[BaseMessage] = []
        self.timestamps: List[datetime] = []
    
    def add_message(self, message: BaseMessage) -> None:
        """Add a message with current timestamp."""
        self.messages.append(message)
        self.timestamps.append(datetime.now())
    
    def clear(self) -> None:
        """Clear all messages and timestamps."""
        self.messages = []
        self.timestamps = []
    
    def get_messages_with_timestamps(self) -> List[tuple[BaseMessage, datetime]]:
        """Return list of (message, timestamp) tuples."""
        return list(zip(self.messages, self.timestamps))