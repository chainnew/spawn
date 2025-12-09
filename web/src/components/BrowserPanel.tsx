// Browser Panel - Connects to spawn-browser Rust backend
// Provides headless browser automation via screenshots

import { useState, useEffect, useCallback } from 'react'
import {
  Globe,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Camera,
  Loader2,
  AlertCircle,
  Play,
  X,
  Eye,
  Code,
  FileText
} from 'lucide-react'

// spawn-browser API base (Rust backend on port 3090)
const BROWSER_API = `http://${window.location.hostname}:3090`

interface PageInfo {
  id: string
  url: string
  title: string
}

interface BrowserPanelProps {
  defaultUrl?: string
  onPageCreated?: (pageId: string) => void
  onNavigate?: (url: string) => void
}

export default function BrowserPanel({
  defaultUrl = 'https://example.com',
  onPageCreated,
  onNavigate
}: BrowserPanelProps) {
  const [pageId, setPageId] = useState<string | null>(null)
  const [url, setUrl] = useState(defaultUrl)
  const [inputUrl, setInputUrl] = useState(defaultUrl)
  const [title, setTitle] = useState('')
  const [screenshot, setScreenshot] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isConnected, setIsConnected] = useState(false)
  const [showDevTools, setShowDevTools] = useState(false)
  const [htmlContent, setHtmlContent] = useState<string>('')
  const [jsResult, setJsResult] = useState<string>('')
  const [jsInput, setJsInput] = useState('')

  // Check if spawn-browser is available
  const checkConnection = useCallback(async () => {
    try {
      const res = await fetch(`${BROWSER_API}/health`)
      if (res.ok) {
        const data = await res.json()
        setIsConnected(data.browser_ready)
        return data.browser_ready
      }
    } catch (e) {
      setIsConnected(false)
    }
    return false
  }, [])

  // Create a new browser page
  const createPage = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${BROWSER_API}/api/pages`, {
        method: 'POST'
      })

      if (!res.ok) {
        throw new Error('Failed to create page')
      }

      const page: PageInfo = await res.json()
      setPageId(page.id)
      onPageCreated?.(page.id)

      // Navigate to default URL
      await navigateTo(page.id, defaultUrl)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create page')
    } finally {
      setIsLoading(false)
    }
  }, [defaultUrl, onPageCreated])

  // Navigate to URL
  const navigateTo = async (id: string, targetUrl: string) => {
    setIsLoading(true)
    setError(null)

    try {
      const res = await fetch(`${BROWSER_API}/api/pages/${id}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl })
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || 'Navigation failed')
      }

      const page: PageInfo = await res.json()
      setUrl(page.url)
      setTitle(page.title)
      setInputUrl(page.url)
      onNavigate?.(page.url)

      // Take screenshot after navigation
      await takeScreenshot(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Navigation failed')
    } finally {
      setIsLoading(false)
    }
  }

  // Take screenshot
  const takeScreenshot = async (id: string) => {
    try {
      const res = await fetch(`${BROWSER_API}/api/pages/${id}/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_page: false })
      })

      if (!res.ok) {
        throw new Error('Screenshot failed')
      }

      const data = await res.json()
      setScreenshot(`data:image/png;base64,${data.data}`)
    } catch (e) {
      console.error('Screenshot error:', e)
    }
  }

  // Get page content (HTML)
  const getContent = async () => {
    if (!pageId) return

    try {
      const res = await fetch(`${BROWSER_API}/api/pages/${pageId}/content`)
      if (res.ok) {
        const html = await res.text()
        setHtmlContent(html)
      }
    } catch (e) {
      console.error('Get content error:', e)
    }
  }

  // Evaluate JavaScript
  const evaluateJs = async () => {
    if (!pageId || !jsInput.trim()) return

    try {
      const res = await fetch(`${BROWSER_API}/api/pages/${pageId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: jsInput })
      })

      if (res.ok) {
        const data = await res.json()
        setJsResult(JSON.stringify(data.result, null, 2))
      } else {
        const err = await res.json()
        setJsResult(`Error: ${err.error}`)
      }
    } catch (e) {
      setJsResult(`Error: ${e instanceof Error ? e.message : 'Unknown error'}`)
    }
  }


  // Handle URL submission
  const handleNavigate = () => {
    if (!pageId || !inputUrl.trim()) return

    let targetUrl = inputUrl.trim()
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      targetUrl = 'https://' + targetUrl
    }

    navigateTo(pageId, targetUrl)
  }

  // Refresh current page
  const refresh = () => {
    if (pageId && url) {
      navigateTo(pageId, url)
    }
  }

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      const connected = await checkConnection()
      if (connected) {
        await createPage()
      }
    }
    init()

    // Cleanup on unmount
    return () => {
      if (pageId) {
        fetch(`${BROWSER_API}/api/pages/${pageId}`, { method: 'DELETE' }).catch(() => {})
      }
    }
  }, [])

  // Not connected state
  if (!isConnected) {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-[#0d1117]">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-spawn-accent/20 to-purple-500/20 flex items-center justify-center mb-4">
          <Globe className="w-8 h-8 text-spawn-accent" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Browser Engine</h3>
        <p className="text-sm text-gray-400 text-center mb-4 max-w-xs">
          Connect to spawn-browser for headless browser automation.
        </p>

        <button
          onClick={async () => {
            const connected = await checkConnection()
            if (connected) {
              await createPage()
            } else {
              setError('spawn-browser not available. Start it with: cargo run -p spawn-browser')
            }
          }}
          disabled={isLoading}
          className="flex items-center gap-2 px-6 py-2.5 bg-spawn-accent text-black rounded-xl font-medium hover:bg-spawn-accent/90 transition-colors disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Connect
        </button>

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-sm text-red-400 max-w-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          </div>
        )}

        <div className="mt-6 p-3 bg-[#161b22] rounded-xl border border-[#333] text-[10px] text-gray-400 max-w-sm">
          <div className="font-medium text-gray-300 mb-1">To start spawn-browser:</div>
          <code className="block bg-[#0a0a0a] p-2 rounded text-spawn-accent font-mono">
            cargo run -p spawn-browser
          </code>
          <p className="mt-2">Runs on port 3090 with headless Chromium</p>
        </div>
      </div>
    )
  }

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* URL Bar */}
      <div className="h-10 bg-[#161b22] border-b border-[#333] flex items-center gap-2 px-2 flex-shrink-0">
        {/* Navigation buttons */}
        <button
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#333] transition-colors disabled:opacity-30"
          title="Back"
          disabled
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <button
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#333] transition-colors disabled:opacity-30"
          title="Forward"
          disabled
        >
          <ArrowRight className="w-4 h-4" />
        </button>
        <button
          onClick={refresh}
          disabled={isLoading}
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#333] transition-colors"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* URL input */}
        <div className="flex-1 flex items-center">
          <div className="flex-1 flex items-center bg-[#0a0a0a] border border-[#333] rounded-lg px-3 py-1.5">
            <Globe className="w-3.5 h-3.5 text-gray-500 mr-2 flex-shrink-0" />
            <input
              type="text"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleNavigate()}
              className="flex-1 bg-transparent text-sm text-gray-200 focus:outline-none"
              placeholder="Enter URL..."
            />
            {isLoading && (
              <Loader2 className="w-3.5 h-3.5 text-spawn-accent animate-spin ml-2" />
            )}
          </div>
        </div>

        {/* Actions */}
        <button
          onClick={() => pageId && takeScreenshot(pageId)}
          disabled={!pageId || isLoading}
          className="p-1.5 text-gray-400 hover:text-white rounded hover:bg-[#333] transition-colors disabled:opacity-30"
          title="Take screenshot"
        >
          <Camera className="w-4 h-4" />
        </button>
        <button
          onClick={() => setShowDevTools(!showDevTools)}
          className={`p-1.5 rounded transition-colors ${
            showDevTools ? 'text-spawn-accent bg-spawn-accent/20' : 'text-gray-400 hover:text-white hover:bg-[#333]'
          }`}
          title="Developer tools"
        >
          <Code className="w-4 h-4" />
        </button>
      </div>

      {/* Page title */}
      {title && (
        <div className="h-6 bg-[#161b22] border-b border-[#333] flex items-center px-3">
          <span className="text-[11px] text-gray-400 truncate">{title}</span>
        </div>
      )}

      {/* Main content area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Screenshot view */}
        <div className={`${showDevTools ? 'w-1/2' : 'w-full'} h-full overflow-auto bg-[#1a1a1a] relative`}>
          {screenshot ? (
            <img
              src={screenshot}
              alt="Page screenshot"
              className="w-full h-auto"
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              {isLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 text-spawn-accent animate-spin" />
                  <span className="text-sm text-gray-400">Loading page...</span>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2 text-gray-500">
                  <Eye className="w-8 h-8" />
                  <span className="text-sm">No screenshot available</span>
                </div>
              )}
            </div>
          )}

          {/* Error overlay */}
          {error && (
            <div className="absolute top-4 left-4 right-4 p-3 bg-red-500/90 rounded-lg text-white text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
              <button onClick={() => setError(null)} className="ml-auto">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        {/* DevTools panel */}
        {showDevTools && (
          <div className="w-1/2 h-full border-l border-[#333] flex flex-col bg-[#0d1117]">
            {/* DevTools tabs */}
            <div className="h-8 bg-[#161b22] border-b border-[#333] flex items-center px-2 gap-1">
              <button
                onClick={getContent}
                className="px-2 py-1 text-[10px] text-gray-400 hover:text-white rounded hover:bg-[#333] flex items-center gap-1"
              >
                <FileText className="w-3 h-3" />
                HTML
              </button>
              <button className="px-2 py-1 text-[10px] text-spawn-accent bg-spawn-accent/20 rounded flex items-center gap-1">
                <Code className="w-3 h-3" />
                Console
              </button>
            </div>

            {/* JS Console */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Result output */}
              <div className="flex-1 overflow-auto p-3 font-mono text-xs">
                {jsResult ? (
                  <pre className="text-green-400 whitespace-pre-wrap">{jsResult}</pre>
                ) : htmlContent ? (
                  <pre className="text-gray-400 whitespace-pre-wrap text-[10px]">{htmlContent.slice(0, 5000)}</pre>
                ) : (
                  <span className="text-gray-500">Run JavaScript or view HTML...</span>
                )}
              </div>

              {/* JS Input */}
              <div className="border-t border-[#333] p-2">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={jsInput}
                    onChange={(e) => setJsInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && evaluateJs()}
                    className="flex-1 px-3 py-1.5 bg-[#0a0a0a] border border-[#333] rounded text-xs text-gray-200 font-mono focus:outline-none focus:border-spawn-accent"
                    placeholder="document.title"
                  />
                  <button
                    onClick={evaluateJs}
                    className="px-3 py-1.5 bg-spawn-accent text-black text-xs font-medium rounded hover:bg-spawn-accent/90"
                  >
                    Run
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Status bar */}
      <div className="h-6 bg-[#161b22] border-t border-[#333] flex items-center justify-between px-3 text-[10px] flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-gray-500">spawn-browser</span>
          </div>
          {pageId && (
            <span className="text-gray-600 font-mono">page:{pageId.slice(0, 8)}</span>
          )}
        </div>
        <span className="text-gray-500">{url}</span>
      </div>
    </div>
  )
}

// Export a hook for using browser from chat/other components
export function useBrowser() {
  const [pageId, setPageId] = useState<string | null>(null)

  const createPage = async (): Promise<string | null> => {
    try {
      const res = await fetch(`${BROWSER_API}/api/pages`, { method: 'POST' })
      if (res.ok) {
        const page: PageInfo = await res.json()
        setPageId(page.id)
        return page.id
      }
    } catch (e) {
      console.error('Failed to create page:', e)
    }
    return null
  }

  const navigate = async (url: string): Promise<boolean> => {
    if (!pageId) return false
    try {
      const res = await fetch(`${BROWSER_API}/api/pages/${pageId}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      })
      return res.ok
    } catch (e) {
      return false
    }
  }

  const screenshot = async (): Promise<string | null> => {
    if (!pageId) return null
    try {
      const res = await fetch(`${BROWSER_API}/api/pages/${pageId}/screenshot`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ full_page: false })
      })
      if (res.ok) {
        const data = await res.json()
        return `data:image/png;base64,${data.data}`
      }
    } catch (e) {
      console.error('Screenshot failed:', e)
    }
    return null
  }

  const click = async (selector: string): Promise<boolean> => {
    if (!pageId) return false
    try {
      const res = await fetch(`${BROWSER_API}/api/pages/${pageId}/click`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector })
      })
      return res.ok
    } catch (e) {
      return false
    }
  }

  const type = async (selector: string, text: string): Promise<boolean> => {
    if (!pageId) return false
    try {
      const res = await fetch(`${BROWSER_API}/api/pages/${pageId}/type`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selector, text })
      })
      return res.ok
    } catch (e) {
      return false
    }
  }

  const evaluate = async (script: string): Promise<any> => {
    if (!pageId) return null
    try {
      const res = await fetch(`${BROWSER_API}/api/pages/${pageId}/evaluate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script })
      })
      if (res.ok) {
        const data = await res.json()
        return data.result
      }
    } catch (e) {
      console.error('Evaluate failed:', e)
    }
    return null
  }

  const getContent = async (): Promise<string | null> => {
    if (!pageId) return null
    try {
      const res = await fetch(`${BROWSER_API}/api/pages/${pageId}/content`)
      if (res.ok) {
        return await res.text()
      }
    } catch (e) {
      console.error('Get content failed:', e)
    }
    return null
  }

  const closePage = async () => {
    if (pageId) {
      await fetch(`${BROWSER_API}/api/pages/${pageId}`, { method: 'DELETE' }).catch(() => {})
      setPageId(null)
    }
  }

  return {
    pageId,
    createPage,
    navigate,
    screenshot,
    click,
    type,
    evaluate,
    getContent,
    closePage
  }
}
