import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Send, Paperclip, LinkIcon, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"

interface ChatInputProps {
  onSendMessage: (message: string) => void
  onFilesAdded: (files: File[]) => void
  onUrlAdded: (url: string) => void
}

export function ChatInput({ onSendMessage, onFilesAdded, onUrlAdded }: ChatInputProps) {
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [urlInput, setUrlInput] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = () => {
    if (input.trim()) {
      setIsLoading(true)
      onSendMessage(input.trim())
      setInput("")
      // Reset loading after response
      setTimeout(() => setIsLoading(false), 1100)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.currentTarget.files || [])
    const validFiles = files.filter((file) => {
      const ext = file.name.split(".").pop()?.toLowerCase()
      return ["pdf", "txt", "doc", "docx"].includes(ext || "")
    })

    if (validFiles.length > 0) {
      onFilesAdded(validFiles)
    } else {
      alert("Please upload PDF, TXT, DOC, or DOCX files only.")
    }

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleAddUrl = () => {
    if (urlInput.trim()) {
      try {
        new URL(urlInput.trim())
        onUrlAdded(urlInput.trim())
        setUrlInput("")
      } catch {
        alert("Please enter a valid URL.")
      }
    }
  }

  return (
    <div className="border-t border-border bg-card p-4">
      <div className="max-w-4xl mx-auto space-y-3">
        <div className="flex gap-2">
          {/* File upload */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" title="Upload file (PDF, TXT, DOC, DOCX)">
                <Paperclip className="h-4 w-4" />
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Upload Files</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">Supported formats: PDF, TXT, DOC, DOCX</p>
                <input
                  ref={fileInputRef}
                  type="file"
                  multiple
                  accept=".pdf,.txt,.doc,.docx"
                  onChange={handleFileSelect}
                  className="block w-full text-sm file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                />
              </div>
            </DialogContent>
          </Dialog>

          {/* URL input */}
          <Dialog>
            <DialogTrigger asChild>
              <Button variant="outline" size="icon" title="Add URL">
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
                  <Button onClick={handleAddUrl}>Add</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          {/* Message input */}
          <Input
            placeholder="Ask a question about your sources..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            className="flex-1"
          />

          {/* Send button */}
          <Button onClick={handleSend} disabled={!input.trim() || isLoading} size="icon">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground text-center">Shift + Enter for new line</p>
      </div>
    </div>
  )
}
