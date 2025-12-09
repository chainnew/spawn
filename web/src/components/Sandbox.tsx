import { useState, useEffect, useRef, useCallback } from 'react'
import {
  Play,
  Square,
  Server,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
  RotateCcw,
  FolderGit2
} from 'lucide-react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

// Sandbox server API base
const API_BASE = `http://${window.location.hostname}:3080`
const WS_BASE = `ws://${window.location.hostname}:3080`

interface SandboxProps {
  onReady?: (sandbox: SandboxInstance) => void
  onCommand?: (cmd: string) => void
  autoStart?: boolean
}

export interface SandboxInstance {
  typeCommand: (cmd: string) => void
  runCommand: (cmd: string) => void
  isConnected: () => boolean
  cloneRepo: (url: string) => void
}

type SandboxStatus = 'idle' | 'connecting' | 'ready' | 'error'

export default function Sandbox({ onReady, onCommand, autoStart = false }: SandboxProps) {
  const [status, setStatus] = useState<SandboxStatus>('idle')
  const [error, setError] = useState<string | null>(null)
  const [isNetworkEnabled, setIsNetworkEnabled] = useState(true)

  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Create sandbox instance API
  const sandboxInstance = useRef<SandboxInstance>({
    typeCommand: (cmd: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Type command character by character then enter
        wsRef.current.send(cmd + '\n')
      }
    },
    runCommand: (cmd: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(cmd + '\n')
      }
    },
    isConnected: () => wsRef.current?.readyState === WebSocket.OPEN,
    cloneRepo: (url: string) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        // Extract repo name from URL
        const repoName = url.split('/').pop()?.replace('.git', '') || 'repo'
        wsRef.current.send(`git clone ${url} && cd ${repoName}\n`)
      }
    }
  })

  const connectWebSocket = useCallback((xterm: XTerm) => {
    const wsUrl = `${WS_BASE}/ws/terminal`

    console.log('Sandbox connecting to:', wsUrl)
    const ws = new WebSocket(wsUrl)

    ws.onopen = () => {
      setStatus('ready')
      setError(null)
      xterm.writeln('\x1b[32m● Connected to sandbox server\x1b[0m')
      xterm.writeln('')

      // Notify parent component
      onReady?.(sandboxInstance.current)
    }

    ws.onmessage = (event) => {
      xterm.write(event.data)
    }

    ws.onclose = () => {
      if (status === 'ready') {
        xterm.writeln('\r\n\x1b[31m● Disconnected from sandbox\x1b[0m')
        xterm.writeln('\x1b[90mReconnecting in 3s...\x1b[0m')
      }
      setStatus('idle')

      // Auto-reconnect
      reconnectTimeoutRef.current = setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          startSandbox()
        }
      }, 3000)
    }

    ws.onerror = (err) => {
      console.error('Sandbox WebSocket error:', err)
      setError('Failed to connect to sandbox server')
      setStatus('error')
    }

    wsRef.current = ws
  }, [status, onReady])

  const startSandbox = useCallback(async () => {
    if (status === 'connecting') return

    setStatus('connecting')
    setError(null)

    // First check if server is available
    try {
      const res = await fetch(`${API_BASE}/health`)
      if (!res.ok) throw new Error('Server not responding')
    } catch (e) {
      setError('Sandbox server not available. Make sure it\'s running on port 3080.')
      setStatus('error')
      return
    }

    // Create terminal
    if (!xtermRef.current && terminalRef.current) {
      const xterm = new XTerm({
        theme: {
          background: '#0d1117',
          foreground: '#c9d1d9',
          cursor: '#58a6ff',
          cursorAccent: '#0d1117',
          selectionBackground: '#264f78',
          black: '#0d1117',
          red: '#f85149',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#c9d1d9',
          brightBlack: '#484f58',
          brightRed: '#ff7b72',
          brightGreen: '#56d364',
          brightYellow: '#e3b341',
          brightBlue: '#79c0ff',
          brightMagenta: '#d2a8ff',
          brightCyan: '#56d4dd',
          brightWhite: '#f0f6fc',
        },
        fontFamily: 'JetBrains Mono, monospace',
        fontSize: 14,
        cursorBlink: true,
        cursorStyle: 'bar',
        scrollback: 10000,
      })

      // Add FitAddon
      const fitAddon = new FitAddon()
      xterm.loadAddon(fitAddon)

      xterm.open(terminalRef.current)
      fitAddon.fit()
      fitAddonRef.current = fitAddon
      xtermRef.current = xterm

      // Welcome message
      xterm.writeln('\x1b[36m╭─────────────────────────────────────╮\x1b[0m')
      xterm.writeln('\x1b[36m│\x1b[0m  \x1b[1;33m⚡ spawn.new sandbox\x1b[0m              \x1b[36m│\x1b[0m')
      xterm.writeln('\x1b[36m╰─────────────────────────────────────╯\x1b[0m')
      xterm.writeln('')
      xterm.writeln('\x1b[90mConnecting to sandbox server...\x1b[0m')

      // Handle input - send to WebSocket
      xterm.onData((data) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(data)
          onCommand?.(data)
        }
      })
    }

    // Connect WebSocket
    if (xtermRef.current) {
      connectWebSocket(xtermRef.current)
    }
  }, [status, connectWebSocket, onCommand])

  const stopSandbox = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current)
    }
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (xtermRef.current) {
      xtermRef.current.dispose()
      xtermRef.current = null
    }
    fitAddonRef.current = null
    setStatus('idle')
  }, [])

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      if (fitAddonRef.current && xtermRef.current) {
        fitAddonRef.current.fit()
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      wsRef.current?.close()
      xtermRef.current?.dispose()
    }
  }, [])

  // Auto-start
  useEffect(() => {
    if (autoStart && status === 'idle') {
      startSandbox()
    }
  }, [autoStart, status, startSandbox])

  // Quick command helper
  const runQuickCommand = useCallback((cmd: string) => {
    sandboxInstance.current.runCommand(cmd)
    onCommand?.(cmd)
  }, [onCommand])

  // Clone repo helper
  const handleCloneRepo = useCallback((url: string) => {
    sandboxInstance.current.cloneRepo(url)
  }, [])

  // Idle state
  if (status === 'idle') {
    return (
      <div className="h-full flex flex-col bg-[#0d1117]">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-spawn-accent/20 to-purple-500/20 flex items-center justify-center mb-4">
            <Server className="w-10 h-10 text-spawn-accent" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Sandbox Terminal</h3>
          <p className="text-sm text-gray-400 text-center mb-6 max-w-xs">
            Full Linux terminal connected to the sandbox server.
            Clone repos, run commands, build projects.
          </p>

          <button
            onClick={startSandbox}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-spawn-accent text-black rounded-xl font-medium hover:bg-spawn-accent/90 transition-colors"
          >
            <Play className="w-4 h-4" />
            Connect to Sandbox
          </button>

          {/* Quick clone section */}
          <div className="mt-6 w-full max-w-sm">
            <div className="text-[10px] uppercase tracking-wider text-gray-500 mb-2">Quick Clone</div>
            <div className="space-y-2">
              {[
                { name: 'React Starter', url: 'https://github.com/vitejs/vite.git' },
                { name: 'Node API', url: 'https://github.com/expressjs/express.git' },
              ].map(repo => (
                <button
                  key={repo.name}
                  onClick={() => {
                    startSandbox()
                    setTimeout(() => handleCloneRepo(repo.url), 1000)
                  }}
                  className="w-full p-3 rounded-xl border border-[#333] bg-[#161b22] hover:border-spawn-accent/50 text-left transition-all flex items-center gap-3"
                >
                  <FolderGit2 className="w-4 h-4 text-spawn-accent" />
                  <div>
                    <div className="text-sm text-white">{repo.name}</div>
                    <div className="text-[10px] text-gray-500 truncate">{repo.url}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Info */}
          <div className="mt-6 p-3 bg-[#161b22] rounded-xl border border-[#333] text-[10px] text-gray-400 max-w-sm">
            <div className="font-medium text-gray-300 mb-1">Sandbox Features:</div>
            <ul className="space-y-0.5">
              <li>• Full PTY terminal via WebSocket</li>
              <li>• Git, Node.js, Python, Rust available</li>
              <li>• Clone and build repositories</li>
              <li>• AI-assisted coding via chat</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Connecting state
  if (status === 'connecting') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-[#0d1117]">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-spawn-accent/20 to-purple-500/20 flex items-center justify-center mb-4 relative">
          <Server className="w-10 h-10 text-spawn-accent" />
          <Loader2 className="absolute w-24 h-24 text-spawn-accent/30 animate-spin" />
        </div>

        <h3 className="text-lg font-semibold text-white mb-2">Connecting...</h3>
        <p className="text-sm text-gray-400 text-center mb-4">Establishing connection to sandbox server</p>

        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="w-2 h-2 rounded-full bg-spawn-accent animate-pulse" />
          <span>Connecting to {WS_BASE}</span>
        </div>
      </div>
    )
  }

  // Error state
  if (status === 'error') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-[#0d1117]">
        <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
          <AlertCircle className="w-8 h-8 text-red-500" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Connection Failed</h3>
        <p className="text-sm text-red-400 text-center mb-4 max-w-xs">{error}</p>

        <div className="flex gap-2">
          <button
            onClick={() => setStatus('idle')}
            className="px-4 py-2 bg-[#333] hover:bg-[#444] text-white rounded-lg transition-colors text-sm"
          >
            Back
          </button>
          <button
            onClick={startSandbox}
            className="px-4 py-2 bg-spawn-accent text-black rounded-lg transition-colors text-sm"
          >
            Retry
          </button>
        </div>

        {/* Troubleshooting */}
        <div className="mt-6 p-3 bg-[#161b22] rounded-xl border border-[#333] text-[10px] text-gray-400 max-w-sm">
          <div className="font-medium text-gray-300 mb-1">Troubleshooting:</div>
          <ul className="space-y-0.5">
            <li>• Ensure sandbox-server is running on port 3080</li>
            <li>• Run: cd sandbox-server && node server.js</li>
            <li>• Check browser console for errors</li>
            <li>• Verify network connectivity</li>
          </ul>
        </div>
      </div>
    )
  }

  // Ready state - show terminal
  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Status bar */}
      <div className="h-8 bg-[#161b22] border-b border-[#333] flex items-center justify-between px-3 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] text-green-400 font-medium">Connected</span>
          </div>

          <div className="h-4 w-px bg-[#333]" />

          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <Server className="w-3 h-3" />
            <span>sandbox-server:3080</span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNetworkEnabled(!isNetworkEnabled)}
            className={`p-1 rounded transition-colors ${
              isNetworkEnabled ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Network status"
          >
            {isNetworkEnabled ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </button>

          <button
            onClick={() => runQuickCommand('clear')}
            className="p-1 rounded text-gray-500 hover:text-yellow-400 transition-colors"
            title="Clear terminal"
          >
            <RotateCcw className="w-3 h-3" />
          </button>

          <button
            onClick={stopSandbox}
            className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors"
            title="Disconnect"
          >
            <Square className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal container */}
      <div
        ref={terminalRef}
        className="flex-1 overflow-hidden bg-[#0d1117]"
      />

      {/* Quick commands */}
      <div className="h-9 bg-[#161b22] border-t border-[#333] flex items-center gap-2 px-3 overflow-x-auto flex-shrink-0">
        <span className="text-[10px] text-gray-500 mr-1">Quick:</span>
        {[
          'ls -la',
          'pwd',
          'git status',
          'node -v',
          'npm init -y',
          'clear',
        ].map((cmd) => (
          <button
            key={cmd}
            onClick={() => runQuickCommand(cmd)}
            className="px-2 py-1 text-[10px] bg-[#333] hover:bg-[#444] rounded text-gray-300 transition-colors whitespace-nowrap"
          >
            {cmd}
          </button>
        ))}
      </div>
    </div>
  )
}

export type { SandboxProps }
