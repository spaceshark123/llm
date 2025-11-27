export interface ChatMessage {
  id: string
  role: "user" | "assistant"
  content: string
  sources: string[]
  timestamp: Date
  isStreaming?: boolean
  truncatedContent?: string
  fileMetadata?: Array<{ name: string; type: string; size: number }>
  urls?: string[]
}
