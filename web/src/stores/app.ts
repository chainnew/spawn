import { create } from 'zustand'

export interface FileNode {
  name: string
  type: 'file' | 'directory'
  path: string
  children?: FileNode[]
}

interface PendingChatMessage {
  content: string
  filename: string
}

interface AppState {
  // Connection
  connected: boolean
  setConnected: (connected: boolean) => void

  // Files
  files: FileNode[]
  setFiles: (files: FileNode[]) => void
  selectedFile: string | null
  setSelectedFile: (path: string | null) => void

  // Editor
  openFiles: string[]
  activeFile: string | null
  fileContents: Record<string, string>
  openFile: (path: string, content?: string) => void
  closeFile: (path: string) => void
  setActiveFile: (path: string) => void
  updateFileContent: (path: string, content: string) => void

  // Terminal
  terminalHistory: string[]
  addTerminalOutput: (output: string) => void
  clearTerminal: () => void

  // Chat integration
  pendingChatMessage: PendingChatMessage | null
  setPendingChatMessage: (message: PendingChatMessage | null) => void
}

export const useAppStore = create<AppState>((set, get) => ({
  // Connection
  connected: false,
  setConnected: (connected) => set({ connected }),

  // Files
  files: [],
  setFiles: (files) => set({ files }),
  selectedFile: null,
  setSelectedFile: (path) => set({ selectedFile: path }),

  // Editor
  openFiles: [],
  activeFile: null,
  fileContents: {},
  
  openFile: (path, content = '') => {
    const { openFiles, fileContents } = get()
    if (!openFiles.includes(path)) {
      set({ 
        openFiles: [...openFiles, path],
        fileContents: { ...fileContents, [path]: content },
      })
    }
    set({ activeFile: path })
  },
  
  closeFile: (path) => {
    const { openFiles, activeFile, fileContents } = get()
    const newOpenFiles = openFiles.filter(f => f !== path)
    const newContents = { ...fileContents }
    delete newContents[path]
    
    set({ 
      openFiles: newOpenFiles,
      fileContents: newContents,
      activeFile: path === activeFile 
        ? newOpenFiles[newOpenFiles.length - 1] || null 
        : activeFile,
    })
  },
  
  setActiveFile: (path) => set({ activeFile: path }),
  
  updateFileContent: (path, content) => {
    const { fileContents } = get()
    set({ fileContents: { ...fileContents, [path]: content } })
  },

  // Terminal
  terminalHistory: [],
  addTerminalOutput: (output) => {
    const { terminalHistory } = get()
    set({ terminalHistory: [...terminalHistory, output] })
  },
  clearTerminal: () => set({ terminalHistory: [] }),

  // Chat integration
  pendingChatMessage: null,
  setPendingChatMessage: (message) => set({ pendingChatMessage: message }),
}))
