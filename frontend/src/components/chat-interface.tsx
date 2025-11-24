import { useState } from "react"
import { ChatMessages } from "./chat-messages"
import { ChatInput } from "./chat-input"
import { SourceManager } from "./source-manager"
import type { ChatMessage } from "@/types/chat"
import { Button } from "@/components/ui/button"
import { RotateCcw, Menu } from "lucide-react"

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
}: ChatInterfaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)

  return (
    <div className="flex w-screen h-screen bg-background">
      <div
        className={`${
          sidebarOpen ? "w-64" : "w-0"
        } transition-all duration-300 bg-card border-r border-border flex flex-col`}
      >
        <div className="p-4 border-b border-border">
          <h1 className="text-xl font-bold text-foreground">LLM Chat</h1>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-2">
            <div className="text-sm text-muted-foreground px-2">Conversation</div>
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
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="border-b border-border bg-card px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden">
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground">Assistant</h2>
          </div>
        </div>

        {/* Chat messages and source manager */}
        <div className="flex-1 overflow-y-auto flex flex-col">
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
          <ChatMessages messages={messages} />
        </div>

        {/* Input area */}
        <ChatInput onSendMessage={onSendMessage} onFilesAdded={onFilesAdded} onUrlAdded={onUrlAdded} />
      </div>
    </div>
  )
}
