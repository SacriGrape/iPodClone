import { parseBlob } from 'music-metadata'
import type { Track } from '../types'

const AUDIO_EXTENSIONS = new Set([
  'aac',
  'aif',
  'aiff',
  'caf',
  'flac',
  'm4a',
  'm4b',
  'mp3',
  'oga',
  'ogg',
  'opus',
  'wav',
  'wave',
])

const MIME_BY_EXTENSION: Record<string, string> = {
  aac: 'audio/aac',
  aif: 'audio/aiff',
  aiff: 'audio/aiff',
  caf: 'audio/x-caf',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  m4b: 'audio/mp4',
  mp3: 'audio/mpeg',
  oga: 'audio/ogg',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
  wave: 'audio/wav',
}

export function isAudioFile(file: File): boolean {
  const extension = getExtension(file.name)
  if (file.type.startsWith('video/')) return false
  return file.type.startsWith('audio/') || AUDIO_EXTENSIONS.has(extension)
}

export function isProtectedAudioFile(file: File): boolean {
  return getExtension(file.name) === 'm4p'
}

export function trackKey(file: File): string {
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  return `${relativePath || file.name}:${file.size}:${file.lastModified}`
}

export function parseFileName(name: string): { title: string; artist: string } {
  const baseName = stripExtension(name)
  const separator = baseName.indexOf(' - ')

  if (separator > 0) {
    const artist = baseName.slice(0, separator).trim()
    const title = baseName.slice(separator + 3).trim()
    if (artist && title) return { title, artist }
  }

  return { title: baseName, artist: 'Unknown Artist' }
}

export async function fileToTrack(
  file: File,
  options: { fallbackAlbum?: string } = {},
): Promise<Track> {
  const filename = parseFileName(file.name)
  const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath
  const folderName = relativePath?.split('/').filter(Boolean)[0]
  const fallbackAlbum = cleanText(options.fallbackAlbum) ?? folderName ?? 'Unknown Album'
  let title = filename.title
  let artist = filename.artist
  let album = fallbackAlbum
  let duration = 0
  let trackNumber: number | undefined
  let discNumber: number | undefined

  try {
    const metadata = await parseBlob(file, { duration: true, skipCovers: true })
    title = cleanText(metadata.common.title) ?? title
    artist = cleanText(metadata.common.artist) ?? cleanText(metadata.common.albumartist) ?? artist
    album = cleanText(metadata.common.album) ?? fallbackAlbum
    duration = metadata.format.duration ?? 0
    trackNumber = metadata.common.track?.no ?? undefined
    discNumber = metadata.common.disk?.no ?? undefined
  } catch {
    // Filename and duration fallbacks below keep malformed tags from blocking an import.
  }

  if (!Number.isFinite(duration) || duration <= 0) {
    duration = await readDuration(file)
  }

  return {
    id: createId(),
    sourceKey: trackKey(file),
    title,
    artist,
    album,
    duration,
    trackNumber,
    discNumber,
    fileName: file.name,
    mimeType: file.type || MIME_BY_EXTENSION[getExtension(file.name)] || 'audio/mpeg',
    size: file.size,
    addedAt: Date.now(),
    blob: file,
  }
}

function readDuration(file: File): Promise<number> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const audio = new Audio()
    let settled = false

    const finish = (duration: number) => {
      if (settled) return
      settled = true
      window.clearTimeout(timeout)
      audio.removeAttribute('src')
      audio.load()
      URL.revokeObjectURL(url)
      resolve(duration)
    }

    const timeout = window.setTimeout(() => finish(0), 8000)

    audio.addEventListener(
      'loadedmetadata',
      () => {
        finish(Number.isFinite(audio.duration) ? audio.duration : 0)
      },
      { once: true },
    )
    audio.addEventListener('error', () => finish(0), { once: true })
    audio.preload = 'metadata'
    audio.src = url
  })
}

function createId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }

  return `track-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function getExtension(name: string): string {
  const parts = name.toLowerCase().split('.')
  return parts.length > 1 ? (parts.at(-1) ?? '') : ''
}

function stripExtension(name: string): string {
  return name.replace(/\.[^.]+$/, '') || name
}

function cleanText(value: string | null | undefined): string | undefined {
  const trimmed = value?.trim()
  return trimmed ? trimmed : undefined
}
