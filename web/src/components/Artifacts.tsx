import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Play, 
  Code2, 
  Eye, 
  Copy, 
  Check, 
  Trash2, 
  Download,
  Maximize2,
  Minimize2,
  RefreshCw,
  FileCode,
  Layout,
  Sparkles
} from 'lucide-react'

interface Artifact {
  id: string
  title: string
  code: string
  language: 'jsx' | 'html' | 'typescript' | 'javascript' | 'css' | 'svg' | 'mermaid'
  timestamp: Date
  preview?: string
}

interface ArtifactsProps {
  onCodeRequest?: (code: string) => void
}

// Simple syntax highlighting
function highlightCode(code: string, language: string): string {
  const keywords = ['const', 'let', 'var', 'function', 'return', 'import', 'export', 'from', 'default', 'if', 'else', 'for', 'while', 'class', 'extends', 'new', 'this', 'async', 'await', 'try', 'catch', 'throw']
  const types = ['string', 'number', 'boolean', 'null', 'undefined', 'true', 'false']
  
  let highlighted = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  
  // Strings
  highlighted = highlighted.replace(/(["'`])(?:(?!\1)[^\\]|\\.)*?\1/g, '<span class="text-green-400">$&</span>')
  
  // Comments
  highlighted = highlighted.replace(/(\/\/.*$)/gm, '<span class="text-gray-500">$1</span>')
  highlighted = highlighted.replace(/(\/\*[\s\S]*?\*\/)/g, '<span class="text-gray-500">$1</span>')
  
  // Keywords
  keywords.forEach(kw => {
    highlighted = highlighted.replace(new RegExp(`\\b(${kw})\\b`, 'g'), '<span class="text-purple-400">$1</span>')
  })
  
  // Types/values
  types.forEach(t => {
    highlighted = highlighted.replace(new RegExp(`\\b(${t})\\b`, 'g'), '<span class="text-yellow-400">$1</span>')
  })
  
  // Numbers
  highlighted = highlighted.replace(/\b(\d+\.?\d*)\b/g, '<span class="text-orange-400">$1</span>')
  
  // JSX tags
  highlighted = highlighted.replace(/(&lt;\/?)([\w]+)/g, '$1<span class="text-cyan-400">$2</span>')
  
  return highlighted
}

// Sandbox for running code safely
function CodeSandbox({ code, language }: { code: string; language: string }) {
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!iframeRef.current) return
    setError(null)

    try {
      let htmlContent: string

      if (language === 'html' || language === 'svg') {
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://cdn.tailwindcss.com"></script>
            <style>
              body { 
                margin: 0; 
                padding: 16px; 
                background: #0d1117; 
                color: white;
                font-family: system-ui, -apple-system, sans-serif;
              }
            </style>
          </head>
          <body>${code}</body>
          </html>
        `
      } else if (language === 'jsx' || language === 'javascript' || language === 'typescript') {
        // Transform JSX to JS (basic transform)
        let transformedCode = code
          // Remove imports for sandbox
          .replace(/^import\s+.*?;?\s*$/gm, '')
          // Replace export default
          .replace(/export\s+default\s+/, 'const __Component__ = ')
        
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <script src="https://unpkg.com/react@18/umd/react.development.js"></script>
            <script src="https://unpkg.com/react-dom@18/umd/react-dom.development.js"></script>
            <script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
            <script src="https://cdn.tailwindcss.com"></script>
            <script src="https://unpkg.com/lucide@latest"></script>
            <style>
              body { 
                margin: 0; 
                padding: 16px; 
                background: #0d1117; 
                color: white;
                font-family: system-ui, -apple-system, sans-serif;
              }
              * { box-sizing: border-box; }
            </style>
          </head>
          <body>
            <div id="root"></div>
            <script type="text/babel">
              ${transformedCode}
              
              // Try to render if it's a component
              try {
                if (typeof __Component__ !== 'undefined') {
                  const root = ReactDOM.createRoot(document.getElementById('root'));
                  root.render(React.createElement(__Component__));
                }
              } catch (e) {
                document.getElementById('root').innerHTML = '<pre style="color: #f87171;">' + e.message + '</pre>';
              }
            </script>
          </body>
          </html>
        `
      } else if (language === 'css') {
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <style>
              body { margin: 0; padding: 16px; background: #0d1117; color: white; }
              ${code}
            </style>
          </head>
          <body>
            <div class="demo">CSS Preview</div>
          </body>
          </html>
        `
      } else if (language === 'mermaid') {
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
            <style>body { margin: 0; padding: 16px; background: #0d1117; }</style>
          </head>
          <body>
            <pre class="mermaid">${code}</pre>
            <script>mermaid.initialize({ startOnLoad: true, theme: 'dark' });</script>
          </body>
          </html>
        `
      } else {
        htmlContent = `
          <!DOCTYPE html>
          <html>
          <head><style>body { margin: 0; padding: 16px; background: #0d1117; color: white; font-family: monospace; }</style></head>
          <body><pre>${code}</pre></body>
          </html>
        `
      }

      iframeRef.current.srcdoc = htmlContent
    } catch (e) {
      setError((e as Error).message)
    }
  }, [code, language])

  if (error) {
    return (
      <div className="h-full flex items-center justify-center p-4">
        <div className="text-red-400 text-sm font-mono">{error}</div>
      </div>
    )
  }

  return (
    <iframe
      ref={iframeRef}
      className="w-full h-full border-0 bg-[#0d1117]"
      sandbox="allow-scripts allow-modals"
      title="Artifact Preview"
    />
  )
}

export default function Artifacts({ onCodeRequest }: ArtifactsProps) {
  const [artifacts, setArtifacts] = useState<Artifact[]>([
    {
      id: '1',
      title: 'Welcome Component',
      code: `export default function Welcome() {
  const [count, setCount] = React.useState(0);
  
  return (
    <div className="p-6 max-w-sm mx-auto bg-gradient-to-br from-purple-900 to-gray-900 rounded-xl shadow-lg">
      <h1 className="text-2xl font-bold text-white mb-4">
        ✨ Grok Artifacts
      </h1>
      <p className="text-gray-300 mb-4">
        Live React component preview. Click the button!
      </p>
      <button 
        onClick={() => setCount(c => c + 1)}
        className="px-4 py-2 bg-purple-600 hover:bg-purple-500 text-white rounded-lg transition-colors"
      >
        Clicked {count} times
      </button>
    </div>
  );
}`,
      language: 'jsx',
      timestamp: new Date(),
    }
  ])
  
  const [activeId, setActiveId] = useState<string>('1')
  const [viewMode, setViewMode] = useState<'preview' | 'code' | 'split'>('split')
  const [copied, setCopied] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

  const activeArtifact = artifacts.find(a => a.id === activeId)

  const copyCode = useCallback(() => {
    if (activeArtifact) {
      navigator.clipboard.writeText(activeArtifact.code)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [activeArtifact])

  const deleteArtifact = useCallback((id: string) => {
    setArtifacts(prev => prev.filter(a => a.id !== id))
    if (activeId === id) {
      setActiveId(artifacts[0]?.id || '')
    }
  }, [activeId, artifacts])

  const updateCode = useCallback((code: string) => {
    setArtifacts(prev => prev.map(a => 
      a.id === activeId ? { ...a, code } : a
    ))
  }, [activeId])

  const addArtifact = useCallback((title: string, code: string, language: Artifact['language']) => {
    const newArtifact: Artifact = {
      id: Date.now().toString(),
      title,
      code,
      language,
      timestamp: new Date(),
    }
    setArtifacts(prev => [...prev, newArtifact])
    setActiveId(newArtifact.id)
  }, [])

  // Expose addArtifact globally for Chat to use
  useEffect(() => {
    (window as any).__addArtifact = addArtifact
    return () => { delete (window as any).__addArtifact }
  }, [addArtifact])

  const downloadArtifact = useCallback(() => {
    if (!activeArtifact) return
    const blob = new Blob([activeArtifact.code], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${activeArtifact.title.toLowerCase().replace(/\s+/g, '-')}.${activeArtifact.language === 'jsx' ? 'jsx' : activeArtifact.language}`
    a.click()
    URL.revokeObjectURL(url)
  }, [activeArtifact])

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Tabs bar */}
      <div className="h-9 bg-[#161b22] border-b border-[#333] flex items-center gap-1 px-2 overflow-x-auto">
        {artifacts.map(artifact => (
          <button
            key={artifact.id}
            onClick={() => setActiveId(artifact.id)}
            className={`
              flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap
              ${artifact.id === activeId 
                ? 'bg-spawn-accent/20 text-spawn-accent' 
                : 'text-gray-400 hover:text-white hover:bg-[#333]'
              }
            `}
          >
            <FileCode className="w-3 h-3" />
            <span>{artifact.title}</span>
            {artifacts.length > 1 && (
              <button
                onClick={(e) => { e.stopPropagation(); deleteArtifact(artifact.id) }}
                className="ml-1 p-0.5 hover:bg-red-500/20 rounded"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            )}
          </button>
        ))}
        
        <button
          onClick={() => addArtifact('New Component', '// Write your code here\nexport default function App() {\n  return <div>Hello!</div>;\n}', 'jsx')}
          className="p-1.5 text-gray-500 hover:text-spawn-accent hover:bg-[#333] rounded-md transition-colors"
          title="New artifact"
        >
          <Sparkles className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Toolbar */}
      <div className="h-8 bg-[#0d1117] border-b border-[#333] flex items-center justify-between px-3">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewMode('preview')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'preview' ? 'bg-spawn-accent/20 text-spawn-accent' : 'text-gray-500 hover:text-white'}`}
            title="Preview only"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('code')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'code' ? 'bg-spawn-accent/20 text-spawn-accent' : 'text-gray-500 hover:text-white'}`}
            title="Code only"
          >
            <Code2 className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`p-1.5 rounded transition-colors ${viewMode === 'split' ? 'bg-spawn-accent/20 text-spawn-accent' : 'text-gray-500 hover:text-white'}`}
            title="Split view"
          >
            <Layout className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex items-center gap-1">
          {activeArtifact && (
            <span className="text-[10px] text-gray-500 bg-[#1a1a1a] px-1.5 py-0.5 rounded mr-2">
              {activeArtifact.language.toUpperCase()}
            </span>
          )}
          <button
            onClick={copyCode}
            className="p-1.5 text-gray-500 hover:text-white rounded transition-colors"
            title="Copy code"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-green-400" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
          <button
            onClick={downloadArtifact}
            className="p-1.5 text-gray-500 hover:text-white rounded transition-colors"
            title="Download"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 text-gray-500 hover:text-white rounded transition-colors"
            title="Toggle fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main content */}
      {activeArtifact ? (
        <div className={`flex-1 flex ${viewMode === 'split' ? 'flex-row' : 'flex-col'} overflow-hidden`}>
          {/* Code panel */}
          {(viewMode === 'code' || viewMode === 'split') && (
            <div className={`${viewMode === 'split' ? 'w-1/2 border-r border-[#333]' : 'flex-1'} flex flex-col`}>
              <textarea
                value={activeArtifact.code}
                onChange={(e) => updateCode(e.target.value)}
                className="flex-1 bg-transparent text-green-400 font-mono text-xs p-3 resize-none focus:outline-none"
                spellCheck={false}
              />
            </div>
          )}

          {/* Preview panel */}
          {(viewMode === 'preview' || viewMode === 'split') && (
            <div className={`${viewMode === 'split' ? 'w-1/2' : 'flex-1'} overflow-hidden`}>
              <CodeSandbox code={activeArtifact.code} language={activeArtifact.language} />
            </div>
          )}
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center text-gray-500">
          <div className="text-center">
            <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No artifacts yet</p>
            <p className="text-xs mt-1">Ask Grok to generate a component!</p>
          </div>
        </div>
      )}
    </div>
  )
}

// Export helper for adding artifacts from Chat
export function addArtifactFromChat(title: string, code: string, language: Artifact['language'] = 'jsx') {
  if ((window as any).__addArtifact) {
    (window as any).__addArtifact(title, code, language)
  }
}

export type { Artifact, ArtifactsProps }
