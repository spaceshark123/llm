import { useState } from "react"
import { ChatInterface } from "@/components/chat-interface"
import type { ChatMessage } from "@/types/chat"

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

    // TODO: Replace with your actual backend call
    // Example backend integration:
    // const response = await fetch('/api/chat', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     message: content,
    //     files: uploadedFiles,
    //     urls: uploadedUrls,
    //     conversationHistory: messages,
    //   }),
    // });
    // const data = await response.json();

    // Simulate AI response (placeholder)
    setTimeout(() => {
      const aiMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: `This is a placeholder response for: "${content}". Connect backend to see real AI responses. Files uploaded: ${uploadedFiles.length}, URLs added: ${uploadedUrls.length}.`,
        sources: uploadedFiles.map((f) => f.name).concat(uploadedUrls),
        timestamp: new Date(),
      }
      setMessages((prev) => [...prev, aiMessage])
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

  const handleClearChat = () => {
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
    />
  )
}

export default App