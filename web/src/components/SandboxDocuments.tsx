import { useState, useEffect, useCallback } from 'react'
import { FileText, RefreshCw, Download, Trash2, Eye, Send, File, Image, Code } from 'lucide-react'
import { useAppStore } from '../stores/app'

const API_BASE = `http://${window.location.hostname}:3080`

// Raw artifact format from server
interface ServerArtifact {
  id: string
  type: string
  title: string
  description?: string
  files?: Array<{ name: string; content: string; language?: string }>
  content?: string // Legacy compat field
  lang?: string
  created_at: string
  updated_at: string
}

// Normalized document for display
interface SandboxDocument {
  id: string
  name: string
  type: 'text' | 'code' | 'image' | 'html'
  content: string
  created_at: string
  size: number
  language?: string
}

interface SandboxDocumentsProps {
  onSendToChat?: (content: string, filename: string) => void
}

// Convert server artifact to display format
function normalizeArtifact(artifact: ServerArtifact): SandboxDocument {
  // Get content from files array or legacy content field
  const content = artifact.files?.[0]?.content || artifact.content || ''
  const fileName = artifact.files?.[0]?.name || artifact.title || 'untitled'
  const language = artifact.files?.[0]?.language || artifact.lang

  // Map artifact type to display type
  let displayType: 'text' | 'code' | 'image' | 'html' = 'text'
  if (artifact.type === 'html' || artifact.type === 'react') {
    displayType = 'html'
  } else if (artifact.type === 'code' || language) {
    displayType = 'code'
  } else if (artifact.type === 'image') {
    displayType = 'image'
  }

  return {
    id: artifact.id,
    name: fileName,
    type: displayType,
    content,
    created_at: artifact.created_at,
    size: content.length,
    language
  }
}

export default function SandboxDocuments({ onSendToChat }: SandboxDocumentsProps) {
  const [documents, setDocuments] = useState<SandboxDocument[]>([])
  const [selectedDoc, setSelectedDoc] = useState<SandboxDocument | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`${API_BASE}/api/artifacts`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      // Transform server artifacts to display format
      const normalized = (data.artifacts || []).map(normalizeArtifact)
      setDocuments(normalized)
    } catch (e) {
      setError('Could not load documents')
      console.error('Fetch documents error:', e)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchDocuments()
  }, [fetchDocuments])

  const handleDelete = async (id: string) => {
    try {
      await fetch(`${API_BASE}/api/artifacts/${id}`, { method: 'DELETE' })
      setDocuments(docs => docs.filter(d => d.id !== id))
      if (selectedDoc?.id === id) setSelectedDoc(null)
    } catch (e) {
      console.error('Delete error:', e)
    }
  }

  const handleDownload = (doc: SandboxDocument) => {
    const blob = new Blob([doc.content], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = doc.name
    a.click()
    URL.revokeObjectURL(url)
  }

  const setPendingChatMessage = useAppStore(state => state.setPendingChatMessage)

  const handleSendToChat = (doc: SandboxDocument) => {
    // Send to chat via global store
    setPendingChatMessage({ content: doc.content, filename: doc.name })
    // Also call prop callback if provided
    if (onSendToChat) {
      onSendToChat(doc.content, doc.name)
    }
  }

  const getIcon = (type: string) => {
    switch (type) {
      case 'image': return <Image className="w-4 h-4 text-blue-400" />
      case 'code': return <Code className="w-4 h-4 text-green-400" />
      case 'html': return <FileText className="w-4 h-4 text-orange-400" />
      default: return <File className="w-4 h-4 text-gray-400" />
    }
  }

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleString([], {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  return (
    <div className="flex flex-col h-full bg-[#0d1117]">
      {/* Header */}
      <div className="h-9 bg-[#151515] border-b border-[#333] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-2">
          <FileText className="w-3.5 h-3.5 text-spawn-accent" />
          <span className="text-xs font-medium text-gray-300">Sandbox Documents</span>
          <span className="text-[10px] text-gray-500 bg-[#222] px-1.5 py-0.5 rounded">
            {documents.length}
          </span>
        </div>
        <button
          onClick={fetchDocuments}
          disabled={loading}
          className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#222] transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Document List */}
        <div className="w-48 border-r border-[#333] overflow-y-auto">
          {error && (
            <div className="p-2 text-xs text-red-400 bg-red-900/20">
              {error}
            </div>
          )}

          {documents.length === 0 && !loading && !error && (
            <div className="p-4 text-center">
              <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
              <p className="text-xs text-gray-500">No documents yet</p>
              <p className="text-[10px] text-gray-600 mt-1">
                Artifacts created in chat will appear here
              </p>
            </div>
          )}

          {documents.map(doc => (
            <div
              key={doc.id}
              onClick={() => setSelectedDoc(doc)}
              className={`p-2 border-b border-[#222] cursor-pointer transition-colors ${
                selectedDoc?.id === doc.id
                  ? 'bg-spawn-accent/20 border-l-2 border-l-spawn-accent'
                  : 'hover:bg-[#1a1a1a]'
              }`}
            >
              <div className="flex items-center gap-2">
                {getIcon(doc.type)}
                <span className="text-xs text-gray-300 truncate flex-1">{doc.name}</span>
              </div>
              <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-500">
                <span>{formatSize(doc.size)}</span>
                <span>•</span>
                <span>{formatDate(doc.created_at)}</span>
              </div>
            </div>
          ))}
        </div>

        {/* Document Preview */}
        <div className="flex-1 flex flex-col">
          {selectedDoc ? (
            <>
              {/* Preview Header */}
              <div className="h-8 bg-[#151515] border-b border-[#333] flex items-center justify-between px-3 flex-shrink-0">
                <div className="flex items-center gap-2">
                  {getIcon(selectedDoc.type)}
                  <span className="text-xs text-gray-300">{selectedDoc.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {onSendToChat && (
                    <button
                      onClick={() => handleSendToChat(selectedDoc)}
                      className="p-1 text-gray-400 hover:text-spawn-accent rounded hover:bg-[#222] transition-colors"
                      title="Send to Chat"
                    >
                      <Send className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDownload(selectedDoc)}
                    className="p-1 text-gray-400 hover:text-white rounded hover:bg-[#222] transition-colors"
                    title="Download"
                  >
                    <Download className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleDelete(selectedDoc.id)}
                    className="p-1 text-gray-400 hover:text-red-400 rounded hover:bg-[#222] transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* Preview Content */}
              <div className="flex-1 overflow-auto p-3">
                {selectedDoc.type === 'html' ? (
                  <iframe
                    srcDoc={selectedDoc.content}
                    className="w-full h-full bg-white rounded border border-[#333]"
                    title={selectedDoc.name}
                    sandbox="allow-scripts"
                  />
                ) : selectedDoc.type === 'image' ? (
                  <img
                    src={selectedDoc.content}
                    alt={selectedDoc.name}
                    className="max-w-full max-h-full object-contain mx-auto"
                  />
                ) : (
                  <pre className="text-xs text-gray-300 font-mono whitespace-pre-wrap break-words">
                    {selectedDoc.content}
                  </pre>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Eye className="w-10 h-10 text-gray-700 mx-auto mb-2" />
                <p className="text-sm text-gray-500">Select a document to preview</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
