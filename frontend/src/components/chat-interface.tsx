import { useState, useEffect } from "react"
import { ChatMessages } from "./chat-messages"
import { ChatInput } from "./chat-input"
import { SourceManager } from "./source-manager"
import type { ChatMessage } from "@/types/chat"
import { Button } from "@/components/ui/button"
import { SquarePen, Menu, Upload, X } from "lucide-react"
import type { Session } from "@/types/session"
import { API_BASE_URL } from "@/constants"

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
  sessions: Session[]
  currentSessionIndex: number
  setSessions: (sessions: Session[]) => void
  setCurrentSessionIndex: (index: number) => void
  processingFiles?: Set<string>
  onSelectedFilesChange?: (selectedFiles: Set<number>) => void
  onSelectedUrlsChange?: (selectedUrls: Set<number>) => void
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
  sessions,
  currentSessionIndex,
  setSessions,
  setCurrentSessionIndex,
  processingFiles = new Set(),
  onSelectedFilesChange,
  onSelectedUrlsChange,
}: ChatInterfaceProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [isDragOverChat, setIsDragOverChat] = useState(false)
  const [selectedFiles, setSelectedFiles] = useState<Set<number>>(
    new Set(Array.from({ length: uploadedFiles.length }, (_, i) => i))
  )
  const [selectedUrls, setSelectedUrls] = useState<Set<number>>(
    new Set(Array.from({ length: uploadedUrls.length }, (_, i) => i))
  )

  // When files are added externally, update selected state to include them
  useEffect(() => {
    const newSelection = new Set(Array.from({ length: uploadedFiles.length }, (_, i) => i))
    setSelectedFiles(newSelection)
    onSelectedFilesChange?.(newSelection)
  }, [uploadedFiles.length])

  // When URLs are added externally, update selected state to include them
  useEffect(() => {
    const newSelection = new Set(Array.from({ length: uploadedUrls.length }, (_, i) => i))
    setSelectedUrls(newSelection)
    onSelectedUrlsChange?.(newSelection)
  }, [uploadedUrls.length])

  const validateAndProcessFiles = (files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files)
    const validFiles = fileArray.filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase()
      return ["pdf", "txt", "docx", "png", "jpg", "jpeg"].includes(ext || "")
    })

    if (validFiles.length > 0) {
      onFilesAdded(validFiles)
      // Set all files (existing + new) as selected by default
      const newSelection = new Set(Array.from({ length: uploadedFiles.length + validFiles.length }, (_, i) => i))
      setSelectedFiles(newSelection)
      onSelectedFilesChange?.(newSelection)
    } else if (fileArray.length > 0) {
      alert("Please upload PDF, TXT, DOCX, PNG, JPG, or JPEG files only.")
    }
  }

  const handleToggleFile = (index: number) => {
    const newSet = new Set(selectedFiles)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setSelectedFiles(newSet)
    onSelectedFilesChange?.(newSet)
  }

  const handleToggleUrl = (index: number) => {
    const newSet = new Set(selectedUrls)
    if (newSet.has(index)) {
      newSet.delete(index)
    } else {
      newSet.add(index)
    }
    setSelectedUrls(newSet)
    onSelectedUrlsChange?.(newSet)
  }

  const handleSelectAllFiles = () => {
    const newSet = new Set(Array.from({ length: uploadedFiles.length }, (_, i) => i))
    setSelectedFiles(newSet)
    onSelectedFilesChange?.(newSet)
  }

  const handleDeselectAllFiles = () => {
    const newSet = new Set<number>()
    setSelectedFiles(newSet)
    onSelectedFilesChange?.(newSet)
  }

  const handleSelectAllUrls = () => {
    const newSet = new Set(Array.from({ length: uploadedUrls.length }, (_, i) => i))
    setSelectedUrls(newSet)
    onSelectedUrlsChange?.(newSet)
  }

  const handleDeselectAllUrls = () => {
    const newSet = new Set<number>()
    setSelectedUrls(newSet)
    onSelectedUrlsChange?.(newSet)
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

  const deleteSessionFolder = async (sessionId: string) => {
    try {
      const response = await fetch(`${API_BASE_URL}/history`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
          "Session-ID": sessionId,
        },
      })
      if (!response.ok) {
        console.error("Failed to delete session folder:", response.statusText)
      } else {
        console.log("Session folder deleted successfully")
      }
    } catch (error) {
      console.error("Error deleting session folder:", error)
    }
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
              <Button
                onClick={onClearChat}
                variant="outline"
                size="sm"
                className="w-full justify-start gap-2 bg-transparent cursor-pointer"
              >
                <SquarePen className="h-4 w-4" />
                New Chat
              </Button>
            </div>

            {/* Chat History Section */}
            <div className="space-y-2">
              <div className="text-sm font-semibold text-muted-foreground px-2">History</div>
              <div className="px-2 pt-2 rounded bg-muted/30 border border-dashed border-border">
                {sessions.length > 0 ? (
                  sessions.map((session, index) => (
                    <div className={currentSessionIndex === index ? "rounded w-full flex flex-row align-middle items-center border border-border mb-2 bg-gray-700!" : "rounded w-full flex flex-row align-middle items-center mb-2 border-border border bg-muted"} key={session.id}>
                      <Button
                        onClick={() => {
                          setCurrentSessionIndex(index)
                        }}
                        variant="outline"
                        size="sm"
                        className="text-left w-[90%] max-w-[90%] overflow-x-clip justify-start bg-transparent! border-none! cursor-pointer inline"
                      >
                        {session.name}
                      </Button>
                      <X className="rounded h-4 w-4 z-50 hover:text-red-500 hover:cursor-pointer" onClick={(e) => {
                            e.stopPropagation()
                            const newSessions = sessions.filter((_, i) => i !== index)
                            setSessions(newSessions)
                            if (currentSessionIndex === index) {
                              setCurrentSessionIndex(-1)
                            } else if (currentSessionIndex > index) {
                              setCurrentSessionIndex(currentSessionIndex - 1)
                            }
                            // also delete session folder
                            deleteSessionFolder(session.id)
                          }} />
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-muted-foreground text-center mb-2">Chat history will appear here</p>
                )}
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
            <Button variant="ghost" size="sm" onClick={() => setSidebarOpen(!sidebarOpen)} className="cursor-pointer">
              <Menu className="h-5 w-5" />
            </Button>
            <h2 className="text-lg font-semibold text-foreground">Assistant{sessions[currentSessionIndex]?.name ? ": " + sessions[currentSessionIndex]?.name : ""}</h2>
          </div>
        </div>

        {/* Chat messages and source manager */}
        <div
          className={`flex-1 w-full overflow-y-auto transition-colors relative ${isDragOverChat ? "bg-primary/5" : ""
            }`}
          onDragOver={handleChatDragOver}
          onDragLeave={handleChatDragLeave}
          onDrop={handleChatDrop}
        >
          <div className="flex flex-col h-full">
            {/* Messages */}
            <div className="w-full scroll-auto">
              {/* Sources section */}
              <div className="sticky top-0 z-40 bg-background border-b border-border">
                {(uploadedFiles.length > 0 || uploadedUrls.length > 0 || processingFiles.size > 0) && (
                  <SourceManager
                    files={uploadedFiles}
                    urls={uploadedUrls}
                    processingFiles={processingFiles}
                    onRemoveFile={onRemoveFile}
                    onRemoveUrl={onRemoveUrl}
                    selectedFiles={selectedFiles}
                    selectedUrls={selectedUrls}
                    onToggleFile={handleToggleFile}
                    onToggleUrl={handleToggleUrl}
                    onSelectAllFiles={handleSelectAllFiles}
                    onDeselectAllFiles={handleDeselectAllFiles}
                    onSelectAllUrls={handleSelectAllUrls}
                    onDeselectAllUrls={handleDeselectAllUrls}
                  />
                )}
              </div>
              <ChatMessages messages={messages} onStreamingComplete={onStreamingComplete} onStreamingStart={onStreamingStart} />
            </div>
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
            onSendMessage={(message) => {
              // Filter to only selected files and URLs for sending
              const selectedFilesList = uploadedFiles.filter((_, idx) => selectedFiles.has(idx))
              const selectedUrlsList = uploadedUrls.filter((_, idx) => selectedUrls.has(idx))

              console.log(`Sending with ${selectedFilesList.length}/${uploadedFiles.length} files and ${selectedUrlsList.length}/${uploadedUrls.length} URLs selected`)

              // Send message - backend will use only files in fileContents that are from selected sources
              onSendMessage(message)
            }}
            onFilesAdded={onFilesAdded}
            onUrlAdded={onUrlAdded}
            isGenerating={isGenerating}
            responseReady={responseReady}
            onStopGeneration={onStopGeneration}
            onAnswerNow={onAnswerNow}
            streamingStarted={streamingStarted}
            controlsLocked={controlsLocked}
            isProcessingFiles={processingFiles.size > 0}
          />
        </div>
      </div>
    </div>
  )
}
