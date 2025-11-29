import { useEffect, useRef } from "react"
import type { ChatMessage } from "@/types/chat"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { MessageCircle, Sparkles } from "lucide-react"
import 'highlight.js/styles/github-dark.css';
import { StreamingText } from "./streaming-text"

interface ChatMessagesProps {
  messages: ChatMessage[]
  onStreamingComplete?: (messageId: string) => void
  onStreamingStart?: (messageId: string) => void
}

function cleanFileName(fileName: string): string {
  // Remove directory paths and .md extension (should work for both Unix and Windows paths)
  return fileName.replace(/^.*[\/\\]/, '').replace(/\.md$/, '');
}

export function ChatMessages({ messages, onStreamingComplete, onStreamingStart }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const userScrolledRef = useRef(false)
  const isStreamingRef = useRef(false)
  const messageIdsRef = useRef<string[]>([])
  const scrollIntervalIdRef = useRef<number | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Track if user manually scrolled
  useEffect(() => {
    const container = scrollRef.current
    if (!container) return

    const handleScroll = () => {
      // If scrolled away from bottom, mark that user scrolled manually
      const isAtBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50
      userScrolledRef.current = !isAtBottom
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [])

  // Detect new messages by comparing IDs
  useEffect(() => {
    const currentIds = messages.map(m => m.id)
    const hasNewMessage = currentIds.length > messageIdsRef.current.length
    
    if (hasNewMessage) {
      // New message was added, reset scroll flag and scroll to it
      userScrolledRef.current = false
      scrollToBottom()
    }
    
    messageIdsRef.current = currentIds
  }, [messages.length])

  // Continuously scroll during streaming (unless user scrolled)
  useEffect(() => {
    const isAnyStreaming = messages.some(msg => msg.isStreaming)
    isStreamingRef.current = isAnyStreaming
    
    if (!isAnyStreaming) {
      // Not streaming, stop the scroll interval
      return
    }

    // Reset user scroll flag when streaming starts (new response coming)
    userScrolledRef.current = false

    // During streaming, scroll every 100ms
    const interval = setInterval(() => {
      if (!userScrolledRef.current && isStreamingRef.current) {
        scrollToBottom()
      }
    }, 100)
    scrollIntervalIdRef.current = interval

    return () => clearInterval(interval)
  }, [messages.length])

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4 max-w-4xl mx-auto w-full">
      {messages.map((message) => (
        <div key={message.id} className="flex gap-4 animate-in fade-in slide-in-from-bottom-2">
          {/* Avatar */}
          <Avatar className="h-8 w-8 shrink-0 mt-1">
            <AvatarFallback
              className={
                message.role === "assistant" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"
              }
            >
              {message.role === "assistant" ? <Sparkles className="h-4 w-4" /> : <MessageCircle className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>

          {/* Message content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-semibold text-foreground">
                {message.role === "assistant" ? "Assistant" : "You"}
              </span>
              <span className="text-xs text-muted-foreground">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <StreamingText 
              content={message.role === "user" ? message.originalInput || message.content : message.content} 
              isStreaming={message.isStreaming}
              speed={0.5}
              truncatedContent={message.truncatedContent}
              onFinishStreaming={() => {
                onStreamingComplete?.(message.id)
                clearInterval(scrollIntervalIdRef.current || undefined)
                scrollToBottom()
                isStreamingRef.current = false
              }}
              onStartStreaming={() => onStreamingStart?.(message.id)}
              isUserMessage={message.role === "user"}
            />

            {/* Sources */}
            {message.sources && message.sources.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Sources:</p>
                <div className="flex flex-wrap gap-2">
                  {message.sources.map((source, idx) => (
                    <span
                      key={idx}
                      className="inline-flex items-center gap-1 px-2 py-1 bg-muted rounded text-xs text-muted-foreground"
                    >
                      📎 {source}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* File metadata for user messages */}
            {message.role === "user" && message.fileMetadata && message.fileMetadata.filter((file) => !file.name.includes(".web")).length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">Files:</p>
                <div className="space-y-1">
                  {message.fileMetadata.filter((file) => !file.name.includes(".web")).map((file, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 px-2 py-1 bg-muted rounded text-xs text-muted-foreground"
                    >
                      <span>📄 {cleanFileName(file.name)}</span>
                      <span className="text-muted-foreground/70">({(file.size / 1024).toFixed(1)} KB)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* URLs for user messages */}
            {message.role === "user" && message.urls && message.urls.length > 0 && (
              <div className="mt-3 pt-3 border-t border-border">
                <p className="text-xs font-semibold text-muted-foreground mb-2">URLs:</p>
                <div className="space-y-1">
                  {message.urls.map((url, idx) => (
                    <div
                      key={idx}
                      className="inline-flex items-center gap-2 px-2 py-1 bg-muted rounded text-xs text-muted-foreground"
                    >
                      <span>🔗 {url}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
