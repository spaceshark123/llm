export interface ChatMessage {
	id: string
	role: "user" | "assistant"
	content: string
	sources: (string | { name: string; score: number })[]
	timestamp: Date
	isStreaming?: boolean
	truncatedContent?: string
	fileMetadata?: Array<{ name: string; type: string; size: number }>
	originalInput?: string
	urls?: string[]
}

