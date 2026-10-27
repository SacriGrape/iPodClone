import type { Track } from './types'

export type DesktopMenuAction =
  | 'add-files'
  | 'add-folder'
  | 'play-pause'
  | 'next'
  | 'previous'
  | 'volume-up'
  | 'volume-down'
  | 'toggle-shuffle'
  | 'cycle-repeat'
  | 'repeat-off'
  | 'repeat-one'
  | 'repeat-all'
  | 'show-settings'
  | 'clear-library'

export interface FolderImportOptions {
  albumName?: string
  deepScan?: boolean
}

export type FolderImportProgress =
  | {
      phase: 'scanning'
      folders: number
      files: number
      skippedFolders: number
    }
  | {
      phase: 'reading'
      folders: number
      files: number
      parsed: number
      total: number
      failed: number
    }

export interface FolderImportResult {
  folderName: string
  tracks: Track[]
  folders: number
  files: number
  skippedFolders: number
}

export interface IpodDesktopApi {
  isDesktop: true
  pickAudioFiles: () => Promise<{ tracks: Track[] } | null>
  pickAudioFolder: (options?: FolderImportOptions) => Promise<FolderImportResult | null>
  resizeWindow: (bounds: { x: number; y: number; width: number; height: number }) => void
  moveWindow: (position: { x: number; y: number }) => void
  setMinimizedMode: (minimized: boolean) => void
  syncMenuState: (state: { shuffle: boolean; repeat: 'off' | 'one' | 'all' }) => void
  closeWindow: () => Promise<void>
  onMenuAction: (callback: (action: DesktopMenuAction) => void) => () => void
  onFolderProgress: (callback: (progress: FolderImportProgress) => void) => () => void
}

declare global {
  interface Window {
    ipodDesktop?: IpodDesktopApi
  }
}

export {}
