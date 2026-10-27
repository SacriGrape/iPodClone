import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react'
import type { ChangeEvent } from 'react'
import type { Track } from './types'
import type { DesktopMenuAction, FolderImportProgress } from './desktop'
import { Ipod } from './components/Ipod'
import { LibraryPanel } from './components/LibraryPanel'
import { WindowResizeHandles } from './components/WindowResizeHandles'
import { UploadIcon } from './components/Icons'
import { useLibrary } from './hooks/useLibrary'
import { useSettings } from './hooks/useSettings'
import { formatCount } from './lib/format'
import { buildArtists, buildPlaylists, sortTracks } from './lib/library'
import { getPlayer } from './lib/player'

export default function App() {
  const player = getPlayer()
  const playerState = useSyncExternalStore(
    player.subscribe,
    player.getSnapshot,
    player.getSnapshot,
  )
  const { settings, updateSettings } = useSettings()
  const {
    tracks,
    loading,
    importing,
    notice,
    error,
    importFiles,
    addTracks,
    removeTrack,
    clearLibrary,
    dismissNotice,
  } = useLibrary()

  const desktop = window.ipodDesktop
  const isDesktop = Boolean(desktop)
  const [isDragging, setIsDragging] = useState(false)
  const [desktopFolderOpen, setDesktopFolderOpen] = useState(false)
  const [desktopFolderAlbum, setDesktopFolderAlbum] = useState('')
  const [desktopDeepScan, setDesktopDeepScan] = useState(true)
  const [desktopBusy, setDesktopBusy] = useState<string | null>(null)
  const [desktopError, setDesktopError] = useState<string | null>(null)
  const folderImportActiveRef = useRef(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const playlists = useMemo(() => buildPlaylists(tracks), [tracks])
  const artists = useMemo(() => buildArtists(tracks), [tracks])
  const currentTrack = playerState.queue[playerState.index] ?? null

  useEffect(() => {
    player.setVolume(settings.volume)
  }, [player, settings.volume])

  useEffect(() => {
    player.setShuffle(settings.shuffle)
  }, [player, settings.shuffle])

  useEffect(() => {
    player.setRepeat(settings.repeat)
  }, [player, settings.repeat])

  useEffect(() => {
    player.setClicker(settings.clicker === 'on')
  }, [player, settings.clicker])

  useEffect(() => {
    desktop?.syncMenuState({ shuffle: settings.shuffle, repeat: settings.repeat })
  }, [desktop, settings.shuffle, settings.repeat])

  useEffect(() => {
    if (!desktopError) return
    const timeout = window.setTimeout(() => setDesktopError(null), 5000)
    return () => window.clearTimeout(timeout)
  }, [desktopError])

  useEffect(() => {
    if (!desktop) return

    return desktop.onFolderProgress((progress: FolderImportProgress) => {
      if (!folderImportActiveRef.current) return

      if (progress.phase === 'scanning') {
        setDesktopBusy(
          `Scanning ${formatCount(progress.folders, 'folder')} · ${formatCount(progress.albumFolders, 'album folder')} · ${formatCount(progress.files, 'song')}…`,
        )
      } else {
        setDesktopBusy(
          `Reading tags ${progress.parsed}/${progress.total}${progress.failed ? ` · ${progress.failed} failed` : ''}…`,
        )
      }
    })
  }, [desktop])

  const openFilePicker = useCallback(() => {
    if (!desktop) {
      fileInputRef.current?.click()
      return
    }

    setDesktopError(null)
    setDesktopBusy('Reading files…')
    void desktop
      .pickAudioFiles()
      .then((result) => {
        if (result?.tracks.length) return addTracks(result.tracks)
        return undefined
      })
      .catch(() => setDesktopError('Could not read the selected files.'))
      .finally(() => setDesktopBusy(null))
  }, [addTracks, desktop])

  const openDesktopFolderDialog = useCallback(() => {
    setDesktopError(null)
    setDesktopFolderOpen(true)
  }, [])

  const handleDesktopFolder = useCallback(async () => {
    if (!desktop) return

    setDesktopError(null)
    folderImportActiveRef.current = true
    setDesktopBusy('Scanning folder…')

    try {
      const result = await desktop.pickAudioFolder({
        albumName: desktopFolderAlbum.trim() || undefined,
        deepScan: desktopDeepScan,
      })

      if (result && result.tracks.length === 0) {
        setDesktopError('No audio files were found in that folder.')
      } else if (result?.tracks.length) {
        await addTracks(result.tracks)
        setDesktopFolderAlbum('')
        setDesktopFolderOpen(false)
      }
    } catch {
      setDesktopError('Could not read the selected folder.')
    } finally {
      folderImportActiveRef.current = false
      setDesktopBusy(null)
    }
  }, [addTracks, desktop, desktopDeepScan, desktopFolderAlbum])

  const handleFileInput = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.currentTarget.files ?? [])
      event.currentTarget.value = ''
      if (files.length) void importFiles(files)
    },
    [importFiles],
  )

  const handleImportFolder = useCallback(
    (files: File[], albumName?: string) => {
      void importFiles(files, { fallbackAlbum: albumName })
    },
    [importFiles],
  )

  const handlePlayTrack = useCallback(
    (track: Track, context: Track[]) => {
      const index = context.findIndex((entry) => entry.id === track.id)
      player.playQueue(context, index >= 0 ? index : 0)
    },
    [player],
  )

  const handleLibraryPlay = useCallback(
    (track: Track, context: Track[]) => {
      player.click()
      handlePlayTrack(track, context)
    },
    [handlePlayTrack, player],
  )

  const handleTogglePlayback = useCallback(() => {
    if (playerState.queue.length === 0) {
      if (tracks.length === 0) return
      player.playQueue(sortTracks(tracks), 0)
      return
    }

    player.toggle()
  }, [player, playerState.queue.length, tracks])

  const handlePrevious = useCallback(() => {
    player.previous()
  }, [player])

  const handleNext = useCallback(() => {
    player.next()
  }, [player])

  const handleVolumeChange = useCallback(
    (volume: number) => {
      updateSettings({ volume: Math.min(1, Math.max(0, volume)) })
    },
    [updateSettings],
  )

  const handleRemoveTrack = useCallback(
    (id: string) => {
      if (currentTrack?.id === id) player.stop()
      void removeTrack(id)
    },
    [currentTrack?.id, player, removeTrack],
  )

  const handleClearLibrary = useCallback(() => {
    player.stop()
    void clearLibrary()
  }, [clearLibrary, player])

  useEffect(() => {
    if (!desktop) return

    return desktop.onMenuAction((action: DesktopMenuAction) => {
      switch (action) {
        case 'add-files':
          openFilePicker()
          break
        case 'add-folder':
          openDesktopFolderDialog()
          break
        case 'play-pause':
          handleTogglePlayback()
          break
        case 'next':
          handleNext()
          break
        case 'previous':
          handlePrevious()
          break
        case 'volume-up':
          window.dispatchEvent(new CustomEvent('ipod:volume', { detail: 1 }))
          break
        case 'volume-down':
          window.dispatchEvent(new CustomEvent('ipod:volume', { detail: -1 }))
          break
        case 'toggle-shuffle':
          updateSettings({ shuffle: !settings.shuffle })
          break
        case 'cycle-repeat': {
          const nextRepeat =
            settings.repeat === 'off' ? 'one' : settings.repeat === 'one' ? 'all' : 'off'
          updateSettings({ repeat: nextRepeat })
          break
        }
        case 'repeat-off':
          updateSettings({ repeat: 'off' })
          break
        case 'repeat-one':
          updateSettings({ repeat: 'one' })
          break
        case 'repeat-all':
          updateSettings({ repeat: 'all' })
          break
        case 'show-settings':
          window.dispatchEvent(new Event('ipod:show-settings'))
          break
        case 'clear-library':
          handleClearLibrary()
          break
        default:
          break
      }
    })
  }, [
    desktop,
    openFilePicker,
    openDesktopFolderDialog,
    handleTogglePlayback,
    handleNext,
    handlePrevious,
    updateSettings,
    settings.shuffle,
    settings.repeat,
    handleClearLibrary,
  ])

  useEffect(() => {
    let depth = 0

    const hasFiles = (event: DragEvent) =>
      event.dataTransfer?.types.includes('Files') ?? false

    const handleDragEnter = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth += 1
      setIsDragging(true)
    }

    const handleDragOver = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      if (event.dataTransfer) event.dataTransfer.dropEffect = 'copy'
    }

    const handleDragLeave = (event: DragEvent) => {
      if (!hasFiles(event)) return
      depth = Math.max(0, depth - 1)
      if (depth === 0) setIsDragging(false)
    }

    const handleDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return
      event.preventDefault()
      depth = 0
      setIsDragging(false)
      const files = Array.from(event.dataTransfer?.files ?? [])
      if (files.length) void importFiles(files)
    }

    window.addEventListener('dragenter', handleDragEnter)
    window.addEventListener('dragover', handleDragOver)
    window.addEventListener('dragleave', handleDragLeave)
    window.addEventListener('drop', handleDrop)

    return () => {
      window.removeEventListener('dragenter', handleDragEnter)
      window.removeEventListener('dragover', handleDragOver)
      window.removeEventListener('dragleave', handleDragLeave)
      window.removeEventListener('drop', handleDrop)
    }
  }, [importFiles])

  const desktopMessage =
    (desktopFolderOpen ? null : desktopBusy) ??
    desktopError ??
    playerState.error ??
    notice

  return (
    <div className={`app${isDesktop ? ' is-desktop' : ''}`}>
      <header className="site-header">
        <div className="site-brand">
          <span className="brand-mark" aria-hidden="true">
            ♪
          </span>
          <div className="brand-copy">
            <h1>iPod</h1>
            <p>Your music, in your pocket.</p>
          </div>
        </div>
        <span className="header-badge">
          <span className="badge-dot" aria-hidden="true" />
          Local-first
        </span>
      </header>

      <main className="app-layout">
        <section className="device-stage" aria-label="iPod player">
          <Ipod
            tracks={tracks}
            playlists={playlists}
            artists={artists}
            settings={settings}
            player={player}
            playerState={playerState}
            onSettingsChange={updateSettings}
            onPlayTrack={handlePlayTrack}
            onTogglePlayback={handleTogglePlayback}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onVolumeChange={handleVolumeChange}
            onImportMusic={openFilePicker}
            onImportFolder={isDesktop ? openDesktopFolderDialog : undefined}
            showImport={isDesktop}
          />
          <p className="keyboard-hint keyboard-hint-desktop">
            Click the iPod to use <kbd>↑</kbd>
            <kbd>↓</kbd> <span aria-hidden="true">·</span> <kbd>Enter</kbd> select{' '}
            <span aria-hidden="true">·</span> <kbd>Esc</kbd> back
          </p>
          <p className="keyboard-hint keyboard-hint-touch">
            Drag the wheel or tap the buttons.
          </p>
        </section>

        <LibraryPanel
          tracks={tracks}
          loading={loading}
          importing={importing}
          notice={notice}
          error={error}
          playbackError={playerState.error}
          currentTrackId={currentTrack?.id ?? null}
          isPlaying={playerState.isPlaying}
          onImportMusic={openFilePicker}
          onImportFolder={handleImportFolder}
          onPlayTrack={handleLibraryPlay}
          onRemoveTrack={handleRemoveTrack}
          onClear={handleClearLibrary}
          onDismissNotice={dismissNotice}
        />
      </main>

      <footer className="site-footer">
        <span>Files stay on this device. Nothing is uploaded.</span>
        <span>A local-first tribute. Not affiliated with Apple.</span>
      </footer>

      <input
        ref={fileInputRef}
        className="visually-hidden"
        type="file"
        accept="audio/*,.mp3,.m4a,.aac,.flac,.wav,.wave,.ogg,.oga,.opus"
        multiple
        onChange={handleFileInput}
        tabIndex={-1}
      />

      {isDesktop && (
        <button
          type="button"
          className="desktop-close"
          onClick={() => void desktop?.closeWindow()}
          aria-label="Close window"
        >
          ×
        </button>
      )}

      {isDesktop && desktopMessage && (
        <div className="desktop-toast" role="status">
          {desktopMessage}
        </div>
      )}

      {isDesktop && desktopFolderOpen && (
        <div
          className="desktop-sheet-backdrop"
          onMouseDown={() => {
            if (!desktopBusy) setDesktopFolderOpen(false)
          }}
        >
          <form
            className="desktop-sheet"
            onSubmit={(event) => {
              event.preventDefault()
              void handleDesktopFolder()
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <h2>Add a folder</h2>
            <p>
              Choose a folder of audio files. Deep search adds every nested album folder in one
              pass.
            </p>
            <input
              autoFocus
              value={desktopFolderAlbum}
              onChange={(event) => setDesktopFolderAlbum(event.target.value)}
              placeholder={
                desktopDeepScan ? 'Override all album names (optional)' : 'Album name (optional)'
              }
              aria-label="Album name for folder import"
              disabled={Boolean(desktopBusy)}
            />
            <label className="desktop-sheet-check">
              <input
                type="checkbox"
                checked={desktopDeepScan}
                onChange={(event) => setDesktopDeepScan(event.target.checked)}
                disabled={Boolean(desktopBusy)}
              />
              <span>Deep search all subfolders</span>
            </label>
            <p className="desktop-sheet-hint">
              {desktopDeepScan
                ? desktopFolderAlbum.trim()
                  ? 'Album override on: every untagged file will be merged into one album. Leave it blank to add each folder as its own album.'
                  : 'Each subfolder with audio becomes its own album. Large libraries are scanned in one pass.'
                : desktopFolderAlbum.trim()
                  ? `Only files directly inside this folder are added; untagged files use “${desktopFolderAlbum.trim()}”.`
                  : 'Only files directly inside this folder are added; untagged files use the folder name.'}
            </p>
            {desktopBusy && (
              <p className="desktop-sheet-progress" role="status">
                {desktopBusy}
              </p>
            )}
            <div className="desktop-sheet-actions">
              <button
                type="button"
                onClick={() => setDesktopFolderOpen(false)}
                disabled={Boolean(desktopBusy)}
              >
                Cancel
              </button>
              <button type="submit" disabled={Boolean(desktopBusy)}>
                {desktopBusy ? 'Scanning…' : 'Choose Folder…'}
              </button>
            </div>
          </form>
        </div>
      )}

      {isDragging && (
        <div className="drop-overlay" role="status">
          <div className="drop-overlay-card">
            <UploadIcon className="drop-icon" />
            <strong>Drop your music</strong>
            <span>MP3, M4A, FLAC, WAV, OGG, and more</span>
          </div>
        </div>
      )}

      {isDesktop && <WindowResizeHandles />}
    </div>
  )
}
