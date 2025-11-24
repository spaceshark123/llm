import { Button } from "@/components/ui/button"
import { X, FileText, Globe } from "lucide-react"

interface SourceManagerProps {
  files: File[]
  urls: string[]
  onRemoveFile: (index: number) => void
  onRemoveUrl: (index: number) => void
}

export function SourceManager({ files, urls, onRemoveFile, onRemoveUrl }: SourceManagerProps) {
  if (files.length === 0 && urls.length === 0) {
    return null
  }

  return (
    <div className="border-b border-border bg-muted/30 px-6 py-4">
      <div className="max-w-4xl mx-auto">
        <p className="text-sm font-semibold text-foreground mb-3">Active Sources</p>
        <div className="flex flex-wrap gap-2">
          {/* Files */}
          {files.map((file, idx) => (
            <div
              key={`file-${idx}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/20 rounded-full text-sm"
            >
              <FileText className="h-3.5 w-3.5 text-primary" />
              <span className="text-foreground truncate max-w-[150px]">{file.name}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-primary/20"
                onClick={() => onRemoveFile(idx)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}

          {/* URLs */}
          {urls.map((url, idx) => (
            <div
              key={`url-${idx}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 bg-accent/10 border border-accent/20 rounded-full text-sm"
            >
              <Globe className="h-3.5 w-3.5 text-accent-foreground" />
              <span className="text-foreground truncate max-w-[150px]">{url}</span>
              <Button
                variant="ghost"
                size="sm"
                className="h-4 w-4 p-0 hover:bg-accent/20"
                onClick={() => onRemoveUrl(idx)}
              >
                <X className="h-3 w-3" />
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
