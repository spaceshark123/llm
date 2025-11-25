from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from llm import chat, get_session_history, clear_session
from langchain_core.messages import HumanMessage, AIMessage
from dotenv import load_dotenv
from history import ChatMessageHistoryWithTimestamps

load_dotenv()
PORT = int(os.getenv('BACKEND_PORT', 5050))

app = Flask(__name__)
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['CORS_RESOURCES'] = {r"/*": {"origins": "*"}}
app.config['CORS_SUPPORTS_CREDENTIALS'] = True

CORS(app)

@app.route('/')
def home():
	return jsonify({'message': 'Welcome to the Chat API!'})

@app.route('/api/chat', methods=['POST'])
def chat_endpoint():
	session_id = request.headers.get('Session-ID')
	data = request.get_json()   # Parse JSON body

	# Extract fields
	message = data.get('message')
	files = data.get('files', [])
	urls = data.get('urls', [])

	print("Message:", message)
	print("Files:", files)
	print("URLs:", urls)

	if not message:
		return jsonify({'error': 'Input is required'}), 400
	if not session_id or session_id.strip() == "":
		return jsonify({'error': 'Session-ID header is required'}), 400

	print("chat request for session:", session_id)

	# ignore files, urls, and conversation history for now
	reply = chat(message, session_id=session_id)
	return jsonify({'reply': reply})

# get/clear session history endpoint
@app.route('/api/history', methods=['GET', 'DELETE'])
def history_endpoint():
    session_id = request.headers.get('Session-ID')
    print("history request for session:", session_id)
    if not session_id:
        return jsonify({'error': 'Session-ID header is required'}), 400
    
    if request.method == 'DELETE':
        clear_session(session_id)
        return jsonify({'message': 'Session cleared'}), 200
    
    if request.method == 'GET':
        '''
        export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  sources: string[]
  timestamp: Date
  isStreaming?: boolean
  truncatedContent?: string
}

        '''
        history = get_session_history(session_id).get_messages_with_timestamps()
        print("Fetched history for session:", session_id, history)
        history_serialized = [
            {
                'id': str(index),
                'role': 'assistant' if isinstance(msg, AIMessage) else 'user',
                'content': msg.content,
                'sources': [],
                'timestamp': timestamp.isoformat(),
                'isStreaming': False,
                'truncatedContent': msg.content,
            }
            for (index, (msg, timestamp)) in enumerate(history)
        ]
        return jsonify({'history': history_serialized}), 200

if __name__ == '__main__':
	app.run(port=PORT, debug=True)