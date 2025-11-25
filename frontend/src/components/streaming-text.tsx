import { useState, useEffect, useRef } from "react"
import ReactMarkdown from "react-markdown"
import remarkGfm from "remark-gfm"
import rehypeHighlight from "rehype-highlight"

interface StreamingTextProps {
  content: string
  isStreaming?: boolean
  speed?: number
  onFinishStreaming?: () => void
  truncatedContent?: string
  onStartStreaming?: () => void
  answerNow?: boolean
}

export function StreamingText({ content, isStreaming = false, speed = 0.5, onFinishStreaming, truncatedContent, onStartStreaming, answerNow = false }: StreamingTextProps) {
  const [displayedContent, setDisplayedContent] = useState("")
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isAnimating, setIsAnimating] = useState(false)
  const timerRef = useRef<number | null>(null)
  const previousContentRef = useRef("")
  const previousStreamingRef = useRef(isStreaming)
  const hasHandledStopRef = useRef(false)
  const hasStartedRef = useRef(false)
  const previousTruncatedRef = useRef<string | undefined>(undefined)

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
        setDisplayedContent(content)
        setCurrentIndex(content.length)
        setIsAnimating(false)
      }
    }
  }, [content])

  // Handle stop command only
  useEffect(() => {
    if (truncatedContent === "__TRUNCATE__" && previousTruncatedRef.current !== "__TRUNCATE__") {
      previousTruncatedRef.current = truncatedContent
      // Clear any pending animation timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setIsAnimating(false)
    }
  }, [truncatedContent])

  // Handle Answer Now: instantly show full content and complete
  useEffect(() => {
    if (answerNow) {
      // Clear any pending animation timer
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      setDisplayedContent(content)
      setCurrentIndex(content.length)
      setIsAnimating(false)
      if (onFinishStreaming) {
        onFinishStreaming()
      }
    }
  }, [answerNow, content, onFinishStreaming])

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

    // Schedule next character
    timerRef.current = window.setTimeout(() => {
      setCurrentIndex(prev => prev + 1)
      setDisplayedContent(content.slice(0, currentIndex + 1))
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
      <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeHighlight]}>
        {displayedContent}
      </ReactMarkdown>
      {isAnimating && currentIndex < content.length && (
        <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-1" />
      )}
    </div>
  )
}
