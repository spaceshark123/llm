export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  sources: string[]
  timestamp: string | Date | null // can be string (ISO format) or Date
  isStreaming?: boolean
  truncatedContent?: string
}
