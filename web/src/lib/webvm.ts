// CheerpX WebVM Integration for spawn.new
// Based on https://github.com/chainnew/webvm config

import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'

// CheerpX types
declare global {
  interface Window {
    CheerpX: typeof CheerpX
  }
}

declare namespace CheerpX {
  interface CloudDevice {}
  interface IDBDevice {
    readFileAsBlob(path: string): Promise<Blob>
    reset(): Promise<void>
  }
  interface OverlayDevice {}
  interface WebDevice {}
  interface DataDevice {}
  
  interface Linux {
    setConsole(element: HTMLElement): void
    setCustomConsole(
      writeFunc: (buf: Uint8Array) => void,
      cols?: number,
      rows?: number
    ): (byte: number) => void
    run(
      program: string,
      args?: string[],
      options?: RunOptions
    ): Promise<number>
  }

  interface RunOptions {
    env?: string[]
    cwd?: string
    uid?: number
    gid?: number
  }

  interface Mount {
    type: 'ext2' | 'dir' | 'devs'
    path: string
    dev?: CloudDevice | IDBDevice | OverlayDevice | WebDevice | DataDevice
  }

  interface LinuxCreateOptions {
    mounts: Mount[]
  }

  namespace CloudDevice {
    function create(url: string): Promise<CloudDevice>
  }

  namespace IDBDevice {
    function create(name: string): Promise<IDBDevice>
  }

  namespace OverlayDevice {
    function create(
      base: CloudDevice,
      overlay: IDBDevice
    ): Promise<OverlayDevice>
  }

  namespace WebDevice {
    function create(path: string): Promise<WebDevice>
  }

  namespace DataDevice {
    function create(data: Uint8Array | string): Promise<DataDevice>
  }

  namespace Linux {
    function create(options: LinuxCreateOptions): Promise<Linux>
  }
}

// ============================================================================
// CONFIG - Matching chainnew/webvm
// ============================================================================

// The root filesystem location (from your fork's config)
export const diskImageUrl = "wss://disks.webvm.io/debian_large_20230522_5044875331_2.ext2"

// The root filesystem backend type
export const diskImageType = "cloud"

// Executable full path
export const cmd = "/bin/bash"

// Arguments
export const args = ["--login"]

// Optional extra parameters
export const opts = {
  env: [
    "HOME=/home/user",
    "TERM=xterm",
    "USER=user", 
    "SHELL=/bin/bash",
    "EDITOR=vim",
    "LANG=en_US.UTF-8",
    "LC_ALL=C"
  ],
  cwd: "/home/user",
  uid: 1000,
  gid: 1000
}

// ============================================================================
// DISK IMAGES
// ============================================================================

export const DISK_IMAGES = {
  debian_large: {
    name: 'Debian Large',
    url: 'wss://disks.webvm.io/debian_large_20230522_5044875331_2.ext2',
    size: '~1.4GB',
    description: 'Full Debian with Node, Python, dev tools',
  },
  debian_mini: {
    name: 'Debian Mini', 
    url: 'wss://disks.webvm.io/debian_mini_20230519_5022088024.ext2',
    size: '~350MB',
    description: 'Minimal Debian - fast boot',
  },
} as const

export type DiskImageKey = keyof typeof DISK_IMAGES

// ============================================================================
// WEBVM INSTANCE
// ============================================================================

export interface WebVMConfig {
  diskImage?: DiskImageKey
  idbName?: string
  onBoot?: (stage: string, progress: number) => void
  onReady?: () => void
  onError?: (error: Error) => void
}

export interface WebVMInstance {
  cx: CheerpX.Linux
  idbDevice: CheerpX.IDBDevice
  terminal: Terminal
  fitAddon: FitAddon
  sendInput: (byte: number) => void
  
  // Methods
  run: (cmd: string, args?: string[], options?: CheerpX.RunOptions) => Promise<number>
  exec: (command: string) => Promise<number>
  typeCommand: (cmd: string) => void
  attachToElement: (element: HTMLElement) => void
  resize: () => void
  reset: () => Promise<void>
  destroy: () => void
}

// CheerpX CDN URL
const CHEERPX_URL = 'https://cxrtnc.leaningtech.com/1.0.6/cx.js'

// Load CheerpX script
async function loadCheerpX(): Promise<void> {
  if (window.CheerpX) return

  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = CHEERPX_URL
    script.async = true
    script.onload = () => {
      if (window.CheerpX) {
        resolve()
      } else {
        reject(new Error('CheerpX loaded but not available on window'))
      }
    }
    script.onerror = () => reject(new Error('Failed to load CheerpX from CDN'))
    document.head.appendChild(script)
  })
}

// Create WebVM instance
export async function createWebVM(config: WebVMConfig = {}): Promise<WebVMInstance> {
  const {
    diskImage = 'debian_large',
    idbName = 'spawn-webvm-v1',
    onBoot,
    onReady,
    onError,
  } = config

  try {
    // Stage 1: Load CheerpX
    onBoot?.('Loading CheerpX engine...', 10)
    await loadCheerpX()

    // Stage 2: Create cloud device (disk image)
    onBoot?.('Connecting to disk image...', 20)
    const imageUrl = DISK_IMAGES[diskImage].url
    const cloudDevice = await CheerpX.CloudDevice.create(imageUrl)

    // Stage 3: Create IDB device for persistence
    onBoot?.('Initializing local storage...', 40)
    const idbDevice = await CheerpX.IDBDevice.create(idbName)

    // Stage 4: Create overlay device
    onBoot?.('Creating overlay filesystem...', 50)
    const overlayDevice = await CheerpX.OverlayDevice.create(cloudDevice, idbDevice)

    // Stage 5: Create Linux instance
    onBoot?.('Starting Linux...', 60)
    const cx = await CheerpX.Linux.create({
      mounts: [
        { type: 'ext2', path: '/', dev: overlayDevice },
        { type: 'devs', path: '/dev' },
      ],
    })

    // Stage 6: Setup xterm.js
    onBoot?.('Initializing terminal...', 80)
    const terminal = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'JetBrains Mono, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#0d1117',
        foreground: '#c9d1d9',
        cursor: '#58a6ff',
        cursorAccent: '#0d1117',
        selectionBackground: '#3b5998',
        black: '#0d1117',
        red: '#ff7b72',
        green: '#7ee787',
        yellow: '#d29922',
        blue: '#58a6ff',
        magenta: '#bc8cff',
        cyan: '#76e3ea',
        white: '#c9d1d9',
        brightBlack: '#6e7681',
        brightRed: '#ffa198',
        brightGreen: '#7ee787',
        brightYellow: '#e3b341',
        brightBlue: '#79c0ff',
        brightMagenta: '#d2a8ff',
        brightCyan: '#a5d6ff',
        brightWhite: '#f0f6fc',
      },
    })

    const fitAddon = new FitAddon()
    terminal.loadAddon(fitAddon)

    // Stage 7: Connect terminal to CheerpX
    onBoot?.('Connecting console...', 90)
    
    // Custom console - pipes xterm.js <-> CheerpX
    const sendInput = cx.setCustomConsole(
      (buf: Uint8Array) => {
        // Output from CheerpX -> terminal
        terminal.write(new Uint8Array(buf))
      },
      terminal.cols,
      terminal.rows
    )

    // Input from terminal -> CheerpX
    terminal.onData((data) => {
      for (let i = 0; i < data.length; i++) {
        sendInput(data.charCodeAt(i))
      }
    })

    // Stage 8: Start bash (using config from your fork)
    onBoot?.('Starting shell...', 95)
    
    // Don't await - let bash run in background
    cx.run(cmd, args, opts).catch(console.error)

    onBoot?.('Ready!', 100)
    onReady?.()

    // Helper to type a command into terminal
    const typeCommand = (command: string) => {
      const data = command + '\n'
      for (let i = 0; i < data.length; i++) {
        sendInput(data.charCodeAt(i))
      }
    }

    // Return instance
    const instance: WebVMInstance = {
      cx,
      idbDevice,
      terminal,
      fitAddon,
      sendInput,

      // Run a program directly
      run: (program, runArgs = [], options = {}) => {
        return cx.run(program, runArgs, {
          ...opts,
          ...options,
        })
      },

      // Execute a shell command
      exec: (command) => {
        return cx.run('/bin/bash', ['-c', command], opts)
      },

      // Type command into terminal (simulates user input)
      typeCommand,

      // Attach terminal to DOM element
      attachToElement: (element) => {
        terminal.open(element)
        fitAddon.fit()
      },

      // Resize terminal to fit container
      resize: () => {
        fitAddon.fit()
      },

      // Reset IDB storage
      reset: async () => {
        await idbDevice.reset()
      },

      // Cleanup
      destroy: () => {
        terminal.dispose()
      },
    }

    return instance
  } catch (error) {
    onError?.(error as Error)
    throw error
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

// Clone a git repo
export async function cloneRepo(
  vm: WebVMInstance,
  repoUrl: string,
  targetDir?: string
): Promise<void> {
  const repoName = targetDir || repoUrl.split('/').pop()?.replace('.git', '') || 'repo'
  vm.typeCommand(`git clone ${repoUrl} ${repoName}`)
}

// Install npm dependencies
export function npmInstall(vm: WebVMInstance, dir?: string): void {
  if (dir) {
    vm.typeCommand(`cd ${dir} && npm install`)
  } else {
    vm.typeCommand('npm install')
  }
}

// Run npm script
export function npmRun(vm: WebVMInstance, script: string, dir?: string): void {
  if (dir) {
    vm.typeCommand(`cd ${dir} && npm run ${script}`)
  } else {
    vm.typeCommand(`npm run ${script}`)
  }
}

// Read file from IDB
export async function readFile(vm: WebVMInstance, path: string): Promise<string> {
  const blob = await vm.idbDevice.readFileAsBlob(path)
  return blob.text()
}

export type { CheerpX }
