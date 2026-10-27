import type { RepeatMode, Settings, Track } from '../types'
import { buildShuffleOrder, getNextPosition, getPreviousPosition } from './queue'
import { loadSettings } from './settings'

export interface PlayerState {
  queue: Track[]
  index: number
  isPlaying: boolean
  isLoading: boolean
  currentTime: number
  duration: number
  volume: number
  shuffle: boolean
  repeat: RepeatMode
  error: string | null
}

type Listener = () => void

export class Player {
  private audio: HTMLAudioElement
  private context: AudioContext | null = null
  private gain: GainNode | null = null
  private source: MediaElementAudioSourceNode | null = null
  private listeners = new Set<Listener>()
  private urls = new Map<string, string>()
  private state: PlayerState
  private order: number[] = []
  private orderPosition = 0
  private loadToken = 0
  private clickerEnabled: boolean
  private destroyed = false

  constructor(settings: Settings) {
    this.audio = new Audio()
    this.audio.preload = 'auto'
    this.audio.crossOrigin = 'anonymous'
    this.clickerEnabled = settings.clicker === 'on'
    this.state = {
      queue: [],
      index: 0,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      volume: settings.volume,
      shuffle: settings.shuffle,
      repeat: settings.repeat,
      error: null,
    }

    this.audio.addEventListener('timeupdate', this.handleTimeUpdate)
    this.audio.addEventListener('durationchange', this.handleDurationChange)
    this.audio.addEventListener('play', this.handlePlay)
    this.audio.addEventListener('pause', this.handlePause)
    this.audio.addEventListener('waiting', this.handleWaiting)
    this.audio.addEventListener('canplay', this.handleCanPlay)
    this.audio.addEventListener('ended', this.handleEnded)
    this.audio.addEventListener('error', this.handleError)
    window.addEventListener('beforeunload', this.revokeUrls)
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  getSnapshot = (): PlayerState => this.state

  playQueue(tracks: Track[], startIndex = 0): void {
    if (tracks.length === 0) {
      this.stop()
      return
    }

    const index = Math.min(Math.max(0, startIndex), tracks.length - 1)
    this.setState({
      queue: [...tracks],
      index,
      isPlaying: false,
      isLoading: true,
      currentTime: 0,
      duration: tracks[index]?.duration ?? 0,
      error: null,
    })
    this.rebuildOrder()
    this.emit()
    void this.loadCurrent(true)
  }

  async play(): Promise<void> {
    if (this.state.queue.length === 0) return

    if (!this.audio.src) {
      await this.loadCurrent(true)
      return
    }

    this.ensureAudioGraph()
    this.setGainImmediate(0)
    if (this.audio.ended) this.audio.currentTime = 0

    try {
      await this.audio.play()
      if (this.destroyed) return
      this.fadeTo(this.state.volume, 0.12)
      this.setState({ isPlaying: true, isLoading: false, error: null })
      this.emit()
    } catch (error) {
      this.handlePlayFailure(error)
    }
  }

  pause(): void {
    this.audio.pause()
    this.setState({ isPlaying: false })
    this.emit()
  }

  toggle(): void {
    if (this.state.isPlaying) this.pause()
    else void this.play()
  }

  next(fromEnded = false): void {
    if (this.state.queue.length === 0) return

    if (fromEnded && this.state.repeat === 'one') {
      this.audio.currentTime = 0
      void this.play()
      return
    }

    const nextPosition = getNextPosition(
      this.orderPosition,
      this.order.length,
      this.state.repeat === 'all',
    )

    if (nextPosition === null) {
      if (fromEnded) {
        this.setState({ isPlaying: false, currentTime: this.state.duration })
        this.emit()
      }
      return
    }

    this.orderPosition = nextPosition
    this.setState({ index: this.order[nextPosition] ?? 0 })
    this.emit()
    void this.loadCurrent(true)
  }

  previous(): void {
    if (this.state.queue.length === 0) return

    if (Number.isFinite(this.audio.currentTime) && this.audio.currentTime > 3) {
      this.seek(0)
      return
    }

    const previousPosition = getPreviousPosition(
      this.orderPosition,
      this.order.length,
      this.state.repeat === 'all',
    )

    if (previousPosition === null) {
      this.seek(0)
      return
    }

    this.orderPosition = previousPosition
    this.setState({ index: this.order[previousPosition] ?? 0 })
    this.emit()
    void this.loadCurrent(true)
  }

  seek(time: number): void {
    const duration =
      Number.isFinite(this.audio.duration) && this.audio.duration > 0
        ? this.audio.duration
        : this.state.duration
    const clamped = Math.min(Math.max(0, time), Math.max(0, duration))

    if (this.audio.readyState > 0) {
      try {
        this.audio.currentTime = clamped
      } catch {
        // Some browsers briefly reject seeks while the new source is loading.
      }
    }

    this.setState({ currentTime: clamped })
    this.emit()
  }

  skip(seconds: number): void {
    this.seek(this.state.currentTime + seconds)
  }

  setVolume(volume: number): void {
    const clamped = Math.min(Math.max(0, volume), 1)
    this.setState({ volume: clamped })

    if (this.gain && this.context) {
      const now = this.context.currentTime
      this.gain.gain.cancelScheduledValues(now)
      this.gain.gain.setTargetAtTime(clamped, now, 0.01)
      this.audio.volume = 1
    } else {
      this.audio.volume = clamped
    }

    this.emit()
  }

  setShuffle(shuffle: boolean): void {
    if (this.state.shuffle === shuffle) return
    this.setState({ shuffle })
    this.rebuildOrder()
    this.emit()
  }

  setRepeat(repeat: RepeatMode): void {
    if (this.state.repeat === repeat) return
    this.setState({ repeat })
    this.emit()
  }

  setClicker(enabled: boolean): void {
    this.clickerEnabled = enabled
  }

  stop(): void {
    this.loadToken += 1
    this.audio.pause()
    this.audio.removeAttribute('src')
    this.audio.load()
    this.order = []
    this.orderPosition = 0
    this.setState({
      queue: [],
      index: 0,
      isPlaying: false,
      isLoading: false,
      currentTime: 0,
      duration: 0,
      error: null,
    })
    this.emit()
  }

  click(): void {
    if (!this.clickerEnabled) return

    this.ensureAudioGraph()
    if (!this.context) return

    const now = this.context.currentTime
    const oscillator = this.context.createOscillator()
    const clickGain = this.context.createGain()

    oscillator.type = 'square'
    oscillator.frequency.setValueAtTime(1500, now)
    clickGain.gain.setValueAtTime(0.015, now)
    clickGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.012)
    oscillator.connect(clickGain).connect(this.context.destination)
    oscillator.start(now)
    oscillator.stop(now + 0.014)
  }

  destroy(): void {
    this.destroyed = true
    this.loadToken += 1
    this.audio.pause()
    this.audio.removeEventListener('timeupdate', this.handleTimeUpdate)
    this.audio.removeEventListener('durationchange', this.handleDurationChange)
    this.audio.removeEventListener('play', this.handlePlay)
    this.audio.removeEventListener('pause', this.handlePause)
    this.audio.removeEventListener('waiting', this.handleWaiting)
    this.audio.removeEventListener('canplay', this.handleCanPlay)
    this.audio.removeEventListener('ended', this.handleEnded)
    this.audio.removeEventListener('error', this.handleError)
    window.removeEventListener('beforeunload', this.revokeUrls)
    this.audio.removeAttribute('src')
    this.audio.load()
    this.revokeUrls()
    void this.context?.close()
    this.listeners.clear()
  }

  private async loadCurrent(autoplay: boolean): Promise<void> {
    const track = this.state.queue[this.state.index]
    if (!track) {
      this.stop()
      return
    }

    const token = (this.loadToken += 1)
    this.ensureAudioGraph()
    this.setGainImmediate(0)
    this.setState({
      isLoading: true,
      currentTime: 0,
      duration: track.duration,
      error: null,
    })
    this.emit()

    this.audio.pause()
    this.audio.src = this.getUrl(track)
    this.audio.load()

    if (!autoplay) {
      this.setState({ isLoading: false })
      this.emit()
      return
    }

    try {
      await this.audio.play()
      if (this.destroyed || token !== this.loadToken) return
      this.fadeTo(this.state.volume, 0.12)
      this.setState({ isPlaying: true, isLoading: false })
      this.emit()
    } catch (error) {
      if (token !== this.loadToken) return
      this.handlePlayFailure(error)
    }
  }

  private handlePlayFailure(error: unknown): void {
    if (this.destroyed) return
    if (error instanceof DOMException && error.name === 'AbortError') return

    this.setState({
      isPlaying: false,
      isLoading: false,
      error: 'This file could not be played. It may use an unsupported codec.',
    })
    this.emit()
  }

  private rebuildOrder(): void {
    const length = this.state.queue.length

    if (length === 0) {
      this.order = []
      this.orderPosition = 0
      return
    }

    if (this.state.shuffle) {
      this.order = buildShuffleOrder(length, this.state.index)
      this.orderPosition = 0
    } else {
      this.order = Array.from({ length }, (_, index) => index)
      this.orderPosition = this.state.index
    }
  }

  private ensureAudioGraph(): void {
    if (!this.context) {
      const AudioContextConstructor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext

      if (!AudioContextConstructor) {
        this.audio.volume = this.state.volume
        return
      }

      try {
        this.context = new AudioContextConstructor()
        this.source = this.context.createMediaElementSource(this.audio)
        this.gain = this.context.createGain()
        this.gain.gain.value = this.state.volume
        this.source.connect(this.gain).connect(this.context.destination)
        this.audio.volume = 1
      } catch {
        this.context = null
        this.source = null
        this.gain = null
        this.audio.volume = this.state.volume
      }
    }

    if (this.context?.state === 'suspended') {
      void this.context.resume()
    }
  }

  private setGainImmediate(value: number): void {
    if (this.gain && this.context) {
      const now = this.context.currentTime
      this.gain.gain.cancelScheduledValues(now)
      this.gain.gain.setValueAtTime(value, now)
    } else {
      this.audio.volume = value
    }
  }

  private fadeTo(value: number, seconds: number): void {
    if (!this.gain || !this.context) {
      this.audio.volume = value
      return
    }

    const now = this.context.currentTime
    this.gain.gain.cancelScheduledValues(now)
    this.gain.gain.setValueAtTime(this.gain.gain.value, now)
    this.gain.gain.linearRampToValueAtTime(value, now + seconds)
  }

  private getUrl(track: Track): string {
    if (track.sourceUrl) return track.sourceUrl

    const existing = this.urls.get(track.id)
    if (existing) return existing

    if (!track.blob) throw new Error(`Track "${track.title}" has no audio source.`)

    const url = URL.createObjectURL(track.blob)
    this.urls.set(track.id, url)
    return url
  }

  private revokeUrls = (): void => {
    for (const url of this.urls.values()) URL.revokeObjectURL(url)
    this.urls.clear()
  }

  private handleTimeUpdate = (): void => {
    if (this.destroyed || !Number.isFinite(this.audio.currentTime)) return
    if (Math.abs(this.state.currentTime - this.audio.currentTime) < 0.05) return
    this.setState({ currentTime: this.audio.currentTime })
    this.emit()
  }

  private handleDurationChange = (): void => {
    if (!Number.isFinite(this.audio.duration) || this.audio.duration <= 0) return
    if (this.audio.duration === this.state.duration) return
    this.setState({ duration: this.audio.duration })
    this.emit()
  }

  private handlePlay = (): void => {
    if (this.state.isPlaying) return
    this.setState({ isPlaying: true })
    this.emit()
  }

  private handlePause = (): void => {
    if (!this.state.isPlaying) return
    this.setState({ isPlaying: false })
    this.emit()
  }

  private handleWaiting = (): void => {
    if (this.state.isLoading) return
    this.setState({ isLoading: true })
    this.emit()
  }

  private handleCanPlay = (): void => {
    if (!this.state.isLoading) return
    this.setState({ isLoading: false })
    this.emit()
  }

  private handleEnded = (): void => {
    this.next(true)
  }

  private handleError = (): void => {
    if (this.destroyed) return
    this.setState({
      isPlaying: false,
      isLoading: false,
      error: 'This file could not be played. It may use an unsupported codec.',
    })
    this.emit()
  }

  private setState(patch: Partial<PlayerState>): void {
    this.state = { ...this.state, ...patch }
  }

  private emit(): void {
    for (const listener of this.listeners) listener()
  }
}

let singleton: Player | null = null

export function getPlayer(): Player {
  if (!singleton) singleton = new Player(loadSettings())
  return singleton
}
