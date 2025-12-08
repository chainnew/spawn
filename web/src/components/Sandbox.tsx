import { useState, useEffect, useRef, useCallback } from 'react'
import { 
  Play, 
  Square, 
  HardDrive,
  Cpu,
  Wifi,
  WifiOff,
  Loader2,
  AlertCircle,
  RotateCcw,
  CheckCircle
} from 'lucide-react'
import { createWebVM, DISK_IMAGES, type WebVMInstance, type DiskImageKey } from '../lib/webvm'

interface SandboxProps {
  onReady?: (vm: WebVMInstance) => void
  onCommand?: (cmd: string) => void
  autoStart?: boolean
}

type SandboxStatus = 'idle' | 'booting' | 'ready' | 'error'

export default function Sandbox({ onReady, onCommand, autoStart = false }: SandboxProps) {
  const [status, setStatus] = useState<SandboxStatus>('idle')
  const [bootStage, setBootStage] = useState('')
  const [bootProgress, setBootProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [selectedImage, setSelectedImage] = useState<DiskImageKey>('debian_large')
  const [isNetworkEnabled, setIsNetworkEnabled] = useState(false)
  
  const terminalRef = useRef<HTMLDivElement>(null)
  const vmRef = useRef<WebVMInstance | null>(null)

  const startSandbox = useCallback(async () => {
    if (status === 'booting') return
    
    setStatus('booting')
    setBootProgress(0)
    setError(null)

    try {
      const vm = await createWebVM({
        diskImage: selectedImage,
        idbName: `spawn-webvm-${selectedImage}`,
        onBoot: (stage, progress) => {
          setBootStage(stage)
          setBootProgress(progress)
        },
        onReady: () => {
          setStatus('ready')
        },
        onError: (err) => {
          setError(err.message)
          setStatus('error')
        },
      })

      vmRef.current = vm

      // Attach terminal to DOM
      if (terminalRef.current) {
        vm.attachToElement(terminalRef.current)
      }

      onReady?.(vm)
    } catch (err) {
      setError((err as Error).message)
      setStatus('error')
    }
  }, [selectedImage, onReady, status])

  const stopSandbox = useCallback(() => {
    if (vmRef.current) {
      vmRef.current.destroy()
      vmRef.current = null
    }
    setStatus('idle')
    setBootProgress(0)
    setBootStage('')
  }, [])

  const resetStorage = useCallback(async () => {
    if (vmRef.current) {
      await vmRef.current.reset()
      stopSandbox()
    }
  }, [stopSandbox])

  // Quick command - types into terminal
  const runQuickCommand = useCallback((cmd: string) => {
    if (vmRef.current) {
      vmRef.current.typeCommand(cmd)
    }
    onCommand?.(cmd)
  }, [onCommand])

  // Handle terminal resize
  useEffect(() => {
    if (status !== 'ready' || !vmRef.current) return

    const handleResize = () => {
      vmRef.current?.resize()
    }

    window.addEventListener('resize', handleResize)
    vmRef.current.resize()

    return () => window.removeEventListener('resize', handleResize)
  }, [status])

  // Auto-start
  useEffect(() => {
    if (autoStart && status === 'idle') {
      startSandbox()
    }
  }, [autoStart, status, startSandbox])

  // Idle state
  if (status === 'idle') {
    return (
      <div className="h-full flex flex-col bg-[#0d1117]">
        <div className="flex-1 flex flex-col items-center justify-center p-6">
          <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-spawn-accent/20 to-purple-500/20 flex items-center justify-center mb-4">
            <HardDrive className="w-10 h-10 text-spawn-accent" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">WebVM Sandbox</h3>
          <p className="text-sm text-gray-400 text-center mb-6 max-w-xs">
            Full Debian Linux in your browser via WebAssembly.
            Changes persist in IndexedDB.
          </p>
          
          {/* Image selector */}
          <div className="w-full max-w-sm mb-4">
            <label className="text-[10px] uppercase tracking-wider text-gray-500 mb-2 block">
              Select Image
            </label>
            <div className="space-y-2">
              {(Object.entries(DISK_IMAGES) as [DiskImageKey, typeof DISK_IMAGES[DiskImageKey]][]).map(([key, image]) => (
                <button
                  key={key}
                  onClick={() => setSelectedImage(key)}
                  className={`w-full p-3 rounded-xl border text-left transition-all ${
                    selectedImage === key
                      ? 'border-spawn-accent bg-spawn-accent/10'
                      : 'border-[#333] bg-[#161b22] hover:border-[#444]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-white">{image.name}</span>
                    <span className="text-xs text-gray-500">{image.size}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{image.description}</p>
                </button>
              ))}
            </div>
          </div>

          <button
            onClick={startSandbox}
            className="flex items-center justify-center gap-2 px-8 py-3 bg-spawn-accent text-black rounded-xl font-medium hover:bg-spawn-accent/90 transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Sandbox
          </button>

          {/* Info */}
          <div className="mt-6 p-3 bg-[#161b22] rounded-xl border border-[#333] text-[10px] text-gray-400 max-w-sm">
            <div className="font-medium text-gray-300 mb-1">Powered by CheerpX:</div>
            <ul className="space-y-0.5">
              <li>• x86 → WebAssembly JIT compilation</li>
              <li>• Streams disk blocks on-demand</li>
              <li>• Persists changes to IndexedDB</li>
              <li>• Optional Tailscale networking</li>
            </ul>
          </div>
        </div>
      </div>
    )
  }

  // Booting state
  if (status === 'booting') {
    return (
      <div className="h-full flex flex-col items-center justify-center p-6 bg-[#0d1117]">
        <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-spawn-accent/20 to-purple-500/20 flex items-center justify-center mb-4 relative">
          <HardDrive className="w-10 h-10 text-spawn-accent" />
          <Loader2 className="absolute w-24 h-24 text-spawn-accent/30 animate-spin" />
        </div>
        
        <h3 className="text-lg font-semibold text-white mb-2">Booting WebVM</h3>
        <p className="text-sm text-gray-400 text-center mb-4">{bootStage}</p>
        
        {/* Progress bar */}
        <div className="w-full max-w-xs">
          <div className="h-2 bg-[#333] rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-gradient-to-r from-spawn-accent to-purple-500 transition-all duration-500"
              style={{ width: `${bootProgress}%` }}
            />
          </div>
          <div className="text-center text-xs text-gray-500">
            {Math.round(bootProgress)}%
          </div>
        </div>

        {/* Boot stages */}
        <div className="mt-6 w-full max-w-xs space-y-1">
          {[
            { stage: 'Loading CheerpX engine...', threshold: 10 },
            { stage: 'Connecting to disk image...', threshold: 20 },
            { stage: 'Initializing local storage...', threshold: 40 },
            { stage: 'Creating overlay filesystem...', threshold: 50 },
            { stage: 'Starting Linux...', threshold: 60 },
            { stage: 'Initializing terminal...', threshold: 80 },
            { stage: 'Connecting console...', threshold: 90 },
            { stage: 'Starting shell...', threshold: 95 },
          ].map(({ stage, threshold }) => {
            const isComplete = bootProgress >= threshold
            const isCurrent = bootStage === stage
            
            return (
              <div 
                key={stage}
                className={`flex items-center gap-2 text-xs ${
                  isComplete ? 'text-green-400' : isCurrent ? 'text-spawn-accent' : 'text-gray-600'
                }`}
              >
                {isComplete ? (
                  <CheckCircle className="w-3 h-3" />
                ) : isCurrent ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <div className="w-3 h-3 rounded-full border border-current" />
                )}
                <span>{stage}</span>
              </div>
            )
          })}
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
        <h3 className="text-lg font-semibold text-white mb-2">Boot Failed</h3>
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
            <li>• Check browser console for detailed errors</li>
            <li>• Ensure COOP/COEP headers are set</li>
            <li>• Try Chrome (best WebAssembly support)</li>
            <li>• Clear IndexedDB and retry</li>
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
            <span className="text-[10px] text-green-400 font-medium">Running</span>
          </div>
          
          <div className="h-4 w-px bg-[#333]" />
          
          <div className="flex items-center gap-1 text-[10px] text-gray-500">
            <Cpu className="w-3 h-3" />
            <span>CheerpX</span>
          </div>

          <div className="text-[10px] text-gray-500">
            {DISK_IMAGES[selectedImage].name}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsNetworkEnabled(!isNetworkEnabled)}
            className={`p-1 rounded transition-colors ${
              isNetworkEnabled ? 'text-green-400' : 'text-gray-500 hover:text-gray-300'
            }`}
            title="Tailscale networking"
          >
            {isNetworkEnabled ? <Wifi className="w-3 h-3" /> : <WifiOff className="w-3 h-3" />}
          </button>

          <button
            onClick={resetStorage}
            className="p-1 rounded text-gray-500 hover:text-yellow-400 transition-colors"
            title="Reset storage"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
          
          <button
            onClick={stopSandbox}
            className="p-1 rounded text-gray-500 hover:text-red-400 transition-colors"
            title="Stop sandbox"
          >
            <Square className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Terminal container - xterm.js renders here */}
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
          'node -v',
          'python3 -V',
          'git --version',
          'df -h',
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
