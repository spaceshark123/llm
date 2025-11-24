import { useState } from "react"
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
    let response;
    let data;
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
      });
      data = await response.json();
      console.log("Backend response:", data);
    } catch (error) {
      console.error("Error communicating with backend:", error);
    }

    let reply = `This is a placeholder response for: "${content}". Connect backend to see real AI responses. Files uploaded: ${uploadedFiles.length}, URLs added: ${uploadedUrls.length}.`
    reply = `# Welcome to the LLM Assistant

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

    // Add AI response message
    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: reply,
      sources: data?.sources || uploadedFiles.map((f) => f.name).concat(uploadedUrls),
      timestamp: new Date(),
    }
    setMessages((prev) => [...prev, aiMessage])
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