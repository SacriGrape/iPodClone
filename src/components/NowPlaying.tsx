import type { RepeatMode, Track } from '../types'
import { formatDuration } from '../lib/format'
import { PauseIcon, PlayIcon, VolumeIcon, VolumeLowIcon } from './Icons'

interface NowPlayingProps {
  track: Track | null
  index: number
  queueLength: number
  isPlaying: boolean
  isLoading: boolean
  currentTime: number
  duration: number
  shuffle: boolean
  repeat: RepeatMode
  volume: number
  mode: 'progress' | 'volume'
  onVolumeChange: (volume: number) => void
  error: string | null
}

export function NowPlaying({
  track,
  index,
  queueLength,
  isPlaying,
  isLoading,
  currentTime,
  duration,
  shuffle,
  repeat,
  volume,
  mode,
  onVolumeChange,
  error,
}: NowPlayingProps) {
  if (!track) {
    return (
      <div className="now-playing now-playing-empty">
        <p className="np-empty-title">Nothing playing</p>
        <p className="np-empty-copy">Pick a song from the menu.</p>
      </div>
    )
  }

  const progress = duration > 0 ? Math.min(1, Math.max(0, currentTime / duration)) : 0
  const remaining = Math.max(0, duration - currentTime)
  const volumePercent = Math.round(Math.min(1, Math.max(0, volume)) * 100)
  const modes: string[] = []

  if (shuffle) modes.push('Shuffle')
  if (repeat === 'one') modes.push('Repeat One')
  else if (repeat === 'all') modes.push('Repeat All')

  return (
    <div className="now-playing">
      <div className="np-index-row">
        <span>
          {index + 1} of {queueLength}
        </span>
        <span className="np-state" aria-label={isPlaying ? 'Playing' : 'Paused'}>
          {isLoading ? '···' : isPlaying ? <PauseIcon /> : <PlayIcon />}
        </span>
      </div>

      <div className="np-track">
        <p className="np-title" aria-live="polite">
          {track.title}
        </p>
        <p className="np-artist">{track.artist}</p>
        <p className="np-album">{track.album}</p>
      </div>

      <div className="np-progress" data-mode={mode}>
        <div className="np-progress-track">
          <div className="np-panel np-time-panel" aria-hidden={mode !== 'progress'}>
            <div
              className="np-bar"
              role="progressbar"
              aria-label="Playback progress"
              aria-valuemin={0}
              aria-valuemax={Math.round(duration)}
              aria-valuenow={Math.round(currentTime)}
            >
              <span style={{ width: `${progress * 100}%` }} />
            </div>
            <div className="np-times">
              <span>{formatDuration(currentTime)}</span>
              <span>{`-${formatDuration(remaining)}`}</span>
            </div>
          </div>

          <div className="np-panel np-volume-panel" aria-hidden={mode !== 'volume'}>
            <div className="np-volume-row">
              <VolumeLowIcon className="np-volume-icon" />
              <input
                className="np-volume-input"
                type="range"
                min={0}
                max={100}
                step={1}
                value={volumePercent}
                onChange={(event) => onVolumeChange(Number(event.target.value) / 100)}
                aria-label="Volume"
                tabIndex={mode === 'volume' ? 0 : -1}
                style={{
                  background: `linear-gradient(to right, currentColor 0 ${volumePercent}%, transparent ${volumePercent}% 100%)`,
                }}
              />
              <VolumeIcon className="np-volume-icon" />
            </div>
            <div className="np-times np-volume-labels">
              <span>Volume</span>
              <span>{volumePercent}%</span>
            </div>
          </div>
        </div>

        <p className={`np-mode${error ? ' np-mode-error' : ''}`}>
          {error ?? modes.join(' · ')}
        </p>
      </div>
    </div>
  )
}
