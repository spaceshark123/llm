import { useState } from "react"
import { ChatMessages } from "./chat-messages"
import { ChatInput } from "./chat-input"
import { SourceManager } from "./source-manager"
import type { ChatMessage } from "@/types/chat"
import { Button } from "@/components/ui/button"
import { RotateCcw, Menu, Upload } from "lucide-react"

interface ChatInterfaceProps {
  messages: ChatMessage[]
  uploadedFiles: File[]
  uploadedUrls: string[]
  onSendMessage: (message: string) => void
  onFilesAdded: (files: File[]) => void
  onUrlAdded: (url: string) => void
  onRemoveFile: (index: number) => void
  onRemoveUrl: (index: number) => void
  onClearChat: () => void
  isGenerating?: boolean
  responseReady?: boolean
  onStopGeneration?: () => void
  onAnswerNow?: () => void
  onStreamingComplete?: (messageId: string) => void
  onStreamingStart?: (messageId: string) => void
  streamingStarted?: boolean
  controlsLocked?: boolean
}

export function ChatInterface({
  messages,
  uploadedFiles,
  uploadedUrls,
  onSendMessage,
  onFilesAdded,
  onUrlAdded,
  onRemoveFile,
  onRemoveUrl,
  onClearChat,
  isGenerating = false,
  responseReady = false,
  onStopGeneration,
  onAnswerNow,
  onStreamingComplete,
  onStreamingStart,
  streamingStarted = false,
  controlsLocked = false,
}: ChatInterfaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDragOverChat, setIsDragOverChat] = useState(false)

  const validateAndProcessFiles = (files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files)
    const validFiles = fileArray.filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase()
      return ["pdf", "txt", "doc", "docx"].includes(ext || "")
    })

    if (validFiles.length > 0) {
      onFilesAdded(validFiles)
    } else if (fileArray.length > 0) {
      alert("Please upload PDF, TXT, DOC, or DOCX files only.")
    }
  }

  const handleChatDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverChat(true)
  }

  const handleChatDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverChat(false)
  }

  const handleChatDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverChat(false)
    validateAndProcessFiles(e.dataTransfer.files)
  }

  return (
    <div className="flex w-screen h-screen bg-background">
      <div
        className={`${sidebarOpen ? "w-64" : "w-0"
          } transition-all duration-300 bg-card border-r border-border flex flex-col overflow-hidden`}
      >
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">LLM Chat</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-4">
            {/* New Chat Section */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground px-2">New</div>
              {messages.length > 0 && (
                <Button
                  onClick={onClearChat}
                  variant="outline"
                  size="sm"
                  className="w-full justify-start gap-2 bg-transparent"
                >
                  <RotateCcw className="h-4 w-4" />
                  New Chat
                </Button>
              )}
            </div>

            {/* Chat History Section */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground px-2">History</div>
              <div className="px-2 py-3 rounded bg-muted/30 border border-dashed border-border">
                <p className="text-xs text-muted-foreground text-center">Chat history will appear here</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between w-full z-50">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)}>
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground">Assistant</h2>
          </div>
        </div>

        {/* Chat messages and source manager */}
        <div 
          className={`flex-1 w-full overflow-y-auto transition-colors relative ${
            isDragOverChat ? "bg-primary/5" : ""
          }`}
          onDragOver={handleChatDragOver}
          onDragLeave={handleChatDragLeave}
          onDrop={handleChatDrop}
        >
          <div className="flex flex-col h-full">
            {/* Sources section */}
            {(uploadedFiles.length > 0 || uploadedUrls.length > 0) && (
              <SourceManager
                files={uploadedFiles}
                urls={uploadedUrls}
                onRemoveFile={onRemoveFile}
                onRemoveUrl={onRemoveUrl}
              />
            )}

            {/* Messages */}
            <ChatMessages messages={messages} onStreamingComplete={onStreamingComplete} onStreamingStart={onStreamingStart} />
          </div>

          {/* Drag overlay hint */}
          {isDragOverChat && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20 rounded pointer-events-none">
              <div className="flex flex-col items-center gap-2 text-white">
                <Upload className="h-12 w-12" />
                <p className="text-lg font-semibold">Drop files to upload</p>
              </div>
            </div>
          )}
        </div>

        {/* Input area */}
        <div className="border-t">
          <ChatInput 
            onSendMessage={onSendMessage} 
            onFilesAdded={onFilesAdded} 
            onUrlAdded={onUrlAdded}
            isGenerating={isGenerating}
            responseReady={responseReady}
            onStopGeneration={onStopGeneration}
            onAnswerNow={onAnswerNow}
            streamingStarted={streamingStarted}
            controlsLocked={controlsLocked}
          />
        </div>
      </div>
    </div>
  )
}
