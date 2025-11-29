import { useState, useRef, useEffect } from "react"
import { ChatInterface } from "@/components/chat-interface"
import type { ChatMessage } from "@/types/chat"
import type { Session } from "@/types/session"
import { flushSync } from "react-dom"

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5050/api"
const initialMessage: string = "Hello! I'm your LLM Assistant. You can upload files (PDF, TXT, DOCX, PNG, JPG, JPEG) or provide website URLs, then ask me questions. I'll help you find answers based on your provided sources."

function App() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "1",
      role: "assistant",
      content:
        initialMessage,
      sources: [],
      timestamp: new Date(),
    },
  ])

  const [uploadedFiles, setUploadedFiles] = useState<File[]>([])
  const [uploadedUrls, setUploadedUrls] = useState<Array<{ url: string; urlHash: string; name: string }>>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [responseReady, setResponseReady] = useState(false)
  const [streamingStarted, setStreamingStarted] = useState(false)
  const [controlsLocked, setControlsLocked] = useState(false)
  const [sessions, setSessions] = useState<Session[]>([])
  const [currentSessionIndex, setCurrentSessionIndex] = useState(-1)
  const [processingFiles, setProcessingFiles] = useState<Set<string>>(new Set())
  const [processingUrls, setProcessingUrls] = useState<Set<string>>(new Set())
  const currentMessageIdRef = useRef<string | null>(null)
  const activeGenerationIdRef = useRef<number | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  const isCanceledRef = useRef(false)
  const controlsUnlockTimerRef = useRef<number | null>(null)
  const selectedFilesRef = useRef<Set<number>>(new Set())
  const selectedUrlsRef = useRef<Set<number>>(new Set())
  const messagesMetadataRef = useRef<Map<string, { fileMetadata?: any; urls?: string[] }>>(new Map())

  const fetchSessions = async () => {
    try {
      const response = await fetch(`${API_URL}/sessions`, {
        method: 'GET',
      })
      const data = await response.json()
      console.log("Fetched sessions:", data.sessions)
      
      // get session names as first 20 chars of first message in history
      const namesPromises = data.sessions.map(async (session: string) => {
        const historyResponse = await fetch(`${API_URL}/history`, {
          method: 'GET',
          headers: {
            'Session-ID': session,
          },
        })
        const historyData = await historyResponse.json()
        console.log("Fetched history for session:", session, historyData)
        let name = "New Session"
        if (historyData.history && historyData.history.length > 0) {
          name = (historyData.history[0].originalInput || historyData.history[0].content).slice(0, 20)
        } else {
          // no history, use file/url sources if any
          const sourcesResponse = await fetch(`${API_URL}/sources`, {
            method: 'GET',
            headers: {
              'Session-ID': session,
            },
          })
          const sourcesData = await sourcesResponse.json()
          console.log("Fetched sources for session:", session, sourcesData)
          if (sourcesData.files && sourcesData.files.length > 0) {
            name = sourcesData.files[0].name.slice(0, 20)
          } else if (sourcesData.urls && sourcesData.urls.length > 0) {
            name = sourcesData.urls[0].slice(0, 20)
          } else {
            const urlsResponse = await fetch(`${API_URL}/urls`, {
              method: 'GET',
              headers: {
                'Session-ID': session,
              },
            })
            const urlsData = await urlsResponse.json()
            console.log("Fetched URLs for session:", session, urlsData)
            if (urlsData.urls && urlsData.urls.length > 0) {
              name = urlsData.urls[0].url.slice(0, 20)
            }
          }
        }
        return { id: session, name: name } as Session
      })
      const sessionsWithNames = await Promise.all(namesPromises)
      setSessions(sessionsWithNames)
    } catch (error) {
      console.error("Error fetching sessions:", error)
    }
  }

  useEffect(() => {
    fetchSessions()
  }, []) // fetch sessions on mount

  useEffect(() => {
    if (isGenerating) return; // do not change messages while generating
    // update messages when current session changes to non -1
    if (currentSessionIndex !== -1) {
      const sessionId = sessions[currentSessionIndex]?.id
      if (sessionId) {
        fetch(`${API_URL}/history`, {
          method: 'GET',
          headers: {
            'Session-ID': sessionId,
          },
        })
          .then((response) => response.json())
          .then((data) => {
            console.log("Fetched history for session:", currentSessionIndex, data)
            if (data.history) {
              // Restore fileMetadata and urls from ref for user messages
              const messagesWithMetadata = data.history.map((msg: ChatMessage) => {
                const metadata = messagesMetadataRef.current.get(msg.id)
                if (metadata) {
                  return { ...msg, ...metadata }
                }
                return msg
              })
              setMessages(messagesWithMetadata)
            }
          })
          .catch((error) => {
            console.error("Error fetching history:", error)
          })
        // fetch sources if this is switching to an existing session, not a new one
        fetch(`${API_URL}/history`, {
          method: 'GET',
          headers: {
            'Session-ID': sessionId,
          },
        }).then((response) => response.json())
          .then((data) => {
              fetchSourcesForSession(sessionId)
          })
          .catch((error) => {
            console.error("Error fetching history for sources check:", error)
          })
        const fetchSourcesForSession = async (sessionId: string) => {
          try {
            // Fetch both regular files and URLs
            const [sourcesResponse, urlsResponse] = await Promise.all([
              fetch(`${API_URL}/sources`, {
                method: 'GET',
                headers: {
                  'Session-ID': sessionId,
                },
              }),
              fetch(`${API_URL}/urls`, {
                method: 'GET',
                headers: {
                  'Session-ID': sessionId,
                },
              })
            ])
            
            const sourcesData = await sourcesResponse.json()
            const urlsData = await urlsResponse.json()
            
            console.log("Fetched sources for session:", currentSessionIndex, sourcesData)
            console.log("Fetched URLs for session:", currentSessionIndex, urlsData)
            
            // Populate uploadedFiles and uploadedUrls based on data
            const files: File[] = []
            const urls: Array<{ url: string; urlHash: string; name: string }> = []
            
            sourcesData.files.forEach((fileInfo: { name: string; extension: string }) => {
              if (['pdf', 'txt', 'docx'].includes(fileInfo.extension)) {
                // create a dummy File object since we can't get the original file
                const dummyFile = new File([""], fileInfo.name, { type: "application/octet-stream" })
                files.push(dummyFile)
              } else if (['png', 'jpg', 'jpeg', 'gif', 'bmp'].includes(fileInfo.extension)) {
                const dummyFile = new File([""], fileInfo.name, { type: "image/" + fileInfo.extension })
                files.push(dummyFile)
              }
            })
            
            // Add URLs from the URLs endpoint
            if (urlsData.urls) {
              urlsData.urls.forEach((urlInfo: { url: string; urlHash: string; name: string }) => {
                urls.push(urlInfo)
              })
            }
            
            setUploadedFiles(files)
            setUploadedUrls(urls)
          } catch (error) {
            console.error("Error fetching sources:", error)
          }
        }
      }
    } else {
      // reset to initial message
      setMessages([
        {
          id: "1",
          role: "assistant",
          content:
            initialMessage,
          sources: [],
          timestamp: new Date(),
        },
      ])
    }
    console.log("updated messages for session index:", currentSessionIndex)
  }, [currentSessionIndex, isGenerating, sessions])

  useEffect(() => {
    console.log("Sessions updated:", sessions)
  }, [sessions])

  const handleSendMessage = async (content: string) => {
    // Prevent sending message if files or URLs are still being processed
    if (processingFiles.size > 0 || processingUrls.size > 0) {
      alert("Please wait for all files and URLs to finish processing before sending a message.")
      return
    }

    // Build file metadata
    // Only include selected files and URLs
    const fileMetadata: Array<{ name: string; type: string; size: number }> = []
    const fileContents: { [key: string]: string } = {}

    uploadedFiles.forEach((file, fileIndex) => {
      // Skip files that are not selected
      if (!selectedFilesRef.current.has(fileIndex)) {
        console.log(`Skipping deselected file: ${file.name}`)
        return
      }
      
      fileMetadata.push({
        name: file.name,
        type: file.type,
        size: file.size,
      })
    })

    // Filter URLs to only include selected ones
    const selectedUrls = uploadedUrls.filter((_, urlIndex) => {
      const isSelected = selectedUrlsRef.current.has(urlIndex)
      if (!isSelected) {
        console.log(`Skipping deselected URL: ${uploadedUrls[urlIndex].url}`)
      }
      return isSelected
    })
    
    // Add URL sources to file metadata for backend
    selectedUrls.forEach((urlObj) => {
      fileMetadata.push({
        name: urlObj.name,  // e.g., "02e91ca90a02.web"
        type: 'url',
        size: 0,
      })
    })

    // Add user message with file/URL metadata
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content,
      sources: [],
      timestamp: new Date(),
      fileMetadata: fileMetadata.length > 0 ? fileMetadata : undefined,
      urls: selectedUrls.length > 0 ? selectedUrls.map(u => u.url) : undefined,
      originalInput: content,
    }
    // Store metadata in ref to preserve when history is refetched
    messagesMetadataRef.current.set(userMessage.id, {
      fileMetadata: userMessage.fileMetadata,
      urls: userMessage.urls,
    })
    flushSync(() => {
      setMessages((prev) => [...prev, userMessage])
    })
    // Give React a chance to paint the update NOW
    await new Promise(resolve => setTimeout(resolve, 0));
    setIsGenerating(true)
    setResponseReady(false)
    setStreamingStarted(false)
    isCanceledRef.current = false
    // Reset any prior control lock
    setControlsLocked(false)
    if (controlsUnlockTimerRef.current !== null) {
      clearTimeout(controlsUnlockTimerRef.current)
      controlsUnlockTimerRef.current = null
    }

    // Create a new generation id and abort controller for this request
    const generationId = Date.now()
    activeGenerationIdRef.current = generationId
    const controller = new AbortController()
    abortControllerRef.current = controller

    // Backend call with cancellation support
    // check if this is the first message to start a new session
    let sessionId = "";
    if (currentSessionIndex === -1) {
      // create a new session id
      sessionId = `session-${Date.now()}`
      // name after first message
      const newSessionName = content.slice(0, 20) + (content.length > 20 ? "..." : "")
      const newSession: Session = { id: sessionId, name: newSessionName }
      setCurrentSessionIndex(sessions.length)
      setSessions((prev) => [...prev, newSession])
      // clear initial message
      setMessages([userMessage])
      console.log("Created new session:", sessionId, newSessionName)
      console.log("Sessions now:", sessions)
      console.log("Current session index now:", sessions.length)
    } else {
      sessionId = sessions[currentSessionIndex]?.id
    }

    // Log details
    console.log(`Sending message with ${fileMetadata.length} files and ${selectedUrls.length} URLs`)
    console.log("File contents details:", Object.keys(fileContents))

    let response
    let data
    try {
      // Use JSON body to send message and file metadata
      response = await fetch(`${API_URL}/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Session-ID': sessionId,
        },
        body: JSON.stringify({
          message: content,
          selectedSources: fileMetadata.map(f => ({ name: f.name, size: f.size })), // send selected file names and sizes for RAG filtering
        }),
        signal: controller.signal,
      })

      data = await response.json();
      console.log("Backend response:", data);
    } catch (error) {
      // If aborted or generation superseded, silently exit
      if ((error as any)?.name === 'AbortError') {
        return
      }
      console.error("Error communicating with backend:", error);
      // On error, if user already stopped, do nothing further
      if (activeGenerationIdRef.current !== generationId) {
        return
      }
      // We won't add a placeholder response on error; end generation state
      setIsGenerating(false)
      setResponseReady(false)
      setStreamingStarted(false)
      return
    }

    // If this generation was canceled before the response arrived, do nothing
    if (activeGenerationIdRef.current !== generationId || isCanceledRef.current) {
      return
    }

    let reply = `I'm sorry, I couldn't generate a response.`
    if (response && response.ok) {
      reply = data.reply;
    }

    // Add AI response message with streaming animation
    const aiMessage: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: "assistant",
      content: reply,
      sources: data?.sources || uploadedFiles.map((f) => f.name).concat(uploadedUrls.map(u => u.url)),
      timestamp: new Date(),
      isStreaming: true,
    }
    currentMessageIdRef.current = aiMessage.id
    setMessages((prev) => [...prev, aiMessage])
    setResponseReady(true)
    // Lock controls for 1 second after backend response is ready
    setControlsLocked(true)
    if (controlsUnlockTimerRef.current !== null) {
      clearTimeout(controlsUnlockTimerRef.current)
      controlsUnlockTimerRef.current = null
    }
    controlsUnlockTimerRef.current = window.setTimeout(() => {
      setControlsLocked(false)
      controlsUnlockTimerRef.current = null
    }, 1000)
  }

  const handleFilesAdded = async (files: File[]) => {
    // Add files to uploaded list
    setUploadedFiles((prev) => [...prev, ...files])
    console.log("Processing files:", files.map(f => f.name))

    // if session index is -1, create a new session since user is adding files
    let sessionId = "";
    if (currentSessionIndex === -1) {
      // create a new session id
      sessionId = `session-${Date.now()}`
      // name after first message
      const newSessionName = files[0].name.slice(0, 20) + (files[0].name.length > 20 ? "..." : "")
      const newSession: Session = { id: sessionId, name: newSessionName }
      setCurrentSessionIndex(sessions.length)
      setSessions((prev) => [...prev, newSession])
    } else {
      sessionId = sessions[currentSessionIndex]?.id
    }

    // Process each file 

    for (const file of files) {
      const fileId = `${file.name}-${file.size}-${file.lastModified}`
      setProcessingFiles((prev) => new Set([...prev, fileId]))

      await fetch(API_URL + '/sources', {
        method: 'POST',
        headers: {
          'Session-ID': sessionId,
        },
        body: (() => {
          const formData = new FormData()
          formData.append('file', file, file.name)
          return formData
        })(),
      })

      // Remove from processing set
      setProcessingFiles((prev) => {
        const newSet = new Set(prev)
        newSet.delete(fileId)
        return newSet
      })
    }
  }

  const handleUrlAdded = async (url: string) => {
    try {
      console.log('Adding URL:', url)

      if(uploadedUrls.find(u => u.url === url)) {
        // URL already exists, no need to add
        console.error('URL has already been added:', url)
        return
      }

      // Store URL object with hash
      setUploadedUrls((prev) => [...prev, { url: url, urlHash: '', name: url.split('/').pop() || url }])
      
      // Add to processing set
      setProcessingUrls((prev) => new Set([...prev, url]))
      
      // If no session exists, backend will create one automatically
      let sessionId = sessions[currentSessionIndex]?.id || ""
      
      const response = await fetch(`${API_URL}/urls`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Session-ID': sessionId,
        },
        body: JSON.stringify({ url }),
      })
      
      if (!response.ok) {
        const error = await response.json()
        console.error('Failed to add URL:', error)
        // Remove from processing set
        setProcessingUrls((prev) => {
          const newSet = new Set(prev)
          newSet.delete(url)
          return newSet
        })
        // Remove the URL from uploadedUrls since it failed
        setUploadedUrls((prev) => prev.filter((u) => u.url !== url))
        alert(`Failed to add URL: ${error.error || 'Unknown error'}`)
        return
      }
      
      const data = await response.json()
      console.log('URL added successfully:', data)
      
      // If a new session was created by the backend, add it to our session list
      if (data.sessionId && currentSessionIndex === -1) {
        const newSessionName = url.slice(0, 20) + (url.length > 20 ? "..." : "")
        const newSession: Session = { id: data.sessionId, name: newSessionName }
        setCurrentSessionIndex(sessions.length)
        setSessions((prev) => [...prev, newSession])
        console.log("Created new session from URL:", data.sessionId, newSessionName)
      }

      // Update the URL entry with its hash returned from backend
      setUploadedUrls((prev) =>
        prev.map((u) =>
          u.url === url ? { ...u, urlHash: data.urlHash || '', name: data.name || u.name } : u
        )
      )
      
      // Remove from processing set
      setProcessingUrls((prev) => {
        const newSet = new Set(prev)
        newSet.delete(url)
        return newSet
      })
    } catch (error) {
      console.error('Error adding URL:', error)
      alert('Failed to add URL. Please try again.')
      
      // Remove from processing set on error
      setProcessingUrls((prev) => {
        const newSet = new Set(prev)
        newSet.delete(url)
        return newSet
      })

      // Remove the URL from uploadedUrls since it failed
      setUploadedUrls((prev) => prev.filter((u) => u.url !== url))
    }
  }

  const handleRemoveFile = async (index: number) => {
    setUploadedFiles((prev) => prev.filter((_, i) => i !== index))
    // Also notify backend to remove stored source if needed
    await fetch(API_URL + '/sources?filename=' + encodeURIComponent(uploadedFiles[index].name), {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json',
        'Session-ID': sessions[currentSessionIndex]?.id || "",
      },
    })
  }

  const handleRemoveUrl = async (index: number) => {
    try {
      const urlObj = uploadedUrls[index]
      console.log('Removing URL:', urlObj.url)
      
      await fetch(`${API_URL}/urls?urlHash=${urlObj.urlHash}`, {
        method: 'DELETE',
        headers: {
          'Session-ID': sessions[currentSessionIndex]?.id || "",
        },
      })
      
      setUploadedUrls((prev) => prev.filter((_, i) => i !== index))
    } catch (error) {
      console.error('Error removing URL:', error)
      setUploadedUrls((prev) => prev.filter((_, i) => i !== index))
    }
  }

  const handleStreamingComplete = (messageId: string) => {
    // Called when StreamingText finishes animating
    setMessages((prev) =>
      prev.map((msg) =>
        msg.id === messageId ? { ...msg, isStreaming: false, truncatedContent: undefined } : msg
      )
    )
    if (currentMessageIdRef.current === messageId) {
      setIsGenerating(false)
      setStreamingStarted(false)
      currentMessageIdRef.current = null
    }
  }

  const handleStreamingStart = (messageId: string) => {
    if (currentMessageIdRef.current === messageId) {
      setStreamingStarted(true)
    }
  }

  const handleStopGeneration = () => {
    if (currentMessageIdRef.current) {
      // Find the current message and get its displayed content to truncate
      setMessages((prev) =>
        prev.map((msg) => {
          if (msg.id === currentMessageIdRef.current) {
            // Mark as truncated - StreamingText will handle showing only what's been displayed
            return { ...msg, isStreaming: false, truncatedContent: "__TRUNCATE__" }
          }
          return msg
        })
      )
      // No need to abort in-flight request since it already completed
      isCanceledRef.current = true
    } else {
      // Stop requested before the assistant message exists; cancel in-flight request
      if (abortControllerRef.current) {
        try { abortControllerRef.current.abort() } catch { }
      }
      // Invalidate this generation so late responses are ignored
      activeGenerationIdRef.current = null
      isCanceledRef.current = true
    }
    setIsGenerating(false)
    setResponseReady(false)
    setStreamingStarted(false)
    setControlsLocked(false)
    if (controlsUnlockTimerRef.current !== null) {
      clearTimeout(controlsUnlockTimerRef.current)
      controlsUnlockTimerRef.current = null
    }
    currentMessageIdRef.current = null
  }

  const handleAnswerNow = () => {
    if (currentMessageIdRef.current) {
      // Mark as complete so StreamingText shows full content instantly and finishes
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === currentMessageIdRef.current ? { ...msg, truncatedContent: "__COMPLETE__" } : msg
        )
      )
    }
  }

  const handleClearChat = async () => {
    handleStopGeneration()
    setMessages([
      {
        id: "1",
        role: "assistant",
        content:
          initialMessage,
        sources: [],
        timestamp: new Date(),
      },
    ])
    // await fetch(`${API_URL}/history`, {
    //   method: 'DELETE',
    //   headers: {
    //     'Session-ID': sessions[currentSessionIndex]?.id,
    //   },
    // })
    setCurrentSessionIndex(-1) // reset to no session
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
      isGenerating={isGenerating}
      responseReady={responseReady}
      onStopGeneration={handleStopGeneration}
      onAnswerNow={handleAnswerNow}
      onStreamingComplete={handleStreamingComplete}
      onStreamingStart={handleStreamingStart}
      streamingStarted={streamingStarted}
      controlsLocked={controlsLocked}
      processingFiles={processingFiles}
      processingUrls={processingUrls}
      sessions={sessions}
      currentSessionIndex={currentSessionIndex}
      setSessions={setSessions}
      setCurrentSessionIndex={setCurrentSessionIndex}
      onSelectedFilesChange={(selectedFiles) => {
        selectedFilesRef.current = selectedFiles
      }}
      onSelectedUrlsChange={(selectedUrls) => {
        selectedUrlsRef.current = selectedUrls
      }}
    />
  )
}

export default App