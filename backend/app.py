from flask import Flask, request, jsonify
from flask_cors import CORS
import os
from llm import chat
from dotenv import load_dotenv

load_dotenv()
PORT = int(os.getenv('PORT', 5050))

app = Flask(__name__)
app.config['CORS_HEADERS'] = 'Content-Type'
app.config['CORS_RESOURCES'] = {r"/*": {"origins": "*"}}
app.config['CORS_SUPPORTS_CREDENTIALS'] = True

CORS(app)

@app.route('/')
def home():
	return jsonify({'message': 'Welcome to the Chat API!'})

@app.route('/chat', methods=['POST'])
def chat_endpoint():
	data = request.args
	user_input = data.get('input', '')
	if not user_input:
		return jsonify({'error': 'Input is required'}), 400

	response = chat(user_input)
	return jsonify({'response': response})

if __name__ == '__main__':
	app.run(port=PORT, debug=True)