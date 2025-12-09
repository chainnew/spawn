/**
 * Real-time collaboration client for the spawn.new code editor
 * Connects to the WebRTC signaling server at /ws/collab
 */

// Monaco editor types - using any to avoid dependency
type MonacoEditor = any

// Collaboration peer cursor colors
const CURSOR_COLORS = [
  '#ff6b6b', '#4ecdc4', '#ffe66d', '#95e1d3', '#f38181',
  '#aa96da', '#fcbad3', '#a8d8ea', '#ff9a3c', '#c4e538'
]

export interface CollabUser {
  peerId: string
  name: string
  color: string
  cursor?: { line: number; column: number }
  selection?: { startLine: number; startColumn: number; endLine: number; endColumn: number }
}

export interface CollabMessage {
  type: string
  [key: string]: any
}

export interface CollabConfig {
  serverUrl?: string
  roomId: string
  userName?: string
  onPeersChange?: (peers: CollabUser[]) => void
  onCursorUpdate?: (peerId: string, cursor: CollabUser['cursor']) => void
  onOperation?: (operation: any) => void
  onSyncRequest?: (peerId: string) => void
  onSyncResponse?: (content: string) => void
  onChat?: (peerId: string, message: string, userName: string) => void
  onError?: (error: Error) => void
  onConnected?: () => void
  onDisconnected?: () => void
}

export class CollaborationClient {
  private ws: WebSocket | null = null
  private config: CollabConfig
  private peerId: string | null = null
  private peers: Map<string, CollabUser> = new Map()
  private reconnectAttempts = 0
  private maxReconnectAttempts = 5
  private reconnectDelay = 1000
  private pingInterval: ReturnType<typeof setInterval> | null = null
  private connected = false

  constructor(config: CollabConfig) {
    this.config = {
      serverUrl: config.serverUrl || `ws://${window.location.hostname}:3080/ws/collab`,
      ...config
    }
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.serverUrl!)

        this.ws.onopen = () => {
          this.connected = true
          this.reconnectAttempts = 0

          // Join the room
          this.send({
            type: 'join',
            roomId: this.config.roomId,
            user: {
              name: this.config.userName || `User-${Math.random().toString(36).substr(2, 4)}`
            }
          })

          // Start ping interval
          this.pingInterval = setInterval(() => {
            this.send({ type: 'ping' })
          }, 30000)

          this.config.onConnected?.()
          resolve()
        }

        this.ws.onmessage = (event) => {
          try {
            const msg = JSON.parse(event.data)
            this.handleMessage(msg)
          } catch (e) {
            console.error('[Collab] Failed to parse message:', e)
          }
        }

        this.ws.onerror = (event) => {
          console.error('[Collab] WebSocket error:', event)
          this.config.onError?.(new Error('WebSocket connection error'))
        }

        this.ws.onclose = () => {
          this.connected = false
          this.cleanup()
          this.config.onDisconnected?.()

          // Attempt reconnection
          if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++
            setTimeout(() => {
              this.connect().catch(console.error)
            }, this.reconnectDelay * this.reconnectAttempts)
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  private handleMessage(msg: CollabMessage) {
    switch (msg.type) {
      case 'joined':
        this.peerId = msg.peerId
        console.log(`[Collab] Joined room ${this.config.roomId} as ${this.peerId}`)
        break

      case 'peer-joined':
        this.addPeer(msg.peerId, msg.user)
        break

      case 'peer-left':
        this.removePeer(msg.peerId)
        break

      case 'room-state':
        // Initial room state with existing peers
        this.peers.clear()
        for (const [id, peer] of Object.entries(msg.peers as Record<string, any>)) {
          if (id !== this.peerId) {
            this.addPeer(id, peer.user, peer.cursor)
          }
        }
        break

      case 'cursor':
        this.updatePeerCursor(msg.peerId, msg.cursor)
        break

      case 'selection':
        this.updatePeerSelection(msg.peerId, msg.selection)
        break

      case 'operation':
        this.config.onOperation?.(msg.operation)
        break

      case 'sync-request':
        this.config.onSyncRequest?.(msg.peerId)
        break

      case 'sync-response':
        this.config.onSyncResponse?.(msg.content)
        break

      case 'chat':
        this.config.onChat?.(msg.peerId, msg.message, msg.userName)
        break

      case 'offer':
      case 'answer':
      case 'ice-candidate':
        // WebRTC signaling - forward to RTCPeerConnection handler
        this.handleRTCSignaling(msg)
        break

      case 'pong':
        // Heartbeat response
        break

      case 'error':
        console.error('[Collab] Server error:', msg.message)
        this.config.onError?.(new Error(msg.message))
        break
    }
  }

  private addPeer(peerId: string, user: any, cursor?: any) {
    const colorIndex = this.peers.size % CURSOR_COLORS.length
    const peer: CollabUser = {
      peerId,
      name: user?.name || `Peer-${peerId.slice(-4)}`,
      color: CURSOR_COLORS[colorIndex],
      cursor
    }
    this.peers.set(peerId, peer)
    this.notifyPeersChange()
  }

  private removePeer(peerId: string) {
    this.peers.delete(peerId)
    this.notifyPeersChange()
  }

  private updatePeerCursor(peerId: string, cursor: { line: number; column: number }) {
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.cursor = cursor
      this.config.onCursorUpdate?.(peerId, cursor)
      this.notifyPeersChange()
    }
  }

  private updatePeerSelection(peerId: string, selection: any) {
    const peer = this.peers.get(peerId)
    if (peer) {
      peer.selection = selection
      this.notifyPeersChange()
    }
  }

  private notifyPeersChange() {
    this.config.onPeersChange?.(Array.from(this.peers.values()))
  }

  private handleRTCSignaling(_msg: CollabMessage) {
    // Future: Handle WebRTC peer-to-peer connections for direct data channels
    // For now, all communication goes through the signaling server
  }

  // Public API

  send(message: CollabMessage) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message))
    }
  }

  sendCursor(line: number, column: number) {
    this.send({
      type: 'cursor',
      cursor: { line, column }
    })
  }

  sendSelection(startLine: number, startColumn: number, endLine: number, endColumn: number) {
    this.send({
      type: 'cursor',
      cursor: { line: startLine, column: startColumn },
      selection: { startLine, startColumn, endLine, endColumn }
    })
  }

  sendOperation(operation: any) {
    this.send({
      type: 'operation',
      operation
    })
  }

  requestSync(targetPeerId?: string) {
    this.send({
      type: 'sync-request',
      targetPeerId
    })
  }

  sendSync(content: string, targetPeerId?: string) {
    this.send({
      type: 'sync-response',
      content,
      targetPeerId
    })
  }

  sendChat(message: string) {
    this.send({
      type: 'chat',
      message
    })
  }

  getPeers(): CollabUser[] {
    return Array.from(this.peers.values())
  }

  getPeerId(): string | null {
    return this.peerId
  }

  isConnected(): boolean {
    return this.connected
  }

  private cleanup() {
    if (this.pingInterval) {
      clearInterval(this.pingInterval)
      this.pingInterval = null
    }
  }

  disconnect() {
    this.cleanup()
    if (this.ws) {
      this.send({ type: 'leave' })
      this.ws.close()
      this.ws = null
    }
    this.peers.clear()
    this.connected = false
  }
}

// Monaco Editor cursor decorations for remote collaborators
export class CursorDecorations {
  private editor: MonacoEditor
  private decorations: Map<string, string[]> = new Map()
  private styleElement: HTMLStyleElement | null = null

  constructor(editor: MonacoEditor) {
    this.editor = editor
    this.createStyleElement()
  }

  private createStyleElement() {
    this.styleElement = document.createElement('style')
    this.styleElement.id = 'collab-cursors'
    document.head.appendChild(this.styleElement)
  }

  updateCursor(peer: CollabUser) {
    if (!peer.cursor) return

    const { line, column } = peer.cursor
    const decorationClass = `collab-cursor-${peer.peerId.replace(/[^a-zA-Z0-9]/g, '')}`

    // Add CSS for this peer's cursor
    if (this.styleElement) {
      const existingStyles = this.styleElement.textContent || ''
      if (!existingStyles.includes(decorationClass)) {
        this.styleElement.textContent += `
          .${decorationClass}::after {
            content: '';
            position: absolute;
            width: 2px;
            height: 18px;
            background: ${peer.color};
            margin-left: -1px;
          }
          .${decorationClass}-label::after {
            content: '${peer.name}';
            position: absolute;
            top: -18px;
            left: 0;
            background: ${peer.color};
            color: white;
            font-size: 10px;
            padding: 1px 4px;
            border-radius: 2px;
            white-space: nowrap;
            font-family: system-ui, sans-serif;
          }
        `
      }
    }

    // Create decorations
    const newDecorations: any[] = [
      {
        range: {
          startLineNumber: line,
          startColumn: column,
          endLineNumber: line,
          endColumn: column
        },
        options: {
          className: decorationClass,
          beforeContentClassName: `${decorationClass}-label`,
          stickiness: 1 // AlwaysGrowsWhenTypingAtEdges
        }
      }
    ]

    // Add selection decoration if present
    if (peer.selection) {
      newDecorations.push({
        range: {
          startLineNumber: peer.selection.startLine,
          startColumn: peer.selection.startColumn,
          endLineNumber: peer.selection.endLine,
          endColumn: peer.selection.endColumn
        },
        options: {
          className: `collab-selection-${peer.peerId.replace(/[^a-zA-Z0-9]/g, '')}`,
          inlineClassName: `background: ${peer.color}33;`
        }
      })
    }

    // Update decorations
    const oldDecorations = this.decorations.get(peer.peerId) || []
    const newDecorationIds = this.editor.deltaDecorations(oldDecorations, newDecorations)
    this.decorations.set(peer.peerId, newDecorationIds)
  }

  removeCursor(peerId: string) {
    const oldDecorations = this.decorations.get(peerId) || []
    this.editor.deltaDecorations(oldDecorations, [])
    this.decorations.delete(peerId)
  }

  dispose() {
    // Clear all decorations
    for (const [peerId] of this.decorations) {
      this.removeCursor(peerId)
    }
    // Remove style element
    if (this.styleElement) {
      this.styleElement.remove()
      this.styleElement = null
    }
  }
}

// Singleton for current collaboration session
let currentSession: CollaborationClient | null = null

export function getCollaborationSession(): CollaborationClient | null {
  return currentSession
}

export function setCollaborationSession(session: CollaborationClient | null) {
  if (currentSession) {
    currentSession.disconnect()
  }
  currentSession = session
}

export function createCollaborationSession(config: CollabConfig): CollaborationClient {
  const session = new CollaborationClient(config)
  setCollaborationSession(session)
  return session
}
