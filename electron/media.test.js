import { afterEach, describe, expect, it } from 'vitest'
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { collectAudioFiles, importAudioFolder } from './media.js'

const roots = []

async function makeRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'ipod-scan-'))
  roots.push(root)
  return root
}

async function touch(filePath) {
  await mkdir(path.dirname(filePath), { recursive: true })
  await writeFile(filePath, '')
}

afterEach(async () => {
  const pending = roots.splice(0)
  await Promise.all(pending.map((root) => rm(root, { recursive: true, force: true })))
})

describe('deep folder scan', () => {
  it('finds audio in every nested folder', async () => {
    const root = await makeRoot()
    await touch(path.join(root, 'Top.mp3'))
    await touch(path.join(root, 'Artist', 'Album', 'Song.flac'))
    await touch(path.join(root, 'Artist', 'Album', 'cover.jpg'))

    const result = await collectAudioFiles(root)

    expect(result.files.sort()).toEqual(
      [path.join(root, 'Top.mp3'), path.join(root, 'Artist', 'Album', 'Song.flac')].sort(),
    )
    expect(result.folders).toBe(3)
    expect(result.albumFolders).toBe(2)
    expect(result.skippedFolders).toBe(0)
  })

  it('can limit the scan to the selected folder', async () => {
    const root = await makeRoot()
    await touch(path.join(root, 'Top.mp3'))
    await touch(path.join(root, 'Album', 'Nested.mp3'))

    const result = await collectAudioFiles(root, { deep: false })

    expect(result.files).toEqual([path.join(root, 'Top.mp3')])
    expect(result.folders).toBe(1)
  })

  it('skips hidden and system folders', async () => {
    const root = await makeRoot()
    await touch(path.join(root, 'Music', 'Keep.ogg'))
    await touch(path.join(root, '.hidden', 'Nope.mp3'))
    await touch(path.join(root, 'node_modules', 'Nope.mp3'))
    await touch(path.join(root, '$RECYCLE.BIN', 'Nope.mp3'))

    const result = await collectAudioFiles(root)

    expect(result.files).toEqual([path.join(root, 'Music', 'Keep.ogg')])
  })

  it('reports progress while scanning', async () => {
    const root = await makeRoot()
    await touch(path.join(root, 'A', 'One.mp3'))
    await touch(path.join(root, 'B', 'Two.mp3'))

    const progress = []
    await collectAudioFiles(root, { onProgress: (update) => progress.push(update) })

    expect(progress.length).toBeGreaterThan(0)
    expect(progress.at(-1)).toMatchObject({ files: 2, skippedFolders: 0 })
  })

  it('uses each file folder as the album fallback when no override is set', async () => {
    const root = await makeRoot()
    await touch(path.join(root, 'Loose.mp3'))
    await touch(path.join(root, 'Artist', 'Album', 'Nested.mp3'))

    const result = await importAudioFolder(root)
    const albums = Object.fromEntries(result.tracks.map((track) => [track.title, track.album]))

    expect(result.tracks).toHaveLength(2)
    expect(result.albumFolders).toBe(2)
    expect(albums.Loose).toBe(path.basename(root))
    expect(albums.Nested).toBe('Album')
  })

  it('applies an explicit album override to untagged files', async () => {
    const root = await makeRoot()
    await touch(path.join(root, 'Artist', 'Album', 'Nested.mp3'))

    const result = await importAudioFolder(root, { fallbackAlbum: 'Mixtape' })

    expect(result.tracks[0]?.album).toBe('Mixtape')
  })

  it('honors deep=false during folder import', async () => {
    const root = await makeRoot()
    await touch(path.join(root, 'Loose.mp3'))
    await touch(path.join(root, 'Nested', 'Hidden.mp3'))

    const result = await importAudioFolder(root, { deep: false })

    expect(result.tracks.map((track) => track.title)).toEqual(['Loose'])
  })

  it('reports scanning and reading progress for folder imports', async () => {
    const root = await makeRoot()
    await touch(path.join(root, 'One.mp3'))
    await touch(path.join(root, 'Two.mp3'))

    const progress = []
    await importAudioFolder(root, { onProgress: (update) => progress.push(update) })

    expect(progress.some((update) => update.phase === 'scanning')).toBe(true)
    expect(progress.at(-1)).toMatchObject({
      phase: 'reading',
      parsed: 2,
      total: 2,
    })
  })
})
