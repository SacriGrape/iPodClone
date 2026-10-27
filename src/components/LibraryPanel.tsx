import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import type { Track } from '../types'
import { formatBytes, formatCount, formatDuration, formatLongDuration } from '../lib/format'
import { recentTracks, totalDuration, totalSize } from '../lib/library'
import { FolderIcon, MusicIcon, PlayIcon, PlusIcon } from './Icons'

interface LibraryPanelProps {
  tracks: Track[]
  loading: boolean
  importing: number
  notice: string | null
  error: string | null
  playbackError: string | null
  currentTrackId: string | null
  isPlaying: boolean
  onImportMusic: () => void
  onImportFolder: (files: File[], albumName?: string) => void
  onPlayTrack: (track: Track, context: Track[]) => void
  onRemoveTrack: (id: string) => void
  onClear: () => void
  onDismissNotice: () => void
}

export function LibraryPanel({
  tracks,
  loading,
  importing,
  notice,
  error,
  playbackError,
  currentTrackId,
  isPlaying,
  onImportMusic,
  onImportFolder,
  onPlayTrack,
  onRemoveTrack,
  onClear,
  onDismissNotice,
}: LibraryPanelProps) {
  const [confirmingClear, setConfirmingClear] = useState(false)
  const [folderAlbum, setFolderAlbum] = useState('')
  const folderInputRef = useRef<HTMLInputElement>(null)
  const recent = recentTracks(tracks, 4)
  const problems = [error, playbackError].filter((message): message is string => Boolean(message))

  useEffect(() => {
    if (!confirmingClear) return
    const timeout = window.setTimeout(() => setConfirmingClear(false), 4000)
    return () => window.clearTimeout(timeout)
  }, [confirmingClear])

  useEffect(() => {
    const input = folderInputRef.current
    if (!input) return
    input.setAttribute('webkitdirectory', '')
    input.setAttribute('directory', '')
  }, [])

  const handleFolderInput = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.currentTarget.files ?? [])
    event.currentTarget.value = ''
    if (files.length === 0) return
    onImportFolder(files, folderAlbum.trim() || undefined)
  }

  const handleClear = () => {
    if (!confirmingClear) {
      setConfirmingClear(true)
      return
    }

    setConfirmingClear(false)
    onClear()
  }

  return (
    <aside className="library-panel" aria-labelledby="library-title">
      <div className="library-heading">
        <div>
          <p className="eyebrow">On this device</p>
          <h2 id="library-title">Your library</h2>
        </div>
        <span className="library-count">{formatCount(tracks.length, 'song')}</span>
      </div>

      <div className="library-stats" aria-live="polite">
        <span>
          <strong>{formatLongDuration(totalDuration(tracks))}</strong> of music
        </span>
        <span>
          <strong>{formatBytes(totalSize(tracks))}</strong> stored
        </span>
      </div>

      <button
        type="button"
        className="add-button"
        onClick={onImportMusic}
        disabled={importing > 0}
      >
        {importing > 0 ? (
          <>
            <span className="spinner" aria-hidden="true" />
            Adding {importing} {importing === 1 ? 'file' : 'files'}…
          </>
        ) : (
          <>
            <PlusIcon className="button-icon" />
            Add music
          </>
        )}
      </button>

      <p className="drop-hint">or drop audio files anywhere on this page</p>

      <div className="folder-import">
        <button
          type="button"
          className="folder-button"
          onClick={() => folderInputRef.current?.click()}
          disabled={importing > 0}
        >
          <FolderIcon className="button-icon" />
          Load folder
        </button>
        <input
          className="folder-album"
          type="text"
          value={folderAlbum}
          onChange={(event) => setFolderAlbum(event.target.value)}
          placeholder="Album name (optional)"
          aria-label="Album name for folder import"
          title="Used for untagged files; defaults to the folder name."
          disabled={importing > 0}
        />
        <input
          ref={folderInputRef}
          className="visually-hidden"
          type="file"
          multiple
          onChange={handleFolderInput}
          tabIndex={-1}
          aria-label="Choose a music folder"
        />
      </div>
      <p className="folder-hint">Untagged files use this album name, or the folder name.</p>

      {loading ? (
        <div className="library-loading" role="status">
          <span className="spinner" aria-hidden="true" />
          Opening your library…
        </div>
      ) : recent.length > 0 ? (
        <div className="recent-block">
          <div className="recent-heading">
            <h3>Recently added</h3>
            {tracks.length > recent.length && <span>{tracks.length} total</span>}
          </div>
          <div className="recent-list">
            {recent.map((track) => {
              const isCurrent = track.id === currentTrackId
              return (
                <div className={`recent-row${isCurrent ? ' is-current' : ''}`} key={track.id}>
                  <button
                    type="button"
                    className="recent-track"
                    onClick={() => onPlayTrack(track, tracks)}
                  >
                    <span className="track-play" aria-hidden="true">
                      <PlayIcon />
                    </span>
                    <span className="track-copy">
                      <span className="track-name">{track.title}</span>
                      <span className="track-sub">
                        {track.artist} · {track.album}
                      </span>
                    </span>
                    <span className="track-duration">
                      {isCurrent && isPlaying ? 'Playing' : formatDuration(track.duration)}
                    </span>
                  </button>
                  <button
                    type="button"
                    className="remove-track"
                    onClick={() => onRemoveTrack(track.id)}
                    aria-label={`Remove ${track.title} from library`}
                    title="Remove from library"
                  >
                    ×
                  </button>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        <div className="library-empty">
          <span className="empty-icon" aria-hidden="true">
            <MusicIcon />
          </span>
          <p>No music yet.</p>
          <span>Add MP3, M4A, FLAC, WAV, or OGG files to get started.</span>
        </div>
      )}

      {notice && (
        <div className="panel-notice" role="status">
          <span>{notice}</span>
          <button type="button" onClick={onDismissNotice} aria-label="Dismiss message">
            ×
          </button>
        </div>
      )}

      {problems.map((message) => (
        <p className="panel-error" role="alert" key={message}>
          {message}
        </p>
      ))}

      <div className="library-footer">
        <span>Stored locally in your browser. Nothing is uploaded.</span>
        {tracks.length > 0 && (
          <button
            type="button"
            className={`clear-button${confirmingClear ? ' confirming' : ''}`}
            onClick={handleClear}
          >
            {confirmingClear ? 'Click again to clear' : 'Clear library'}
          </button>
        )}
      </div>
    </aside>
  )
}
