export const API_BASE_URL = 'http://localhost:5050/api';

// Mapping of Groq model names to their capabilities
export const MODEL_CAPABILITIES: Record<string, string[]> = {
	"groq/compound": [
		"Web Search",
		"Code Execution",
		"Visit Website",
		"Browser Automation",
		"Wolfram Alpha",
		"Reasoning"
	],
	"groq/compound-mini": [
		"Web Search",
		"Code Execution",
		"Visit Website",
		"Browser Automation",
		"Wolfram Alpha",
		"Reasoning"
	],
	"llama-3.1-8b-instant": [],
	"llama-3.1-70b-instant": [],
	"meta-llama/llama-4-maverick-17b-128e-instruct": [
		"Vision"
	],
	"meta-llama/llama-4-scout-17b-16e-instruct": [
		"Vision"
	],
	"meta-llama/llama-guard-4-12b": [
		"Content Moderation",
		"Vision"
	],
	"meta-llama/llama-prompt-guard-2-22m": [
		"Content Moderation"
	],
	"meta-llama/llama-prompt-guard-2-86m": [
		"Content Moderation"
	],
	"moonshotai/kimi-k2-instruct": [],
	"moonshotai/kimi-k2-instruct-0905": [],
	"openai/gpt-oss-120b": [
		"Web Search",
		"Code Execution",
		"Reasoning"
	],
	"openai/gpt-oss-20b": [
		"Web Search",
		"Code Execution",
		"Reasoning"
	],
	"openai/gpt-oss-safeguard-20b": [
		"Web Search",
		"Code Execution",
		"Reasoning",
		"Content Moderation"
	],
	"qwen/qwen3-32b": [
		"Reasoning"
	]
};