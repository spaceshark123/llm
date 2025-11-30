import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050/api"

interface ModelSelectorProps {
  onModelChange?: (model: string) => void
}

export function ModelSelector({ onModelChange }: ModelSelectorProps) {
  const [models, setModels] = useState<string[]>([])
  const [currentModel, setCurrentModel] = useState<string>("")
  const [isOpen, setIsOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [newModelInput, setNewModelInput] = useState("")
  const [isAddingModel, setIsAddingModel] = useState(false)
  const [validModels, setValidModels] = useState<string[]>([])
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])

  useEffect(() => {
    fetchModels()
    fetchValidModels()
  }, [])

  const fetchValidModels = async () => {
    try {
      const response = await fetch(`${API_URL}/models/valid`)
      if (response.ok) {
        const data = await response.json()
        setValidModels(data.valid_models || [])
      }
    } catch (error) {
      console.error("Failed to fetch valid models:", error)
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value
    setNewModelInput(input)
    
    // Filter valid models based on input
    if (input.trim()) {
      const filtered = validModels.filter((model) =>
        model.toLowerCase().includes(input.toLowerCase())
      )
      setFilteredSuggestions(filtered.slice(0, 5))
    } else {
      setFilteredSuggestions([])
    }
  }

  const selectSuggestion = (suggestion: string) => {
    setNewModelInput(suggestion)
    setFilteredSuggestions([])
  }

  const fetchModels = async () => {
    try {
      setError(null)
      console.log("Fetching models from:", `${API_URL}/models`)
      const response = await fetch(`${API_URL}/models`)
      console.log("Response status:", response.status)
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log("Models data:", data)
      
      setModels(data.available || [])
      setCurrentModel(data.current || "")
    } catch (error) {
      console.error("Failed to fetch models:", error)
      const errorMessage = error instanceof Error ? error.message : "Failed to load models"
      setError(errorMessage)
      console.error("Full error details:", { error, errorMessage, apiUrl: API_URL })
    }
  }

  const handleModelChange = async (model: string) => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch(`${API_URL}/models`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model }),
      })

      if (!response.ok) {
        let errorMessage = "Failed to switch model"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      setCurrentModel(model)
      setIsOpen(false)
      onModelChange?.(model)
    } catch (error) {
      console.error("Failed to switch model:", error)
      setError(error instanceof Error ? error.message : "Failed to switch model")
    } finally {
      setIsLoading(false)
    }
  }

  const handleAddModel = async () => {
    if (!newModelInput.trim()) {
      setError("Model name cannot be empty")
      return
    }

    // Validate that model is in valid models list
    if (!validModels.includes(newModelInput.trim())) {
      setError(`"${newModelInput.trim()}" is not a valid Groq model. Please select from the suggestions or check the Groq documentation.`)
      return
    }

    setIsAddingModel(true)
    setError(null)
    try {
      console.log("Adding model to:", `${API_URL}/models/add`)
      const response = await fetch(`${API_URL}/models/add`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ model: newModelInput.trim() }),
      })

      console.log("Add model response status:", response.status)

      if (!response.ok) {
        let errorMessage = "Failed to add model"
        try {
          const errorData = await response.json()
          errorMessage = errorData.error || errorMessage
        } catch {
          errorMessage = `HTTP ${response.status}: ${response.statusText}`
        }
        throw new Error(errorMessage)
      }

      const data = await response.json()
      console.log("Model added successfully:", data)
      setModels(data.available || [])
      setNewModelInput("")
    } catch (error) {
      console.error("Failed to add model:", error)
      setError(error instanceof Error ? error.message : "Failed to add model")
    } finally {
      setIsAddingModel(false)
    }
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        className="gap-2 text-xs"
        onClick={() => setIsOpen(!isOpen)}
        disabled={isLoading}
        title="Select LLM Model"
      >
        <span>Model:</span>
        <span className="font-medium truncate max-w-[140px]">
          {currentModel ? currentModel : "Unknown"}
        </span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </Button>

      {isOpen && (
        <div className="absolute top-full right-0 mt-1 w-72 bg-popover border border-border rounded-md shadow-lg z-50">
          <div className="p-3 space-y-3">
            {/* Available Models List */}
            <div>
              <div className="text-xs font-semibold text-foreground mb-2">Available Models:</div>
              <div className="space-y-1 max-h-48 overflow-y-auto border border-border rounded p-2 bg-background">
                {models.map((model) => (
                  <button
                    key={model}
                    onClick={() => handleModelChange(model)}
                    disabled={isLoading}
                    className={`w-full text-left px-3 py-2 rounded cursor-pointer text-sm transition-colors ${
                      currentModel === model
                        ? "bg-primary text-primary-foreground"
                        : "hover:bg-accent text-foreground disabled:opacity-50"
                    }`}
                  >
                    {model}
                  </button>
                ))}
              </div>
            </div>

            {/* Add Model Section */}
            <div className="pt-2 border-t border-border space-y-2">
              <div className="text-xs font-semibold text-foreground">Add Custom Model:</div>
              <div className="space-y-1 relative">
                <input
                  type="text"
                  value={newModelInput}
                  onChange={handleInputChange}
                  onKeyPress={(e) => {
                    if (e.key === "Enter") {
                      handleAddModel()
                    }
                  }}
                  placeholder="e.g., mixtral-8x7b-32768"
                  className="w-full px-3 py-2 rounded text-sm border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                  disabled={isAddingModel}
                  autoComplete="off"
                />
                
                {/* Suggestions dropdown */}
                {filteredSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 bg-background border border-border rounded shadow-lg z-50">
                    {filteredSuggestions.map((suggestion) => (
                      <button
                        key={suggestion}
                        onClick={() => selectSuggestion(suggestion)}
                        className="w-full text-left px-3 py-2 text-sm hover:bg-accent cursor-pointer text-foreground first:rounded-t last:rounded-b transition-colors"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                )}
                
                <button
                  onClick={handleAddModel}
                  disabled={isAddingModel || !newModelInput.trim() || !validModels.includes(newModelInput.trim())}
                  className="w-full px-3 py-2 rounded text-sm bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed enabled:cursor-pointer transition-colors"
                  title={!validModels.includes(newModelInput.trim()) && newModelInput.trim() ? "Model is not in the valid Groq models list" : ""}
                >
                  {isAddingModel ? "Adding..." : "Add Model"}
                </button>
              </div>
              <div className="text-xs text-muted-foreground italic">
                ⚠️ Model ID must match exactly as it appears in the Groq documentation
              </div>
            </div>

            {/* Error message */}
            {error && (
              <div className="px-3 py-2 text-xs text-destructive bg-destructive/10 rounded">
                {error}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}