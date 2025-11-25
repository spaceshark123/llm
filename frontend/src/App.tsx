import { useState, useRef } from "react"
import { ChatInterface } from "@/components/chat-interface"
import type { ChatMessage } from "@/types/chat"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050/api"

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content:
        "Hello! I'm your LLM Assistant. You can upload files (PDF, TXT, DOCX) or provide website URLs, then ask me questions. I'll help you find answers based on your provided sources.",
      sources: [],
      timestamp: new Date(),
    },
  ])

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [uploadedUrls, setUploadedUrls] = useState<string[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [responseReady, setResponseReady] = useState(false)
  const [streamingStarted, setStreamingStarted] = useState(false)
  const [controlsLocked, setControlsLocked] = useState(false)
  const currentMessageIdRef = useRef<string | null>(null)
  const activeGenerationIdRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isCanceledRef = useRef(false)
  const controlsUnlockTimerRef = useRef<number | null>(null)

  const handleSendMessage = async (content: string) => {
    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      sources: [],
      timestamp: new Date(),
    }

    setMessages((prev) => [...prev, userMessage])
    setIsGenerating(true)
    setResponseReady(false)
    setStreamingStarted(false)
    isCanceledRef.current = false
    // Reset any prior control lock
    setControlsLocked(false)
    if (controlsUnlockTimerRef.current !== null) {
      clearTimeout(controlsUnlockTimerRef.current)
      controlsUnlockTimerRef.current = null
    }

    // Create a new generation id and abort controller for this request
    const generationId = Date.now()
    activeGenerationIdRef.current = generationId
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Backend call with cancellation support
    let response
    let data
    try {
      response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content,
          files: uploadedFiles,
          urls: uploadedUrls,
          conversationHistory: messages,
        }),
        signal: controller.signal,
      });
      data = await response.json();
      console.log("Backend response:", data);
    } catch (error) {
      // If aborted or generation superseded, silently exit
      if ((error as any)?.name === 'AbortError') {
        return
      }
      console.error("Error communicating with backend:", error);
      // On error, if user already stopped, do nothing further
      if (activeGenerationIdRef.current !== generationId) {
        return
      }
      // We won't add a placeholder response on error; end generation state
      setIsGenerating(false)
      setResponseReady(false)
      setStreamingStarted(false)
      return
    }

    // If this generation was canceled before the response arrived, do nothing
    if (activeGenerationIdRef.current !== generationId || isCanceledRef.current) {
      return
    }

    let reply = `# Welcome to the LLM Assistant

Here's a comprehensive example of **markdown formatting** that I can render:

## Features

- Bullet point 1
- Bullet point 2
- Bullet point 3

### Code Example

Here's some \`inline code\` and a code block:

\`\`\`python
def hello_world():
    print("Hello, World!")
    return True
\`\`\`

## Formatting Examples

You can use **bold text**, *italic text*, and ***bold italic***.

> This is a blockquote. You can use it to highlight important information.

### Links and Tables

| Feature | Status |
|---------|--------|
| File Upload | ✓ |
| URL Input | ✓ |
| Markdown Support | ✓ |

## Tips

1. Upload files (PDF, TXT, DOCX)
2. Add website URLs
3. Ask questions about your sources

this is a test link: [OpenAI](https://www.openai.com)
`
    if (response && response.ok) {
      reply = data.reply;
    }

    // Add AI response message with streaming animation
    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: reply,
      sources: data?.sources || uploadedFiles.map((f) => f.name).concat(uploadedUrls),
      timestamp: new Date(),
      isStreaming: true,
    }
    currentMessageIdRef.current = aiMessage.id
    setMessages((prev) => [...prev, aiMessage])
    setResponseReady(true)
    // Lock controls for 1 second after backend response is ready
    setControlsLocked(true)
    if (controlsUnlockTimerRef.current !== null) {
      clearTimeout(controlsUnlockTimerRef.current)
      controlsUnlockTimerRef.current = null
    }
    controlsUnlockTimerRef.current = window.setTimeout(() => {
      setControlsLocked(false)
      controlsUnlockTimerRef.current = null
    }, 1000)
  }

  const handleFilesAdded = (files: File[]) => {
    setUploadedFiles((prev) => [...prev, ...files])
  }

  const handleUrlAdded = (url: string) => {
    setUploadedUrls((prev) => [...prev, url])
  }

  const handleRemoveFile = (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleRemoveUrl = (index: number) => {
    setUploadedUrls((prev) => prev.filter((_, i) => i !== index))
  }

  const handleStreamingComplete = (messageId: string) => {
    // Called when StreamingText finishes animating
    setMessages((prev) => 
      prev.map((msg) => 
        msg.id === messageId ? { ...msg, isStreaming: false, truncatedContent: undefined } : msg
      )
    )
    if (currentMessageIdRef.current === messageId) {
      setIsGenerating(false)
      setStreamingStarted(false)
      currentMessageIdRef.current = null
    }
  }

  const handleStreamingStart = (messageId: string) => {
    if (currentMessageIdRef.current === messageId) {
      setStreamingStarted(true)
    }
  }

  const handleStopGeneration = () => {
    if (currentMessageIdRef.current) {
      // Find the current message and get its displayed content to truncate
      setMessages((prev) => 
        prev.map((msg) => {
          if (msg.id === currentMessageIdRef.current) {
            // Mark as truncated - StreamingText will handle showing only what's been displayed
            return { ...msg, isStreaming: false, truncatedContent: "__TRUNCATE__" }
          }
          return msg
        })
      )
      // No need to abort in-flight request since it already completed
      isCanceledRef.current = true
    } else {
      // Stop requested before the assistant message exists; cancel in-flight request
      if (abortControllerRef.current) {
        try { abortControllerRef.current.abort() } catch {}
      }
      // Invalidate this generation so late responses are ignored
      activeGenerationIdRef.current = null
      isCanceledRef.current = true
    }
    setIsGenerating(false)
    setResponseReady(false)
    setStreamingStarted(false)
    setControlsLocked(false)
    if (controlsUnlockTimerRef.current !== null) {
      clearTimeout(controlsUnlockTimerRef.current)
      controlsUnlockTimerRef.current = null
    }
    currentMessageIdRef.current = null
  }

  const handleAnswerNow = () => {
    if (currentMessageIdRef.current) {
      // Mark as complete so StreamingText shows full content instantly and finishes
      setMessages((prev) => 
        prev.map((msg) => 
          msg.id === currentMessageIdRef.current ? { ...msg, truncatedContent: "__COMPLETE__" } : msg
        )
      )
    }
  }

  const handleClearChat = () => {
    handleStopGeneration()
    setMessages([
      {
        id: "1",
        role: "assistant",
        content:
          "Hello! I'm your LLM Assistant. You can upload files (PDF, TXT, DOCX) or provide website URLs, then ask me questions. I'll help you find answers based on your provided sources.",
        sources: [],
        timestamp: new Date(),
      },
    ])
    setUploadedFiles([])
    setUploadedUrls([])
  }

  return (
    <ChatInterface
      messages={messages}
      uploadedFiles={uploadedFiles}
      uploadedUrls={uploadedUrls}
      onSendMessage={handleSendMessage}
      onFilesAdded={handleFilesAdded}
      onUrlAdded={handleUrlAdded}
      onRemoveFile={handleRemoveFile}
      onRemoveUrl={handleRemoveUrl}
      onClearChat={handleClearChat}
      isGenerating={isGenerating}
      responseReady={responseReady}
      onStopGeneration={handleStopGeneration}
      onAnswerNow={handleAnswerNow}
      onStreamingComplete={handleStreamingComplete}
      onStreamingStart={handleStreamingStart}
      streamingStarted={streamingStarted}
      controlsLocked={controlsLocked}
    />
  )
}

export default App