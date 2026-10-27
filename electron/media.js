import { randomUUID } from 'node:crypto'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { parseFile } from 'music-metadata'

export const AUDIO_EXTENSIONS = new Set([
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

const MIME_BY_EXTENSION = {
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
  opus: 'audio/ogg',
  wav: 'audio/wav',
  wave: 'audio/wav',
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function extensionOf(filePath) {
  return path.extname(filePath).slice(1).toLowerCase()
}

export function isAudioPath(filePath) {
  return AUDIO_EXTENSIONS.has(extensionOf(filePath))
}

export function mimeForPath(filePath) {
  return MIME_BY_EXTENSION[extensionOf(filePath)] ?? 'application/octet-stream'
}

export function parseFileName(name) {
  const baseName = name.replace(/\.[^.]+$/, '') || name
  const separator = baseName.indexOf(' - ')

  if (separator > 0) {
    const artist = baseName.slice(0, separator).trim()
    const title = baseName.slice(separator + 3).trim()
    if (artist && title) return { title, artist }
  }

  return { title: baseName, artist: 'Unknown Artist' }
}

export function mediaUrlForPath(filePath) {
  return `ipod://app/media/${Buffer.from(filePath, 'utf8').toString('base64url')}`
}

export function pathFromMediaToken(token) {
  return Buffer.from(token, 'base64url').toString('utf8')
}

async function collectAudioFiles(directory, output) {
  const entries = await fs.readdir(directory, { withFileTypes: true })

  for (const entry of entries) {
    if (entry.name.startsWith('.')) continue

    const fullPath = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      await collectAudioFiles(fullPath, output)
    } else if (entry.isFile() && isAudioPath(fullPath)) {
      output.push(fullPath)
    }
  }
}

async function buildTrack(filePath, fallbackAlbum) {
  const stats = await fs.stat(filePath)
  const fileName = path.basename(filePath)
  const filename = parseFileName(fileName)
  const parentFolder = path.basename(path.dirname(filePath))
  const albumFallback = cleanText(fallbackAlbum) ?? parentFolder

  let title = filename.title
  let artist = filename.artist
  let album = albumFallback
  let duration = 0
  let trackNumber
  let discNumber

  try {
    const metadata = await parseFile(filePath, { duration: true, skipCovers: true })
    title = cleanText(metadata.common.title) ?? title
    artist =
      cleanText(metadata.common.artist) ??
      cleanText(metadata.common.albumartist) ??
      artist
    album = cleanText(metadata.common.album) ?? albumFallback
    duration = metadata.format.duration ?? 0
    trackNumber = metadata.common.track?.no ?? undefined
    discNumber = metadata.common.disk?.no ?? undefined
  } catch {
    // Keep filename/duration fallbacks so one bad file cannot fail a whole folder.
  }

  return {
    id: randomUUID(),
    sourceKey: `file:${filePath}:${stats.size}:${stats.mtimeMs}`,
    title,
    artist,
    album,
    duration,
    trackNumber,
    discNumber,
    fileName,
    mimeType: mimeForPath(filePath),
    size: stats.size,
    addedAt: Date.now(),
    sourceUrl: mediaUrlForPath(filePath),
  }
}

export async function importAudioFiles(filePaths, { fallbackAlbum } = {}) {
  const tracks = []
  let cursor = 0

  const workers = Array.from(
    { length: Math.min(4, Math.max(1, filePaths.length)) },
    async () => {
      while (cursor < filePaths.length) {
        const filePath = filePaths[cursor]
        cursor += 1
        try {
          tracks.push(await buildTrack(filePath, fallbackAlbum))
        } catch {
          // Skip unreadable files; the renderer still gets the rest of the import.
        }
      }
    },
  )

  await Promise.all(workers)

  return tracks.sort(
    (left, right) =>
      collator.compare(left.title, right.title) || collator.compare(left.artist, right.artist),
  )
}

export async function importAudioFolder(root, { fallbackAlbum } = {}) {
  const resolvedRoot = path.resolve(root)
  const files = []
  await collectAudioFiles(resolvedRoot, files)

  const folderName = path.basename(resolvedRoot)
  const tracks = await importAudioFiles(files, {
    fallbackAlbum: cleanText(fallbackAlbum) ?? folderName,
  })

  return { folderName, tracks }
}

function cleanText(value) {
  const trimmed = typeof value === 'string' ? value.trim() : ''
  return trimmed || undefined
}
