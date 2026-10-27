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

export interface IpodDesktopApi {
  isDesktop: true
  pickAudioFiles: () => Promise<{ tracks: Track[] } | null>
  pickAudioFolder: (
    albumName?: string,
  ) => Promise<{ folderName: string; tracks: Track[] } | null>
  resizeWindow: (bounds: { x: number; y: number; width: number; height: number }) => void
  moveWindow: (position: { x: number; y: number }) => void
  setMinimizedMode: (minimized: boolean) => void
  syncMenuState: (state: { shuffle: boolean; repeat: 'off' | 'one' | 'all' }) => void
  closeWindow: () => Promise<void>
  onMenuAction: (callback: (action: DesktopMenuAction) => void) => () => void
}

declare global {
  interface Window {
    ipodDesktop?: IpodDesktopApi
  }
}

export {}
