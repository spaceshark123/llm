import { Button } from "@/components/ui/button"
import { useState, useMemo } from "react"
import { X, FileText, Globe, ChevronDown, ChevronUp } from "lucide-react"
import { Spinner } from "@/components/ui/spinner"

interface SourceManagerProps {
  files: File[]
  urls: Array<{ url: string; urlHash: string; name: string }> | string[]
  onRemoveFile: (index: number) => void
  onRemoveUrl: (index: number) => void
  selectedFiles?: Set<number>
  selectedUrls?: Set<number>
  onToggleFile?: (index: number) => void
  onToggleUrl?: (index: number) => void
  onSelectAllFiles?: () => void
  onDeselectAllFiles?: () => void
  onSelectAllUrls?: () => void
  onDeselectAllUrls?: () => void
  processingFiles?: Set<string>
  processingUrls?: Set<string>
}

export function SourceManager({
  files,
  urls,
  onRemoveFile,
  onRemoveUrl,
  selectedFiles = new Set(Array.from({ length: files.length }, (_, i) => i)),
  selectedUrls = new Set(Array.from({ length: urls.length }, (_, i) => i)),
  onToggleFile,
  onToggleUrl,
  onSelectAllFiles,
  onDeselectAllFiles,
  onSelectAllUrls,
  onDeselectAllUrls,
  processingFiles = new Set<string>(),
  processingUrls = new Set<string>(),
}: SourceManagerProps) {
  const [expanded, setExpanded] = useState(true)
  const processingArray = useMemo(() => 
    Array.from(processingFiles), 
    [processingFiles]
  );
  const processingUrlsArray = useMemo(() => 
    Array.from(processingUrls), 
    [processingUrls]
  );

  // Show bar if any real sources OR any in-flight processing (files or URLs)
  if (files.length === 0 && urls.length === 0 && processingFiles.size === 0 && processingUrls.size === 0) {
    return null
  }

  const totalSources = files.length + urls.length
  const selectedCount = selectedFiles.size + selectedUrls.size
  const allSelected = selectedCount === totalSources

  return (
    <div className="border-b border-border bg-muted/30 px-6 py-4">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <p className="text-sm font-semibold text-foreground">Active Sources ({selectedCount}/{totalSources})</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setExpanded(!expanded)}
              className="h-6 w-6 p-0 cursor-pointer"
              title={expanded ? "Collapse" : "Expand"}
            >
              {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </Button>
          </div>
          {totalSources > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                if (allSelected) {
                  // Deselect all
                  onDeselectAllFiles?.()
                  onDeselectAllUrls?.()
                } else {
                  // Select all
                  onSelectAllFiles?.()
                  onSelectAllUrls?.()
                }
              }}
              className="text-xs cursor-pointer h-auto px-2 py-1"
              title={allSelected ? "Deselect all" : "Select all"}
            >
              {allSelected ? "Deselect All" : "Select All"}
            </Button>
          )}
        </div>

        {expanded && (
          <div className="flex flex-wrap gap-2">
            {/* Files */}
            {files.map((file, idx) => {
              const isSelected = selectedFiles.has(idx)
              console.log('processingFiles:', processingFiles);
              console.log('file.name:', file.name);
              return (
                <div
                  key={`file-${idx}`}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${isSelected
                    ? "bg-primary/10 border border-primary/20"
                    : "bg-muted border border-muted-foreground/20 opacity-50"
                    }`}
                >
                  {processingArray.some((name) => name.includes(file.name)) ? <Spinner /> : <input
                    type="checkbox"
                    checked={isSelected}
                    onChange={() => onToggleFile?.(idx)}
                    className="h-4 w-4 cursor-pointer"
                    title="Include/exclude this file"
                  />
                  }
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span className="text-foreground truncate max-w-[120px]">{file.name}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-primary/20 cursor-pointer"
                    onClick={() => onRemoveFile(idx)}
                    title="Remove file"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}

            {/* URLs */}
            {urls.map((url, idx) => {
              const isSelected = selectedUrls.has(idx)
              const urlString = typeof url === 'string' ? url : url.url
              const isProcessing = processingUrlsArray.includes(urlString)
              
              return (
                <div
                  key={`url-${idx}`}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm transition-colors ${isSelected
                    ? "bg-accent/10 border border-accent/20"
                    : "bg-muted border border-muted-foreground/20 opacity-50"
                    }`}
                >
                  {isProcessing ? (
                    <Spinner />
                  ) : (
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => onToggleUrl?.(idx)}
                      className="h-4 w-4 cursor-pointer"
                      title="Include/exclude this URL"
                    />
                  )}
                  <Globe className="h-3.5 w-3.5 text-accent-foreground" />
                  <span className="text-foreground truncate max-w-[120px]">{urlString}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-4 w-4 p-0 hover:bg-accent/20 cursor-pointer"
                    onClick={() => onRemoveUrl(idx)}
                    title="Remove URL"
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )
            })}
            {/* Show spinners for any processing files that have not yet produced a file entry */}
            {files.length === 0 && processingArray.length > 0 && processingArray.map((procId) => (
              <div key={`pf-${procId}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-primary/10 border border-primary/20">
                <Spinner />
                <FileText className="h-3.5 w-3.5 text-primary" />
                <span className="text-foreground truncate max-w-[120px]">Uploading...</span>
              </div>
            ))}
            {urls.length === 0 && processingUrlsArray.length > 0 && processingUrlsArray.map((procUrl) => (
              <div key={`pu-${procUrl}`} className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm bg-accent/10 border border-accent/20">
                <Spinner />
                <Globe className="h-3.5 w-3.5 text-accent-foreground" />
                <span className="text-foreground truncate max-w-[120px]">Fetching...</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
