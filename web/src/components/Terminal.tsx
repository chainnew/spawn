import { useEffect, useRef } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
import { useAppStore } from '../stores/app'

export default function Terminal() {
  const terminalRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<XTerm | null>(null)
  const wsRef = useRef<WebSocket | null>(null)
  const { setConnected } = useAppStore()

  useEffect(() => {
    if (!terminalRef.current || xtermRef.current) return

    // Create terminal
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

    // Open terminal
    xterm.open(terminalRef.current)

    // Store refs
    xtermRef.current = xterm

    // Welcome message
    xterm.writeln('\x1b[36m╭─────────────────────────────────────╮\x1b[0m')
    xterm.writeln('\x1b[36m│\x1b[0m  \x1b[1;33m⚡ spawn.new terminal\x1b[0m              \x1b[36m│\x1b[0m')
    xterm.writeln('\x1b[36m╰─────────────────────────────────────╯\x1b[0m')
    xterm.writeln('')
    xterm.writeln('\x1b[90mConnecting to backend...\x1b[0m')

    // Connect WebSocket
    connectWebSocket(xterm)

    // Handle input - send raw data directly
    xterm.onData((data) => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(data)
      }
    })

    return () => {
      wsRef.current?.close()
      xterm.dispose()
    }
  }, [])

  const connectWebSocket = (xterm: XTerm) => {
    const wsUrl = `ws://192.168.43.131:3000/ws/terminal`
    
    console.log('Connecting to:', wsUrl)
    const ws = new WebSocket(wsUrl)
    
    ws.onopen = () => {
      setConnected(true)
      xterm.writeln('\x1b[32m● Connected to spawn backend\x1b[0m')
      xterm.writeln('')
    }

    ws.onmessage = (event) => {
      xterm.write(event.data)
    }

    ws.onclose = () => {
      setConnected(false)
      xterm.writeln('\r\n\x1b[31m● Disconnected from spawn backend\x1b[0m')
      xterm.writeln('\x1b[90mReconnecting in 3s...\x1b[0m')
      
      setTimeout(() => {
        if (!wsRef.current || wsRef.current.readyState === WebSocket.CLOSED) {
          connectWebSocket(xterm)
        }
      }, 3000)
    }

    ws.onerror = (err) => {
      console.error('WebSocket error:', err)
      xterm.writeln('\r\n\x1b[31m● Connection error\x1b[0m')
    }

    wsRef.current = ws
  }

  return (
    <div 
      ref={terminalRef} 
      className="h-full w-full bg-spawn-bg"
    />
  )
}
