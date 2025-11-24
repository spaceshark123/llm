from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from llm import chat
from dotenv import load_dotenv

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
	data = request.get_json()   # Parse JSON body

	# Extract fields
	message = data.get('message')
	files = data.get('files', [])
	urls = data.get('urls', [])
	conversation_history = data.get('conversationHistory', [])

	print("Message:", message)
	print("Files:", files)
	print("URLs:", urls)
	print("Conversation:", conversation_history)

	if not message:
		return jsonify({'error': 'Input is required'}), 400

	# ignore files, urls, and conversation history for now
	reply = chat(message)
	return jsonify({'reply': reply})

if __name__ == '__main__':
	app.run(port=PORT, debug=True)