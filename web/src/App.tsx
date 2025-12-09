import { useState, useRef, useCallback, useEffect } from 'react'
import {
  Terminal as TerminalIcon,
  Settings,
  Zap,
  X,
  Users,
  Lock,
  Unlock,
  Code2,
  MessageSquare,
  Bot,
  Github,
  Box,
  CheckCircle,
  Loader2,
  AlertCircle,
  Sparkles,
  Globe,
  ChevronDown,
  FolderPlus,
  FileText
} from 'lucide-react'

// Dynamic Architect URL based on current hostname
const ARCHITECT_URL = `http://${window.location.hostname}:3080`
const API_BASE = `http://${window.location.hostname}:3080`
import Terminal from './components/Terminal'
import Editor from './components/Editor'
import FileExplorer from './components/FileExplorer'
import Chat from './components/Chat'
import AgentConfig from './components/AgentConfig'
import GitHubPanel, { type Repository } from './components/GitHubPanel'
import Sandbox from './components/Sandbox'
import BrowserPanel from './components/BrowserPanel'
import SandboxDocuments from './components/SandboxDocuments'
import Dock from './components/ui/dock'
import { useAppStore } from './stores/app'
import { type SandboxInstance } from './components/Sandbox'
import { motion, AnimatePresence } from 'framer-motion'

// Theme definitions
const themes = {
  spawn: {
    name: 'Spawn',
    accent: '262 83% 58%', // purple
    accentHex: '#7c3aed',
    ring: '262 83% 58%',
  },
  ocean: {
    name: 'Ocean',
    accent: '199 89% 48%', // cyan
    accentHex: '#0ea5e9',
    ring: '199 89% 48%',
  },
  forest: {
    name: 'Forest',
    accent: '142 71% 45%', // green
    accentHex: '#22c55e',
    ring: '142 71% 45%',
  },
  sunset: {
    name: 'Sunset',
    accent: '25 95% 53%', // orange
    accentHex: '#f97316',
    ring: '25 95% 53%',
  },
  rose: {
    name: 'Rose',
    accent: '346 77% 50%', // rose/pink
    accentHex: '#e11d48',
    ring: '346 77% 50%',
  },
} as const

type ThemeKey = keyof typeof themes

// Toast notification component
function Toast({ 
  message, 
  type = 'info',
  onClose 
}: { 
  message: string
  type?: 'info' | 'success' | 'error' | 'loading'
  onClose?: () => void 
}) {
  const icons = {
    info: <Zap className="w-4 h-4 text-spawn-accent" />,
    success: <CheckCircle className="w-4 h-4 text-green-400" />,
    error: <AlertCircle className="w-4 h-4 text-red-400" />,
    loading: <Loader2 className="w-4 h-4 text-spawn-accent animate-spin" />,
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.9 }}
      className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] px-4 py-3 bg-[#1a1a1a] border border-[#333] rounded-xl shadow-2xl flex items-center gap-3"
    >
      {icons[type]}
      <span className="text-sm text-white">{message}</span>
      {onClose && type !== 'loading' && (
        <button onClick={onClose} className="text-gray-500 hover:text-white ml-2">
          <X className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  )
}

// Floating Panel Component
function FloatingPanel({ 
  title, 
  icon: Icon, 
  children, 
  isOpen, 
  onClose,
  defaultPosition = { x: 100, y: 100 },
  defaultSize = { width: 400, height: 300 },
  minSize = { width: 200, height: 150 },
  showTitle = true
}: { 
  title: string
  icon: React.ComponentType<{ className?: string }>
  children: React.ReactNode
  isOpen: boolean
  onClose: () => void
  defaultPosition?: { x: number, y: number }
  defaultSize?: { width: number, height: number }
  minSize?: { width: number, height: number }
  showTitle?: boolean
}) {
  const [position, setPosition] = useState(defaultPosition)
  const [size, setSize] = useState(defaultSize)
  const [isLocked, setIsLocked] = useState(false)
  
  const isDragging = useRef(false)
  const isResizing = useRef<'br' | 'bl' | null>(null)
  const dragStart = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const resizeStart = useRef({ x: 0, y: 0, width: 0, height: 0, posX: 0 })

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging.current) {
      const dx = e.clientX - dragStart.current.x
      const dy = e.clientY - dragStart.current.y
      setPosition({
        x: Math.max(0, dragStart.current.posX + dx),
        y: Math.max(40, dragStart.current.posY + dy)
      })
    } else if (isResizing.current) {
      const dx = e.clientX - resizeStart.current.x
      const dy = e.clientY - resizeStart.current.y
      
      if (isResizing.current === 'br') {
        setSize({
          width: Math.max(minSize.width, resizeStart.current.width + dx),
          height: Math.max(minSize.height, resizeStart.current.height + dy)
        })
      } else if (isResizing.current === 'bl') {
        const newWidth = Math.max(minSize.width, resizeStart.current.width - dx)
        setSize({
          width: newWidth,
          height: Math.max(minSize.height, resizeStart.current.height + dy)
        })
        setPosition(prev => ({
          ...prev,
          x: resizeStart.current.posX + (resizeStart.current.width - newWidth)
        }))
      }
    }
  }, [minSize])

  const handleMouseUp = useCallback(() => {
    isDragging.current = false
    isResizing.current = null
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
  }, [])

  useEffect(() => {
    document.addEventListener('mousemove', handleMouseMove)
    document.addEventListener('mouseup', handleMouseUp)
    return () => {
      document.removeEventListener('mousemove', handleMouseMove)
      document.removeEventListener('mouseup', handleMouseUp)
    }
  }, [handleMouseMove, handleMouseUp])

  const handleDragStart = (e: React.MouseEvent) => {
    if (isLocked) return
    if ((e.target as HTMLElement).closest('button')) return
    
    e.preventDefault()
    isDragging.current = true
    dragStart.current = { 
      x: e.clientX, 
      y: e.clientY, 
      posX: position.x, 
      posY: position.y 
    }
    document.body.style.cursor = 'grabbing'
    document.body.style.userSelect = 'none'
  }

  const handleResizeStart = (e: React.MouseEvent, corner: 'br' | 'bl') => {
    if (isLocked) return
    e.preventDefault()
    e.stopPropagation()
    
    isResizing.current = corner
    resizeStart.current = { 
      x: e.clientX, 
      y: e.clientY, 
      width: size.width, 
      height: size.height,
      posX: position.x
    }
    document.body.style.cursor = corner === 'br' ? 'se-resize' : 'sw-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="fixed z-40"
          style={{
            left: position.x,
            top: position.y,
            width: size.width,
            height: size.height
          }}
        >
          <div className="w-full h-full bg-[#0d0d0d]/95 backdrop-blur-xl border border-[#333] rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            {/* Title bar */}
            <div 
              className={`h-8 bg-[#1a1a1a] border-b border-[#333] flex items-center justify-between px-3 select-none ${!isLocked ? 'cursor-grab active:cursor-grabbing' : ''}`}
              onMouseDown={handleDragStart}
            >
              <div className="flex items-center gap-2">
                {showTitle && (
                  <>
                    <Icon className="w-3 h-3 text-spawn-accent" />
                    <span className="text-xs font-medium text-gray-300">{title}</span>
                  </>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-mono text-gray-500 bg-[#0a0a0a] px-1.5 py-0.5 rounded">
                  {Math.round(position.x)}, {Math.round(position.y)}
                </span>
                
                <button 
                  onClick={() => setIsLocked(!isLocked)}
                  className={`p-1 rounded transition-colors ${isLocked ? 'text-spawn-accent' : 'text-gray-500 hover:text-gray-300'}`}
                  title={isLocked ? 'Unlock position' : 'Lock position'}
                >
                  {isLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                </button>
                
                <button 
                  onClick={onClose}
                  className="w-3 h-3 rounded-full bg-red-500/80 hover:bg-red-500 flex items-center justify-center group"
                >
                  <X className="w-2 h-2 text-red-900 opacity-0 group-hover:opacity-100" />
                </button>
              </div>
            </div>
            
            <div className="flex-1 overflow-hidden">
              {children}
            </div>

            {!isLocked && (
              <>
                <div 
                  className="absolute bottom-0 right-0 w-5 h-5 cursor-se-resize group"
                  onMouseDown={(e) => handleResizeStart(e, 'br')}
                >
                  <svg className="absolute bottom-1 right-1 w-2.5 h-2.5 text-gray-600 group-hover:text-spawn-accent transition-colors" viewBox="0 0 6 6">
                    <circle cx="5" cy="1" r="0.7" fill="currentColor" />
                    <circle cx="5" cy="3" r="0.7" fill="currentColor" />
                    <circle cx="3" cy="3" r="0.7" fill="currentColor" />
                    <circle cx="5" cy="5" r="0.7" fill="currentColor" />
                    <circle cx="3" cy="5" r="0.7" fill="currentColor" />
                    <circle cx="1" cy="5" r="0.7" fill="currentColor" />
                  </svg>
                </div>
                
                <div 
                  className="absolute bottom-0 left-0 w-5 h-5 cursor-sw-resize group"
                  onMouseDown={(e) => handleResizeStart(e, 'bl')}
                >
                  <svg className="absolute bottom-1 left-1 w-2.5 h-2.5 text-gray-600 group-hover:text-spawn-accent transition-colors" viewBox="0 0 6 6" style={{ transform: 'scaleX(-1)' }}>
                    <circle cx="5" cy="1" r="0.7" fill="currentColor" />
                    <circle cx="5" cy="3" r="0.7" fill="currentColor" />
                    <circle cx="3" cy="3" r="0.7" fill="currentColor" />
                    <circle cx="5" cy="5" r="0.7" fill="currentColor" />
                    <circle cx="3" cy="5" r="0.7" fill="currentColor" />
                    <circle cx="1" cy="5" r="0.7" fill="currentColor" />
                  </svg>
                </div>
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Code Editor Panel with tabs
function CodeEditorPanel() {
  const [activeTab, setActiveTab] = useState<'code' | 'browser' | 'docs'>('code')

  return (
    <div className="flex flex-col h-full">
      {/* Tab bar */}
      <div className="h-8 bg-[#151515] border-b border-[#333] flex items-center px-2 gap-1 flex-shrink-0">
        <button
          onClick={() => setActiveTab('code')}
          className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
            activeTab === 'code'
              ? 'bg-spawn-accent/20 text-spawn-accent'
              : 'text-gray-400 hover:text-white hover:bg-[#222]'
          }`}
        >
          <Code2 className="w-3 h-3" />
          Code
        </button>
        <button
          onClick={() => setActiveTab('browser')}
          className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
            activeTab === 'browser'
              ? 'bg-spawn-accent/20 text-spawn-accent'
              : 'text-gray-400 hover:text-white hover:bg-[#222]'
          }`}
        >
          <Globe className="w-3 h-3" />
          Browser
        </button>
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-3 py-1 text-xs rounded transition-colors flex items-center gap-1.5 ${
            activeTab === 'docs'
              ? 'bg-spawn-accent/20 text-spawn-accent'
              : 'text-gray-400 hover:text-white hover:bg-[#222]'
          }`}
        >
          <FileText className="w-3 h-3" />
          Docs
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeTab === 'code' ? (
          <>
            <div className="w-48 border-r border-[#333] flex flex-col">
              <div className="h-7 bg-[#151515] border-b border-[#333] flex items-center px-2">
                <span className="text-[10px] text-gray-400 uppercase tracking-wider">Explorer</span>
              </div>
              <div className="flex-1 overflow-auto">
                <FileExplorer />
              </div>
            </div>
            <div className="flex-1">
              <Editor />
            </div>
          </>
        ) : activeTab === 'browser' ? (
          <div className="flex-1">
            <BrowserPanel defaultUrl="https://example.com" />
          </div>
        ) : (
          <div className="flex-1">
            <SandboxDocuments />
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  // Panel visibility - will be overwritten by loaded layout
  const [showCode, setShowCode] = useState(true)
  const [showChat, setShowChat] = useState(true)
  const [showTerminal, setShowTerminal] = useState(false)
  const [showAgents, setShowAgents] = useState(false)
  const [showGitHub, setShowGitHub] = useState(false)
  const [showSandbox, setShowSandbox] = useState(false)
  const [showArchitect, setShowArchitect] = useState(false)
  const [layoutLoaded, setLayoutLoaded] = useState(false)

  // Load layout from DB on mount
  useEffect(() => {
    const loadLayout = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/layout`)
        if (res.ok) {
          const layout = await res.json()
          if (layout?.panels) {
            setShowCode(layout.panels.code?.visible ?? true)
            setShowChat(layout.panels.chat?.visible ?? true)
            setShowTerminal(layout.panels.terminal?.visible ?? false)
            setShowSandbox(layout.panels.sandbox?.visible ?? false)
            setShowArchitect(layout.panels.architect?.visible ?? false)
            setShowAgents(layout.panels.agents?.visible ?? false)
            setShowGitHub(layout.panels.github?.visible ?? false)
          }
        }
      } catch (e) {
        console.log('Could not load layout from DB, using defaults')
      }
      setLayoutLoaded(true)
    }
    loadLayout()
  }, [])

  // Save layout to DB whenever panel visibility changes
  const saveLayout = useCallback(() => {
    if (!layoutLoaded) return // Don't save during initial load
    const layout = {
      panels: {
        code: { visible: showCode },
        chat: { visible: showChat },
        terminal: { visible: showTerminal },
        sandbox: { visible: showSandbox },
        architect: { visible: showArchitect },
        agents: { visible: showAgents },
        github: { visible: showGitHub },
      }
    }
    fetch(`${API_BASE}/api/layout`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(layout)
    }).catch(() => {})
  }, [layoutLoaded, showCode, showChat, showTerminal, showSandbox, showArchitect, showAgents, showGitHub])

  useEffect(() => {
    saveLayout()
  }, [showCode, showChat, showTerminal, showSandbox, showArchitect, showAgents, showGitHub, saveLayout])
  
  // Sandbox state
  const [sandboxVM, setSandboxVM] = useState<SandboxInstance | null>(null)
  
  // Claude-ify state
  const [isClaudifying, setIsClaudifying] = useState(false)
  const [claudifyingRepo, setClaudifyingRepo] = useState<string | null>(null)

  // Add Project state
  const [isAddingProject, setIsAddingProject] = useState(false)
  
  // Toast
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'error' | 'loading' } | null>(null)

  // Theme state
  const [currentTheme, setCurrentTheme] = useState<ThemeKey>(() => {
    const saved = localStorage.getItem('spawn-theme')
    return (saved as ThemeKey) || 'spawn'
  })
  const [showThemeMenu, setShowThemeMenu] = useState(false)

  // Apply theme to CSS variables
  useEffect(() => {
    const theme = themes[currentTheme]
    const root = document.documentElement
    root.style.setProperty('--primary', theme.accent)
    root.style.setProperty('--accent', theme.accent)
    root.style.setProperty('--ring', theme.ring)
    localStorage.setItem('spawn-theme', currentTheme)
  }, [currentTheme])

  const { connected } = useAppStore()

  // Handle sandbox ready
  const handleSandboxReady = useCallback((vm: SandboxInstance) => {
    setSandboxVM(vm)
    setToast({ message: 'Sandbox ready!', type: 'success' })
    setTimeout(() => setToast(null), 3000)
  }, [])

  // Handle clone from GitHub panel
  const handleCloneRepo = useCallback((repo: Repository) => {
    // Open sandbox if not open
    if (!showSandbox) {
      setShowSandbox(true)
    }

    // If sandbox is ready, clone immediately
    if (sandboxVM) {
      sandboxVM.cloneRepo(repo.clone_url)
      setToast({ message: `Cloning ${repo.name}...`, type: 'loading' })
      setTimeout(() => setToast({ message: `Cloned ${repo.name}!`, type: 'success' }), 2000)
      setTimeout(() => setToast(null), 4000)
    } else {
      setToast({ message: 'Start the sandbox first, then clone', type: 'info' })
      setTimeout(() => setToast(null), 3000)
    }
  }, [showSandbox, sandboxVM])

  // Handle Add Project - index local workspace like a repo
  const handleAddProject = useCallback(async () => {
    setIsAddingProject(true)
    setToast({ message: 'Indexing project files...', type: 'loading' })

    try {
      const res = await fetch(`${API_BASE}/api/index-project`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ path: '/workspace' })
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}`)

      const data = await res.json()
      setToast({
        message: `Indexed ${data.filesIndexed || 0} files!`,
        type: 'success'
      })
    } catch (e) {
      console.error('Add project error:', e)
      setToast({
        message: 'Failed to index project',
        type: 'error'
      })
    } finally {
      setIsAddingProject(false)
      setTimeout(() => setToast(null), 4000)
    }
  }, [])

  // Handle Claude-ify flow
  const handleClaudify = useCallback(async (repo: Repository) => {
    setIsClaudifying(true)
    setClaudifyingRepo(repo.name)

    try {
      // Step 1: Open sandbox if not open
      if (!showSandbox) {
        setShowSandbox(true)
        setToast({ message: 'Starting sandbox...', type: 'loading' })
        await new Promise(r => setTimeout(r, 1000))
      }

      // Step 2: Clone repository
      if (sandboxVM) {
        setToast({ message: `Cloning ${repo.name}...`, type: 'loading' })
        sandboxVM.cloneRepo(repo.clone_url)
        await new Promise(r => setTimeout(r, 3000))

        // Step 3: cd into repo and npm install
        setToast({ message: 'Installing dependencies...', type: 'loading' })
        sandboxVM.runCommand(`cd ${repo.name} && npm install`)
        await new Promise(r => setTimeout(r, 5000))

        setToast({ message: `${repo.name} is ready!`, type: 'success' })
      } else {
        setToast({ message: 'Start sandbox first', type: 'error' })
      }

      setTimeout(() => setToast(null), 4000)

    } catch (error) {
      console.error('Claude-ify failed:', error)
      setToast({ message: `Failed to setup ${repo.name}`, type: 'error' })
      setTimeout(() => setToast(null), 4000)
    } finally {
      setIsClaudifying(false)
      setClaudifyingRepo(null)
    }
  }, [showSandbox, sandboxVM])

  const dockItems = [
    { 
      icon: Code2, 
      label: "Code", 
      onClick: () => setShowCode(!showCode),
      active: showCode
    },
    { 
      icon: MessageSquare, 
      label: "Chat", 
      onClick: () => setShowChat(!showChat),
      active: showChat
    },
    { 
      icon: TerminalIcon, 
      label: "Terminal", 
      onClick: () => setShowTerminal(!showTerminal),
      active: showTerminal
    },
    { 
      icon: Box, 
      label: "Sandbox", 
      onClick: () => setShowSandbox(!showSandbox),
      active: showSandbox
    },
    {
      icon: Sparkles,
      label: "Architect",
      onClick: () => setShowArchitect(!showArchitect),
      active: showArchitect
    },
    { 
      icon: Bot, 
      label: "Agents", 
      onClick: () => setShowAgents(!showAgents),
      active: showAgents
    },
    { 
      icon: Users, 
      label: "Collaborate", 
      onClick: () => setToast({ message: 'WebRTC collaboration coming soon!', type: 'info' }),
      active: false
    },
    { 
      icon: Settings, 
      label: "Settings", 
      onClick: () => {},
      active: false
    },
  ]

  return (
    <div className="h-screen flex flex-col bg-spawn-bg overflow-hidden">
      {/* Header */}
      <header className="h-10 border-b border-spawn-border/50 flex items-center justify-between px-4 bg-[#0a0a0a]">
        <div className="flex items-center gap-2">
          <Zap className="w-4 h-4 text-spawn-accent" />
          <span className="text-sm font-semibold text-spawn-text">spawn.new</span>
          <span className="text-[10px] text-spawn-muted bg-spawn-accent/10 px-1.5 py-0.5 rounded-full">beta</span>
        </div>
        
        <div className="flex items-center gap-4">
          {isClaudifying && (
            <div className="flex items-center gap-2 text-xs text-spawn-accent">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Setting up {claudifyingRepo}...</span>
            </div>
          )}

          {/* Theme Selector */}
          <div className="relative">
            <button
              onClick={() => setShowThemeMenu(!showThemeMenu)}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md hover:bg-[#1a1a1a] transition-colors text-xs text-spawn-muted hover:text-spawn-text"
            >
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: themes[currentTheme].accentHex }}
              />
              <span>{themes[currentTheme].name}</span>
              <ChevronDown className="w-3 h-3" />
            </button>

            {showThemeMenu && (
              <>
                <div
                  className="fixed inset-0 z-40"
                  onClick={() => setShowThemeMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 z-50 bg-[#141414] border border-[#333] rounded-lg shadow-xl py-1 min-w-[140px]">
                  {(Object.keys(themes) as ThemeKey[]).map((key) => (
                    <button
                      key={key}
                      onClick={() => {
                        setCurrentTheme(key)
                        setShowThemeMenu(false)
                      }}
                      className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs hover:bg-[#1f1f1f] transition-colors ${
                        currentTheme === key ? 'text-white' : 'text-gray-400'
                      }`}
                    >
                      <div
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: themes[key].accentHex }}
                      />
                      <span>{themes[key].name}</span>
                      {currentTheme === key && (
                        <CheckCircle className="w-3 h-3 ml-auto text-green-400" />
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Tasking.md tab */}
          <button
            onClick={() => {
              // Open Tasking.md in the editor
              const { openFile } = useAppStore.getState()
              openFile('/workspace/Tasking.md')
              setShowCode(true)
            }}
            className="flex items-center gap-1 px-2 py-1 rounded-md hover:bg-[#1a1a1a] transition-colors text-xs text-spawn-muted hover:text-spawn-text"
            title="Open Tasking.md"
          >
            <FileText className="w-3 h-3" />
            <span>Tasking</span>
          </button>

          <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${connected ? 'bg-spawn-green' : 'bg-spawn-red'}`} />
            <span className="text-xs text-spawn-muted">
              {connected ? 'Connected' : 'Offline'}
            </span>
          </div>
        </div>
      </header>

      {/* Main Area */}
      <div className="flex-1 relative bg-[#080808]">
        {/* Grid background */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `
              linear-gradient(to right, #fff 1px, transparent 1px),
              linear-gradient(to bottom, #fff 1px, transparent 1px)
            `,
            backgroundSize: '40px 40px'
          }}
        />

        {/* Panels */}
        <FloatingPanel
          title="Code"
          icon={Code2}
          isOpen={showCode}
          onClose={() => setShowCode(false)}
          defaultPosition={{ x: 20, y: 60 }}
          defaultSize={{ width: 700, height: 450 }}
          minSize={{ width: 400, height: 300 }}
        >
          <CodeEditorPanel />
        </FloatingPanel>

        <FloatingPanel
          title="Chat"
          icon={MessageSquare}
          isOpen={showChat}
          onClose={() => setShowChat(false)}
          defaultPosition={{ x: 740, y: 60 }}
          defaultSize={{ width: 380, height: 450 }}
          minSize={{ width: 280, height: 200 }}
          showTitle={false}
        >
          <Chat />
        </FloatingPanel>

        <FloatingPanel
          title="Terminal"
          icon={TerminalIcon}
          isOpen={showTerminal}
          onClose={() => setShowTerminal(false)}
          defaultPosition={{ x: 20, y: 530 }}
          defaultSize={{ width: 700, height: 220 }}
          minSize={{ width: 300, height: 120 }}
        >
          <Terminal />
        </FloatingPanel>

        <FloatingPanel
          title="Sandbox"
          icon={Box}
          isOpen={showSandbox}
          onClose={() => setShowSandbox(false)}
          defaultPosition={{ x: 100, y: 100 }}
          defaultSize={{ width: 700, height: 500 }}
          minSize={{ width: 500, height: 350 }}
        >
          <Sandbox 
            onReady={handleSandboxReady}
            onCommand={(cmd) => console.log('Command:', cmd)}
          />
        </FloatingPanel>

        <FloatingPanel
          title="GitHub"
          icon={Github}
          isOpen={showGitHub}
          onClose={() => setShowGitHub(false)}
          defaultPosition={{ x: 820, y: 60 }}
          defaultSize={{ width: 360, height: 520 }}
          minSize={{ width: 300, height: 400 }}
        >
          <GitHubPanel 
            onCloneRepo={handleCloneRepo}
            onClaudify={handleClaudify}
            isClaudifying={isClaudifying}
            claudifyingRepo={claudifyingRepo}
          />
        </FloatingPanel>

        <FloatingPanel
          title="AI Agents"
          icon={Bot}
          isOpen={showAgents}
          onClose={() => setShowAgents(false)}
          defaultPosition={{ x: 1200, y: 60 }}
          defaultSize={{ width: 340, height: 520 }}
          minSize={{ width: 300, height: 400 }}
        >
          <AgentConfig />
        </FloatingPanel>

        <FloatingPanel
          title="Architect"
          icon={Sparkles}
          isOpen={showArchitect}
          onClose={() => setShowArchitect(false)}
          defaultPosition={{ x: 50, y: 50 }}
          defaultSize={{ width: 1100, height: 700 }}
          minSize={{ width: 600, height: 400 }}
        >
          <div className="flex flex-col h-full">
            {/* Toolbar */}
            <div className="h-9 bg-[#151515] border-b border-[#333] flex items-center px-3 gap-2 flex-shrink-0">
              <button
                onClick={handleAddProject}
                disabled={isAddingProject}
                className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md bg-spawn-accent/20 text-spawn-accent hover:bg-spawn-accent/30 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAddingProject ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <FolderPlus className="w-3 h-3" />
                )}
                <span>{isAddingProject ? 'Indexing...' : 'Add Project'}</span>
              </button>
              <span className="text-[10px] text-gray-500">Index local project files for AI analysis</span>
            </div>
            {/* Iframe */}
            <iframe
              src={ARCHITECT_URL}
              className="flex-1 w-full border-0"
              title="Architect"
            />
          </div>
        </FloatingPanel>
      </div>

      {/* Dock */}
      <div className="fixed bottom-3 left-1/2 -translate-x-1/2 z-50">
        <Dock items={dockItems} />
      </div>

      {/* Toast notifications */}
      <AnimatePresence>
        {toast && (
          <Toast 
            message={toast.message} 
            type={toast.type}
            onClose={() => setToast(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
