import { useCallback, useEffect, useRef, useState } from 'react'
import type { Track } from '../types'
import { clearTracks, loadTracks, removeTrack, saveTracks } from '../lib/db'
import { formatCount } from '../lib/format'
import { sortTracks } from '../lib/library'
import { fileToTrack, isAudioFile, isProtectedAudioFile, trackKey } from '../lib/metadata'
import { applyTrackMetadata } from '../lib/trackMetadata'

export interface Library {
  tracks: Track[]
  loading: boolean
  importing: number
  notice: string | null
  error: string | null
  importFiles: (files: File[], options?: { fallbackAlbum?: string }) => Promise<void>
  addTracks: (tracks: Track[]) => Promise<void>
  removeTrack: (id: string) => Promise<void>
  clearLibrary: () => Promise<void>
  dismissNotice: () => void
}

export function useLibrary(): Library {
  const [tracks, setTracks] = useState<Track[]>([])
  const [loading, setLoading] = useState(true)
  const [importing, setImporting] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const tracksRef = useRef<Track[]>([])

  useEffect(() => {
    let cancelled = false

    loadTracks()
      .then((storedTracks) => {
        if (cancelled) return

        const corrected = storedTracks.map(applyTrackMetadata)
        const changed = corrected.filter((track, index) => track !== storedTracks[index])
        const sorted = sortTracks(corrected)
        tracksRef.current = sorted
        setTracks(sorted)

        if (changed.length > 0) {
          saveTracks(changed).catch(() => {
            if (!cancelled) {
              setError(
                'Artist metadata was updated for this session, but could not be saved. It will be reapplied next time.',
              )
            }
          })
        }
      })
      .catch(() => {
        if (cancelled) return
        setError('The saved library could not be opened. New imports will still work for this session.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!notice) return

    const timeout = window.setTimeout(() => setNotice(null), 7000)
    return () => window.clearTimeout(timeout)
  }, [notice])

  const importFiles = useCallback(async (files: File[], options: { fallbackAlbum?: string } = {}) => {
    if (files.length === 0) return

    const protectedFiles = files.filter(isProtectedAudioFile)
    const supported = files.filter((file) => !isProtectedAudioFile(file) && isAudioFile(file))
    const unsupported = files.length - supported.length - protectedFiles.length
    const existingKeys = new Set(tracksRef.current.map((track) => track.sourceKey))
    const seenKeys = new Set<string>()
    const unique: File[] = []

    for (const file of supported) {
      const key = trackKey(file)
      if (existingKeys.has(key) || seenKeys.has(key)) continue
      seenKeys.add(key)
      unique.push(file)
    }

    const duplicateCount = supported.length - unique.length

    if (unique.length === 0) {
      const reasons: string[] = []
      if (duplicateCount) reasons.push(`${formatCount(duplicateCount, 'duplicate')} already in the library`)
      if (protectedFiles.length) reasons.push(`${formatCount(protectedFiles.length, 'protected Apple Music file')} cannot be played`)
      if (unsupported) reasons.push(`${formatCount(unsupported, 'unsupported file')} skipped`)
      setNotice(reasons.length ? `Nothing added: ${reasons.join('; ')}.` : 'No audio files were found.')
      return
    }

    setImporting(unique.length)
    setError(null)

    const added: Track[] = []
    let failed = 0
    let cursor = 0
    const workerCount = Math.min(4, unique.length)

    const workers = Array.from({ length: workerCount }, async () => {
      while (cursor < unique.length) {
        const file = unique[cursor]
        cursor += 1

        try {
          added.push(applyTrackMetadata(await fileToTrack(file, options)))
        } catch {
          failed += 1
        } finally {
          setImporting((count) => Math.max(0, count - 1))
        }
      }
    })

    await Promise.all(workers)

    if (added.length > 0) {
      const nextTracks = sortTracks([...tracksRef.current, ...added])
      tracksRef.current = nextTracks
      setTracks(nextTracks)

      try {
        await saveTracks(added)
      } catch {
        setError('Tracks are available now, but could not be saved for the next visit.')
      }
    }

    const parts: string[] = []
    if (added.length) {
      const albumCount = new Set(added.map((track) => track.album)).size
      parts.push(
        `Added ${formatCount(added.length, 'track')}${albumCount > 1 ? ` across ${formatCount(albumCount, 'album')}` : ''}.`,
      )
    }
    if (duplicateCount) parts.push(`Skipped ${formatCount(duplicateCount, 'duplicate')}.`)
    if (protectedFiles.length) {
      parts.push(`Skipped ${formatCount(protectedFiles.length, 'protected Apple Music file')}.`)
    }
    if (unsupported) parts.push(`Skipped ${formatCount(unsupported, 'unsupported file')}.`)
    if (failed) parts.push(`${formatCount(failed, 'file')} could not be read.`)
    setNotice(parts.join(' '))
  }, [])

  const addTracks = useCallback(async (incoming: Track[]) => {
    if (incoming.length === 0) return

    const seen = new Set(tracksRef.current.map((track) => track.sourceKey))
    const unique: Track[] = []

    for (const incomingTrack of incoming) {
      const track = applyTrackMetadata(incomingTrack)
      if (seen.has(track.sourceKey)) continue
      seen.add(track.sourceKey)
      unique.push(track)
    }

    if (unique.length === 0) {
      setNotice('Those files are already in your library.')
      return
    }

    const nextTracks = sortTracks([...tracksRef.current, ...unique])
    tracksRef.current = nextTracks
    setTracks(nextTracks)

    const albumCount = new Set(unique.map((track) => track.album)).size

    try {
      await saveTracks(unique)
    } catch {
      setError('Tracks are available now, but could not be saved for the next visit.')
    }

    setNotice(
      `Added ${formatCount(unique.length, 'track')}${albumCount > 1 ? ` across ${formatCount(albumCount, 'album')}` : ''}.`,
    )
  }, [])

  const removeTrackById = useCallback(async (id: string) => {
    const nextTracks = tracksRef.current.filter((track) => track.id !== id)
    tracksRef.current = nextTracks
    setTracks(nextTracks)

    try {
      await removeTrack(id)
    } catch {
      setError('The track was removed from this session, but the library database could not be updated.')
    }
  }, [])

  const clearLibrary = useCallback(async () => {
    tracksRef.current = []
    setTracks([])

    try {
      await clearTracks()
    } catch {
      setError('The library was cleared for this session, but the database could not be updated.')
    }
  }, [])

  const dismissNotice = useCallback(() => setNotice(null), [])

  return {
    tracks,
    loading,
    importing,
    notice,
    error,
    importFiles,
    addTracks,
    removeTrack: removeTrackById,
    clearLibrary,
    dismissNotice,
  }
}
