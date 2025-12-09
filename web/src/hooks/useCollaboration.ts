/**
 * React hook for real-time collaboration in the code editor
 */

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  CollaborationClient,
  CursorDecorations,
  type CollabUser,
  type CollabConfig
} from '../lib/collaboration'

// Monaco editor types - using any to avoid dependency issues
type MonacoEditor = any
type MonacoDisposable = { dispose: () => void }

interface UseCollaborationOptions {
  roomId: string
  userName?: string
  enabled?: boolean
  serverUrl?: string
}

interface UseCollaborationReturn {
  // State
  isConnected: boolean
  peers: CollabUser[]
  peerId: string | null
  error: Error | null

  // Actions
  connect: () => Promise<void>
  disconnect: () => void
  sendChat: (message: string) => void

  // Editor integration
  bindEditor: (editor: MonacoEditor) => void
  unbindEditor: () => void
}

export function useCollaboration(options: UseCollaborationOptions): UseCollaborationReturn {
  const { roomId, userName, enabled = true, serverUrl } = options

  const [isConnected, setIsConnected] = useState(false)
  const [peers, setPeers] = useState<CollabUser[]>([])
  const [peerId, setPeerId] = useState<string | null>(null)
  const [error, setError] = useState<Error | null>(null)

  const clientRef = useRef<CollaborationClient | null>(null)
  const editorRef = useRef<MonacoEditor | null>(null)
  const decorationsRef = useRef<CursorDecorations | null>(null)
  const cursorListenerRef = useRef<MonacoDisposable | null>(null)
  const contentListenerRef = useRef<MonacoDisposable | null>(null)

  // Create collaboration client
  const createClient = useCallback(() => {
    const config: CollabConfig = {
      roomId,
      userName,
      serverUrl,
      onPeersChange: (newPeers) => {
        setPeers(newPeers)
        // Update cursor decorations
        if (decorationsRef.current) {
          newPeers.forEach(peer => {
            if (peer.cursor) {
              decorationsRef.current?.updateCursor(peer)
            }
          })
        }
      },
      onCursorUpdate: (pId, cursor) => {
        if (decorationsRef.current && cursor) {
          const peer = peers.find(p => p.peerId === pId)
          if (peer) {
            decorationsRef.current.updateCursor({ ...peer, cursor })
          }
        }
      },
      onOperation: (operation) => {
        // Apply remote operations to editor
        if (editorRef.current && operation) {
          const model = editorRef.current.getModel()
          if (model) {
            // Apply the operation
            model.pushEditOperations(
              [],
              [{
                range: operation.range,
                text: operation.text
              }],
              () => null
            )
          }
        }
      },
      onSyncRequest: (targetPeerId) => {
        // Send current document state
        if (editorRef.current && clientRef.current) {
          const model = editorRef.current.getModel()
          if (model) {
            clientRef.current.sendSync(model.getValue(), targetPeerId)
          }
        }
      },
      onSyncResponse: (content) => {
        // Apply synced content
        if (editorRef.current) {
          const model = editorRef.current.getModel()
          if (model) {
            model.setValue(content)
          }
        }
      },
      onConnected: () => {
        setIsConnected(true)
        setError(null)
      },
      onDisconnected: () => {
        setIsConnected(false)
      },
      onError: (err) => {
        setError(err)
      }
    }

    return new CollaborationClient(config)
  }, [roomId, userName, serverUrl, peers])

  // Connect to collaboration server
  const connect = useCallback(async () => {
    if (!enabled) return

    try {
      if (clientRef.current) {
        clientRef.current.disconnect()
      }

      clientRef.current = createClient()
      await clientRef.current.connect()
      setPeerId(clientRef.current.getPeerId())
    } catch (err) {
      setError(err as Error)
      throw err
    }
  }, [enabled, createClient])

  // Disconnect from collaboration server
  const disconnect = useCallback(() => {
    if (clientRef.current) {
      clientRef.current.disconnect()
      clientRef.current = null
    }
    setIsConnected(false)
    setPeers([])
    setPeerId(null)
  }, [])

  // Send chat message
  const sendChat = useCallback((message: string) => {
    clientRef.current?.sendChat(message)
  }, [])

  // Bind editor for collaboration
  const bindEditor = useCallback((editor: MonacoEditor) => {
    editorRef.current = editor
    decorationsRef.current = new CursorDecorations(editor)

    // Listen for cursor changes
    cursorListenerRef.current = editor.onDidChangeCursorPosition((e: any) => {
      if (clientRef.current?.isConnected()) {
        clientRef.current.sendCursor(e.position.lineNumber, e.position.column)
      }
    })

    // Listen for selection changes
    editor.onDidChangeCursorSelection((e: any) => {
      if (clientRef.current?.isConnected()) {
        const sel = e.selection
        clientRef.current.sendSelection(
          sel.startLineNumber,
          sel.startColumn,
          sel.endLineNumber,
          sel.endColumn
        )
      }
    })

    // Listen for content changes
    contentListenerRef.current = editor.onDidChangeModelContent((e: any) => {
      if (clientRef.current?.isConnected()) {
        // Send each change as an operation
        e.changes.forEach((change: any) => {
          clientRef.current?.sendOperation({
            range: {
              startLineNumber: change.range.startLineNumber,
              startColumn: change.range.startColumn,
              endLineNumber: change.range.endLineNumber,
              endColumn: change.range.endColumn
            },
            text: change.text,
            rangeOffset: change.rangeOffset,
            rangeLength: change.rangeLength
          })
        })
      }
    })

    // Request initial sync from peers
    if (clientRef.current?.isConnected()) {
      setTimeout(() => {
        clientRef.current?.requestSync()
      }, 500)
    }
  }, [])

  // Unbind editor
  const unbindEditor = useCallback(() => {
    cursorListenerRef.current?.dispose()
    contentListenerRef.current?.dispose()
    decorationsRef.current?.dispose()

    cursorListenerRef.current = null
    contentListenerRef.current = null
    decorationsRef.current = null
    editorRef.current = null
  }, [])

  // Auto-connect when enabled and roomId changes
  useEffect(() => {
    if (enabled && roomId) {
      connect().catch(console.error)
    }

    return () => {
      disconnect()
    }
  }, [enabled, roomId]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      unbindEditor()
      disconnect()
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return {
    isConnected,
    peers,
    peerId,
    error,
    connect,
    disconnect,
    sendChat,
    bindEditor,
    unbindEditor
  }
}

export default useCollaboration
