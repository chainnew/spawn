import { useRef, useCallback, useState } from 'react'
import MonacoEditor, { type OnMount } from '@monaco-editor/react'
import { X, Users, Wifi, WifiOff, Share2 } from 'lucide-react'
import { useAppStore } from '../stores/app'
import { useCollaboration } from '../hooks/useCollaboration'

// Monaco editor types - using any to avoid dependency issues
type MonacoEditor = any

// Demo code to show in the editor
const DEMO_CODE = `// spawn.new - AI-Powered Development Environment
// Build, iterate, and deploy with intelligent agents

import { SpawnAgent, Mission, Tool } from '@spawn/core';
import { OpenRouter } from '@spawn/ai';

interface AgentConfig {
  name: string;
  capabilities: string[];
  model: 'claude-sonnet-4' | 'gpt-4o' | 'gemini-pro';
}

// Initialize the AI orchestrator
const orchestrator = new SpawnAgent({
  name: 'CodeArchitect',
  capabilities: ['code-generation', 'refactoring', 'testing'],
  model: 'claude-sonnet-4',
});

// Define a development mission
const mission: Mission = {
  id: crypto.randomUUID(),
  objective: 'Build a real-time collaboration feature',
  constraints: {
    maxTokens: 100_000,
    timeout: 300_000, // 5 minutes
    tools: ['filesystem', 'terminal', 'browser'],
  },
};

// Available tools for the agent
const tools: Tool[] = [
  {
    name: 'createFile',
    description: 'Create a new file with content',
    execute: async (path: string, content: string) => {
      await Bun.write(path, content);
      return { success: true, path };
    },
  },
  {
    name: 'runCommand',
    description: 'Execute a shell command',
    execute: async (cmd: string) => {
      const proc = Bun.spawn(cmd.split(' '));
      return await new Response(proc.stdout).text();
    },
  },
  {
    name: 'searchCode',
    description: 'Semantic search across codebase',
    execute: async (query: string) => {
      const embeddings = await OpenRouter.embed(query);
      return vectorDB.search(embeddings, { topK: 10 });
    },
  },
];

// Execute the mission
async function runMission() {
  console.log('Starting mission:', mission.objective);

  const result = await orchestrator.execute(mission, {
    tools,
    onProgress: (step) => {
      console.log(\`  -> \${step.action}: \${step.description}\`);
    },
    onThought: (thought) => {
      console.log(\`  [thinking] \${thought}\`);
    },
  });

  if (result.success) {
    console.log('Mission complete!');
    console.log('   Files created:', result.artifacts.length);
    console.log('   Tokens used:', result.usage.totalTokens);
  }

  return result;
}

// WebSocket handler for real-time collaboration
const wsHandler = {
  open(ws: WebSocket) {
    ws.subscribe('collaboration');
    console.log('New collaborator connected');
  },

  message(ws: WebSocket, message: string) {
    const { type, payload } = JSON.parse(message);

    switch (type) {
      case 'cursor':
        ws.publish('collaboration', JSON.stringify({
          type: 'cursor-update',
          userId: ws.data.userId,
          position: payload,
        }));
        break;

      case 'edit':
        // Transform and broadcast operational transform
        const transformed = OT.transform(payload, pendingOps);
        ws.publish('collaboration', JSON.stringify({
          type: 'edit',
          operation: transformed,
        }));
        break;
    }
  },

  close(ws: WebSocket) {
    console.log('Collaborator disconnected');
  },
};

// Start the server
export default {
  port: 3000,
  fetch: app.fetch,
  websocket: wsHandler,
};

console.log('spawn.new running on http://localhost:3000');
`

export default function Editor() {
  const {
    openFiles,
    activeFile,
    fileContents,
    setActiveFile,
    closeFile,
    updateFileContent
  } = useAppStore()

  const editorRef = useRef<MonacoEditor | null>(null)
  const [collabEnabled, setCollabEnabled] = useState(false)
  const [showCollabPanel, setShowCollabPanel] = useState(false)

  // Generate a room ID from the active file
  const roomId = activeFile ? `file:${activeFile.replace(/[^a-zA-Z0-9]/g, '_')}` : 'demo-room'

  // Collaboration hook
  const {
    isConnected,
    peers,
    bindEditor,
    unbindEditor,
    connect,
    disconnect
  } = useCollaboration({
    roomId,
    userName: `User-${Math.random().toString(36).substr(2, 4)}`,
    enabled: collabEnabled
  })

  const getFileName = (path: string) => path.split('/').pop() || path

  const getLanguage = (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase()
    const langMap: Record<string, string> = {
      js: 'javascript',
      jsx: 'javascript',
      ts: 'typescript',
      tsx: 'typescript',
      rs: 'rust',
      py: 'python',
      go: 'go',
      json: 'json',
      md: 'markdown',
      html: 'html',
      css: 'css',
      sql: 'sql',
      sh: 'shell',
      bash: 'shell',
      toml: 'toml',
      yaml: 'yaml',
      yml: 'yaml',
    }
    return langMap[ext || ''] || 'plaintext'
  }

  // Handle editor mount
  const handleEditorMount: OnMount = useCallback((editor) => {
    editorRef.current = editor
    if (collabEnabled) {
      bindEditor(editor)
    }
  }, [collabEnabled, bindEditor])

  // Toggle collaboration
  const toggleCollab = useCallback(async () => {
    if (collabEnabled) {
      unbindEditor()
      disconnect()
      setCollabEnabled(false)
    } else {
      setCollabEnabled(true)
      try {
        await connect()
        if (editorRef.current) {
          bindEditor(editorRef.current)
        }
      } catch (err) {
        console.error('Failed to connect to collaboration:', err)
        setCollabEnabled(false)
      }
    }
  }, [collabEnabled, connect, disconnect, bindEditor, unbindEditor])

  // Copy share link
  const copyShareLink = useCallback(() => {
    const url = new URL(window.location.href)
    url.searchParams.set('room', roomId)
    navigator.clipboard.writeText(url.toString())
  }, [roomId])

  // Show demo code when no files are open
  const showDemo = openFiles.length === 0
  const currentCode = showDemo ? DEMO_CODE : (fileContents[activeFile || ''] || '')
  const currentLanguage = showDemo ? 'typescript' : getLanguage(activeFile || '')

  return (
    <div className="h-full flex flex-col bg-[#0d1117]">
      {/* Tab bar */}
      {!showDemo && openFiles.length > 0 && (
        <div className="h-9 bg-spawn-surface border-b border-spawn-border flex items-center justify-between overflow-x-auto">
          <div className="flex items-center">
            {openFiles.map((path) => (
              <div
                key={path}
                className={`
                  h-full px-3 flex items-center gap-2 border-r border-spawn-border
                  cursor-pointer select-none min-w-0 group
                  ${path === activeFile
                    ? 'bg-spawn-bg text-spawn-text'
                    : 'text-spawn-muted hover:text-spawn-text'
                  }
                `}
                onClick={() => setActiveFile(path)}
              >
                <span className="truncate text-sm max-w-[120px]">
                  {getFileName(path)}
                </span>
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    closeFile(path)
                  }}
                  className="opacity-0 group-hover:opacity-100 hover:bg-spawn-border rounded p-0.5"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>

          {/* Collaboration controls */}
          <div className="flex items-center gap-1 px-2">
            <button
              onClick={toggleCollab}
              className={`
                p-1.5 rounded transition-colors flex items-center gap-1
                ${collabEnabled
                  ? isConnected
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                  : 'text-spawn-muted hover:text-spawn-text hover:bg-spawn-border'
                }
              `}
              title={collabEnabled ? (isConnected ? 'Connected' : 'Connecting...') : 'Enable collaboration'}
            >
              {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </button>

            {collabEnabled && isConnected && (
              <>
                <button
                  onClick={() => setShowCollabPanel(!showCollabPanel)}
                  className={`
                    p-1.5 rounded transition-colors flex items-center gap-1
                    ${showCollabPanel ? 'bg-spawn-accent/20 text-spawn-accent' : 'text-spawn-muted hover:text-spawn-text'}
                  `}
                  title={`${peers.length} collaborator${peers.length !== 1 ? 's' : ''}`}
                >
                  <Users className="w-3.5 h-3.5" />
                  {peers.length > 0 && (
                    <span className="text-xs">{peers.length}</span>
                  )}
                </button>

                <button
                  onClick={copyShareLink}
                  className="p-1.5 rounded text-spawn-muted hover:text-spawn-text hover:bg-spawn-border transition-colors"
                  title="Copy share link"
                >
                  <Share2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Demo tab */}
      {showDemo && (
        <div className="h-9 bg-spawn-surface border-b border-spawn-border flex items-center justify-between px-1">
          <div className="h-full px-3 flex items-center gap-2 bg-spawn-bg text-spawn-text">
            <span className="text-sm">main.ts</span>
            <span className="text-[10px] text-spawn-accent bg-spawn-accent/10 px-1.5 py-0.5 rounded">demo</span>
          </div>

          {/* Collaboration controls for demo */}
          <div className="flex items-center gap-1 px-2">
            <button
              onClick={toggleCollab}
              className={`
                p-1.5 rounded transition-colors flex items-center gap-1
                ${collabEnabled
                  ? isConnected
                    ? 'bg-green-500/20 text-green-400'
                    : 'bg-yellow-500/20 text-yellow-400'
                  : 'text-spawn-muted hover:text-spawn-text hover:bg-spawn-border'
                }
              `}
              title={collabEnabled ? (isConnected ? 'Connected' : 'Connecting...') : 'Enable collaboration'}
            >
              {isConnected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            </button>

            {collabEnabled && isConnected && (
              <button
                onClick={() => setShowCollabPanel(!showCollabPanel)}
                className={`
                  p-1.5 rounded transition-colors flex items-center gap-1
                  ${showCollabPanel ? 'bg-spawn-accent/20 text-spawn-accent' : 'text-spawn-muted hover:text-spawn-text'}
                `}
                title={`${peers.length} collaborator${peers.length !== 1 ? 's' : ''}`}
              >
                <Users className="w-3.5 h-3.5" />
                {peers.length > 0 && (
                  <span className="text-xs">{peers.length}</span>
                )}
              </button>
            )}
          </div>
        </div>
      )}

      {/* Collaboration panel */}
      {showCollabPanel && collabEnabled && isConnected && (
        <div className="bg-spawn-surface border-b border-spawn-border p-2">
          <div className="flex items-center gap-2 text-xs text-spawn-muted mb-2">
            <Users className="w-3 h-3" />
            <span>Collaborators ({peers.length})</span>
          </div>
          {peers.length === 0 ? (
            <div className="text-xs text-spawn-muted py-1">
              No other collaborators yet. Share the link to invite others.
            </div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {peers.map((peer) => (
                <div
                  key={peer.peerId}
                  className="flex items-center gap-1.5 px-2 py-1 bg-spawn-bg rounded text-xs"
                >
                  <div
                    className="w-2 h-2 rounded-full"
                    style={{ backgroundColor: peer.color }}
                  />
                  <span className="text-spawn-text">{peer.name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Editor */}
      <div className="flex-1">
        <MonacoEditor
          height="100%"
          language={currentLanguage}
          value={currentCode}
          onChange={(value) => {
            if (!showDemo && activeFile) {
              updateFileContent(activeFile, value || '')
            }
          }}
          onMount={handleEditorMount}
          theme="spawn-dark"
          beforeMount={(monaco) => {
            monaco.editor.defineTheme('spawn-dark', {
              base: 'vs-dark',
              inherit: true,
              rules: [
                { token: 'comment', foreground: '6a737d', fontStyle: 'italic' },
                { token: 'keyword', foreground: 'ff7b72' },
                { token: 'string', foreground: 'a5d6ff' },
                { token: 'number', foreground: '79c0ff' },
                { token: 'type', foreground: 'ffa657' },
                { token: 'function', foreground: 'd2a8ff' },
                { token: 'variable', foreground: 'ffa657' },
                { token: 'constant', foreground: '79c0ff' },
                { token: 'parameter', foreground: 'ffa657' },
                { token: 'property', foreground: '7ee787' },
                { token: 'operator', foreground: 'ff7b72' },
              ],
              colors: {
                'editor.background': '#0d1117',
                'editor.foreground': '#c9d1d9',
                'editor.lineHighlightBackground': '#161b2250',
                'editor.selectionBackground': '#264f78',
                'editorCursor.foreground': '#58a6ff',
                'editorLineNumber.foreground': '#484f58',
                'editorLineNumber.activeForeground': '#c9d1d9',
                'editorIndentGuide.background': '#21262d',
                'editorIndentGuide.activeBackground': '#30363d',
                'editor.selectionHighlightBackground': '#3fb95040',
                'editorBracketMatch.background': '#58a6ff30',
                'editorBracketMatch.border': '#58a6ff',
              },
            })
          }}
          options={{
            fontFamily: 'JetBrains Mono, Fira Code, monospace',
            fontSize: 13,
            lineHeight: 1.7,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            renderLineHighlight: 'line',
            cursorBlinking: 'smooth',
            cursorStyle: 'line',
            cursorWidth: 2,
            padding: { top: 12, bottom: 12 },
            bracketPairColorization: { enabled: true },
            smoothScrolling: true,
            mouseWheelZoom: true,
            formatOnPaste: true,
            tabSize: 2,
            wordWrap: 'off',
            folding: true,
            foldingHighlight: true,
            showFoldingControls: 'mouseover',
            readOnly: showDemo,
          }}
        />
      </div>
    </div>
  )
}
