import { useState, useEffect, useRef, memo } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"

// Memoized markdown renderer to avoid re-parsing during streaming
const MarkdownDisplay = memo(({ content }: { content: string }) => (
  <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
    {content}
  </ReactMarkdown>
))

interface StreamingTextProps {
  content: string
  isStreaming?: boolean
  speed?: number
  onFinishStreaming?: () => void
  truncatedContent?: string
  onStartStreaming?: () => void
}

export function StreamingText({ content, isStreaming = false, speed = 6.25, onFinishStreaming, truncatedContent, onStartStreaming}: StreamingTextProps) {
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
          ;(onStartStreaming as any)?.()
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
    return () => {}
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
    <div className="prose prose-neutral dark:prose-invert max-w-none markdown">
      {displayedContent ? (
        // Show markdown-formatted content updated in real-time during streaming
        <MarkdownDisplay content={showAll ? content : displayedContent} />
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
