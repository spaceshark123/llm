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

export function ChatMessages({ messages, onStreamingComplete, onStreamingStart }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollTimeoutRef = useRef<number | null>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }

  // Scroll when messages array changes (new message added)
  useEffect(() => {
    scrollToBottom()
  }, [messages.length])

  // Debounced scroll during streaming to avoid excessive scrolling
  useEffect(() => {
    const isAnyStreaming = messages.some(msg => msg.isStreaming || msg.truncatedContent === "__COMPLETE__")
    
    if (!isAnyStreaming) {
      // Not streaming - scroll immediately
      scrollToBottom()
      if (scrollTimeoutRef.current !== null) {
        clearTimeout(scrollTimeoutRef.current)
        scrollTimeoutRef.current = null
      }
      return
    }
    
    // During streaming - debounce scroll to every 100ms to avoid cascading re-renders
    if (scrollTimeoutRef.current === null) {
      scrollTimeoutRef.current = window.setTimeout(() => {
        scrollToBottom()
        scrollTimeoutRef.current = null
      }, 100)
    }
    
    return () => {
      if (scrollTimeoutRef.current !== null) {
        clearTimeout(scrollTimeoutRef.current)
        scrollTimeoutRef.current = null
      }
    }
  }, [messages])

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
              content={message.content} 
              isStreaming={message.isStreaming}
              speed={0.5}
              truncatedContent={message.truncatedContent}
              onFinishStreaming={() => onStreamingComplete?.(message.id)}
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
          </div>
        </div>
      ))}
      <div ref={messagesEndRef} />
    </div>
  )
}
