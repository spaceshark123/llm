import { useState, useEffect, useRef, memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"
import remarkMath from "remark-math"
import rehypeKatex from "rehype-katex"
import { ChevronDown, ChevronRight } from "lucide-react"

// Component to render thinking blocks
const ThinkingBlock = ({ content }: { content: string }) => {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div className="my-4 border border-neutral-300 dark:border-neutral-700 rounded-lg overflow-hidden bg-neutral-50 dark:bg-neutral-900">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center gap-2 text-left font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors"
      >
        {isExpanded ? (
          <ChevronDown className="w-4 h-4 shrink-0" />
        ) : (
          <ChevronRight className="w-4 h-4 shrink-0" />
        )}
        <span className="text-sm">Thinking...</span>
      </button>
      {isExpanded && (
        <div className="px-4 py-3 border-t border-neutral-300 dark:border-neutral-700">
          <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none">
            <ReactMarkdown
              remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
              rehypePlugins={[rehypeHighlight, rehypeKatex]}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  )
}

// Process content to extract thinking blocks and regular content
const processContentWithThinking = (content: string, isStreaming: boolean = false) => {
  const parts: Array<{ type: 'text' | 'thinking' | 'thinking-incomplete', content: string }> = []
  const thinkRegex = /<think>([\s\S]*?)<\/think>/g
  let lastIndex = 0
  let match

  while ((match = thinkRegex.exec(content)) !== null) {
    // Add text before this thinking block
    if (match.index > lastIndex) {
      const textBefore = content.slice(lastIndex, match.index)
      if (textBefore.trim()) {
        parts.push({ type: 'text', content: textBefore })
      }
    }

    // Add the thinking block
    parts.push({ type: 'thinking', content: match[1].trim() })
    lastIndex = match.index + match[0].length
  }

  // Check for incomplete thinking block (only opening tag)
  const remainingContent = content.slice(lastIndex)
  const incompleteThinkMatch = remainingContent.match(/<think>([\s\S]*)$/)
  const alternateIncompleteMatch = remainingContent.match(new RegExp(`<think>([\\s\\S]*)$`))

  if ((incompleteThinkMatch || alternateIncompleteMatch) && isStreaming) {
    // Add text before the incomplete thinking block
    console.log("Found incomplete thinking block during streaming")
    const textBefore = remainingContent.slice(0, (incompleteThinkMatch ? incompleteThinkMatch.index : alternateIncompleteMatch!.index))
    if (textBefore.trim()) {
      parts.push({ type: 'text', content: textBefore })
    }

    // Add the incomplete thinking block
    parts.push({ type: 'thinking-incomplete', content: (incompleteThinkMatch ? incompleteThinkMatch[1] : alternateIncompleteMatch![1]) })
  } else if (remainingContent.trim()) {
    // Add remaining text after last thinking block
    parts.push({ type: 'text', content: remainingContent })
  }

  console.log("Processed content into parts:", parts)
  return parts
}

// Memoized markdown renderer to avoid re-parsing during streaming
const MarkdownDisplay = memo(({ content, isStreaming }: { content: string, isStreaming?: boolean }) => {
  const parts = processContentWithThinking(content, isStreaming)

  if (parts.length === 0) {
    return (
      <ReactMarkdown
        remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
        rehypePlugins={[rehypeHighlight, rehypeKatex]}
      >
        {content}
      </ReactMarkdown>
    )
  }

  return (
    <>
      {parts.map((part, index) => (
        part.type === 'thinking' ? (
          <ThinkingBlock key={index} content={part.content} />
        ) : part.type === 'thinking-incomplete' ? (
          <div key={index} className="my-4 border border-neutral-300 dark:border-neutral-700 rounded-lg overflow-hidden bg-neutral-50 dark:bg-neutral-900">
            <div className="w-full px-4 py-3 flex items-center gap-2 text-left font-medium text-neutral-700 dark:text-neutral-300">
              <ChevronRight className="w-4 h-4 shrink-0 opacity-50" />
              <span className="text-sm">Thinking...</span>
              <span className="inline-block w-1 h-3 bg-neutral-400 dark:bg-neutral-500 animate-pulse ml-1" />
            </div>
            <div className="px-4 py-3 border-t border-neutral-300 dark:border-neutral-700">
              <div className="prose prose-sm prose-neutral dark:prose-invert max-w-none opacity-70">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
                  rehypePlugins={[rehypeHighlight, rehypeKatex]}
                >
                  {part.content}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : (
          <ReactMarkdown
            key={index}
            remarkPlugins={[remarkGfm, [remarkMath, { singleDollarTextMath: false }]]}
            rehypePlugins={[rehypeHighlight, rehypeKatex]}
          >
            {part.content}
          </ReactMarkdown>
        )
      ))}
    </>
  )
})

interface StreamingTextProps {
  content: string
  isStreaming?: boolean
  speed?: number
  onFinishStreaming?: () => void
  truncatedContent?: string
  onStartStreaming?: () => void
  isUserMessage?: boolean
}

export function StreamingText({ content, isStreaming = false, speed = 6.25, onFinishStreaming, truncatedContent, onStartStreaming, isUserMessage = false }: StreamingTextProps) {
  const [displayedContent, setDisplayedContent] = useState("")
  const [showAll, setShowAll] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const timerRef = useRef<number | null>(null)
  const previousContentRef = useRef("")
  const previousStreamingRef = useRef(isStreaming)
  const hasHandledStopRef = useRef(false)
  const hasStartedRef = useRef(false)

  // Reset when content changes (new message)
  useEffect(() => {
    if (content !== previousContentRef.current) {
      previousContentRef.current = content
      previousStreamingRef.current = isStreaming
      hasHandledStopRef.current = false
      hasStartedRef.current = false
      if (isStreaming) {
        // New streaming message - start from beginning
        setDisplayedContent("")
        setShowAll(false)
        setCurrentIndex(0)
        setIsAnimating(true)
        // notify once that streaming started
        if (!hasStartedRef.current) {
          hasStartedRef.current = true
            // call callback if provided
            ; (onStartStreaming as any)?.()
        }
      } else {
        // Non-streaming message - show full content
        setShowAll(true)
        setDisplayedContent(content)
        setCurrentIndex(content.length)
        setIsAnimating(false)
      }
    }
  }, [content])

  // Handle stop command only
  useEffect(() => {
    if (truncatedContent === "__TRUNCATE__") {
      console.log("Handling stop generation")
      // Clear any pending animation timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setIsAnimating(false)
    } else if (truncatedContent === "__COMPLETE__") {
      console.log("Handling Answer Now completion")
      setShowAll(true)
      // Clear any pending animation timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setIsAnimating(false)
      setCurrentIndex(content.length)
      // Defer the completion callback to ensure state update commits first
      const timeoutId = setTimeout(() => {
        if (onFinishStreaming) {
          onFinishStreaming()
        }
      }, 0)
      return () => clearTimeout(timeoutId)
    }
  }, [truncatedContent])

  // Debounce markdown rendering to avoid expensive re-parses during streaming
  useEffect(() => {
    // Show markdown as we stream
    // No need for debounce - memoization handles the expensive part
    return () => { }
  }, [displayedContent, isAnimating])

  // Handle streaming animation
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }

    // Stop if not animating
    if (!isAnimating) {
      return
    }

    // Stop if we've reached the end
    if (currentIndex >= content.length) {
      setIsAnimating(false)
      if (onFinishStreaming) {
        onFinishStreaming()
      }
      return
    }

    // Schedule next character - batch update content and index together
    const nextIndex = currentIndex + 1
    timerRef.current = window.setTimeout(() => {
      setCurrentIndex(nextIndex)
      setDisplayedContent(content.slice(0, nextIndex))
    }, speed)

    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [isAnimating, currentIndex, content, speed, onFinishStreaming])

  return (
    <div className={`prose prose-neutral dark:prose-invert max-w-none markdown ${isUserMessage ? "whitespace-pre-wrap" : ""}`}>
      {displayedContent ? (
        // Show markdown-formatted content updated in real-time during streaming
        <MarkdownDisplay content={showAll ? content : displayedContent} isStreaming={isStreaming} />
      ) : (
        // Fallback: show plain text if content is empty
        <pre className="whitespace-pre-wrap wrap-break-word font-sans text-base">{showAll ? content : displayedContent}</pre>
      )}
      {isAnimating && currentIndex < content.length && (
        <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-1" />
      )}
    </div>
  )
}
