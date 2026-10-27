export type RepeatMode = 'off' | 'one' | 'all'
export type BacklightMode = 'off' | '1s' | '2s' | '3s' | '5s' | 'always'
export type ClickerMode = 'on' | 'off'
export type MouseAction = 'back' | 'next' | 'previous' | 'playPause' | 'none'

export interface Track {
  id: string
  sourceKey: string
  title: string
  artist: string
  album: string
  duration: number
  trackNumber?: number
  discNumber?: number
  fileName: string
  mimeType: string
  size: number
  addedAt: number
  blob?: Blob
  sourceUrl?: string
}

export interface Settings {
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  backlight: BacklightMode
  clicker: ClickerMode
  wheelStep: number
  mouseSide1: MouseAction
  mouseSide2: MouseAction
}

export interface Playlist {
  id: string
  name: string
  tracks: Track[]
}

export interface Artist {
  name: string
  tracks: Track[]
}
