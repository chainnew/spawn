// CheerpX WebVM Integration for spawn.new
// NOTE: CheerpX only works on x86 - disabled for ARM Mac/Kali

import { Terminal } from '@xterm/xterm'

// Stub for ARM - WebVM won't work anyway
export const DISK_IMAGES = {
  debian_large: {
    name: 'Debian Large (x86 only)',
    url: 'wss://disks.webvm.io/debian_large_20230522_5044875331_2.ext2',
    size: '~1.4GB',
    description: 'Requires x86 - not available on ARM',
  },
  debian_mini: {
    name: 'Debian Mini (x86 only)', 
    url: 'wss://disks.webvm.io/debian_mini_20230519_5022088024.ext2',
    size: '~350MB',
    description: 'Requires x86 - not available on ARM',
  },
} as const

export type DiskImageKey = keyof typeof DISK_IMAGES

export interface WebVMConfig {
  diskImage?: DiskImageKey
  idbName?: string
  onBoot?: (stage: string, progress: number) => void
  onReady?: () => void
  onError?: (error: Error) => void
}

export interface WebVMInstance {
  terminal: Terminal
  typeCommand: (cmd: string) => void
  destroy: () => void
}

// Stub implementation for ARM
export async function createWebVM(config: WebVMConfig = {}): Promise<WebVMInstance> {
  config.onError?.(new Error('WebVM (CheerpX) requires x86 architecture. Running on ARM - use the native terminal instead.'))
  throw new Error('WebVM not available on ARM')
}

export function cloneRepo(vm: WebVMInstance, repoUrl: string): void {
  vm.typeCommand(`git clone ${repoUrl}`)
}
