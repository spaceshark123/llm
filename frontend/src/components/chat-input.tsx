import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Paperclip, LinkIcon, Square, Zap } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  onFilesAdded: (files: File[]) => void
  onUrlAdded: (url: string) => void
  isGenerating?: boolean
  responseReady?: boolean
  onStopGeneration?: () => void
  onAnswerNow?: () => void
  streamingStarted?: boolean
  controlsLocked?: boolean
  isProcessingFiles?: boolean
}

export function ChatInput({ onSendMessage, onFilesAdded, onUrlAdded, isGenerating = false, responseReady = false, onStopGeneration, onAnswerNow, streamingStarted = false, controlsLocked = false, isProcessingFiles = false }: ChatInputProps) {
  const [input, setInput] = useState("")
  const [urlInput, setUrlInput] = useState("")
  const [isDragOverInput, setIsDragOverInput] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const [urlModalOpen, setUrlModalOpen] = useState(false)

  const handleSend = () => {
    // Trim leading/trailing whitespace but preserve internal newlines
    const trimmedInput = input.trim()
    if (trimmedInput && !isGenerating) {
      onSendMessage(trimmedInput)
      setInput("")
      // Reset textarea height after sending
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto"
      }
    }
  }

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current
    if (!textarea) return

    // Reset height to auto to get the correct scrollHeight
    textarea.style.height = "auto"
    // Set to scrollHeight to expand with content
    const newHeight = Math.min(textarea.scrollHeight, 120)
    textarea.style.height = `${newHeight}px`
    // Auto-scroll to bottom of textarea content
    textarea.scrollTop = textarea.scrollHeight
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value)
    adjustTextareaHeight()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey && !isGenerating) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    validateAndProcessFiles(e.currentTarget.files)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleAddUrl = () => {
    if (urlInput.trim()) {
      try {
        new URL(urlInput.trim())
        setUrlModalOpen(false)
        onUrlAdded(urlInput.trim())
        setUrlInput("")
      } catch {
        alert("Please enter a valid URL.")
      }
    }
  }

  const validateAndProcessFiles = (files: FileList | null) => {
    if (!files) return

    const fileArray = Array.from(files)
    const validFiles = fileArray.filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase()
      return ["pdf", "txt", "docx", "png", "jpg", "jpeg"].includes(ext || "")
    })

    if (validFiles.length > 0) {
      onFilesAdded(validFiles)
    } else if (fileArray.length > 0) {
      alert("Please upload PDF, TXT, DOCX, PNG, JPG, or JPEG files only.")
    }
  }

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverInput(true)
  }

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverInput(false)
  }

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragOverInput(false)
    validateAndProcessFiles(e.dataTransfer.files)
  }

  return (
    <div className="border-t border-border bg-card p-4">
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="flex gap-2">
          {/* File upload */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" title="Upload file (PDF, TXT, DOCX, PNG, JPG, JPEG)" className="cursor-pointer">
                <Paperclip className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Files</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Supported formats: PDF, TXT, DOCX, PNG, JPG, JPEG</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.docx,.png,.jpg,.jpeg"
                  onChange={handleFileSelect}
                  className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90 file:cursor-pointer"
                />
              </div>
            </DialogContent>
          </Dialog>

          {/* URL input */}
          <Dialog open={urlModalOpen} onOpenChange={setUrlModalOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" title="Add URL" className="cursor-pointer">
                <LinkIcon className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Website URL</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Enter a website URL to use as a knowledge source</p>
                <div className="flex gap-2">
                  <Input
                    placeholder="https://example.com"
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleAddUrl()
                      }
                    }}
                  />
                  <Button onClick={handleAddUrl} className="cursor-pointer">Add</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Message input with drag-and-drop */}
          <div
            className={`flex-1 transition-colors ${
              isDragOverInput ? "rounded bg-primary/10" : ""
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <textarea
              ref={textareaRef}
              placeholder="Ask a question about your sources... (or drag files here)"
              value={input}
              onChange={handleInputChange}
              onKeyDown={handleKeyDown}
              disabled={isGenerating || isProcessingFiles}
              className="flex-1 w-full px-3 py-2 rounded-md border border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 resize-none min-h-[40px] max-h-[120px] overflow-y-auto"
              rows={1}
            />
          </div>

          {/* Send/Stop/Answer Now buttons */}
          {isGenerating ? (
            <>
              <Button onClick={onStopGeneration} disabled={!streamingStarted || !responseReady || controlsLocked} variant="destructive" size="icon" title="Stop generating" className="cursor-pointer">
                <Square className="h-4 w-4" />
              </Button>
              {responseReady && (
                <Button onClick={onAnswerNow} disabled={controlsLocked} variant="outline" size="sm" title="Complete answer instantly" className="gap-2 cursor-pointer">
                  <Zap className="h-4 w-4" />
                  Answer Now
                </Button>
              )}
            </>
          ) : (
            <Button onClick={handleSend} disabled={!input.trim() || isProcessingFiles} size="icon" title={isProcessingFiles ? "Please wait for files to process" : "Send message"} className="cursor-pointer">
              <Send className="h-4 w-4" />
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground text-center">Shift + Enter for new line • Drag files to upload</p>
      </div>
    </div>
  )
}
