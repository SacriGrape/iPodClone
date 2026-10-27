import { describe, expect, it } from 'vitest'
import { isAudioFile, parseFileName } from './metadata'

describe('parseFileName', () => {
  it('splits an Artist - Title filename', () => {
    expect(parseFileName('Criterion Games - Burnout Paradise Theme.opus')).toEqual({
      artist: 'Criterion Games',
      title: 'Burnout Paradise Theme',
    })
  })

  it('keeps extra separators in the title', () => {
    expect(
      parseFileName('Antonio Vivaldi - The Four Seasons, Spring - 1st Movement.opus'),
    ).toEqual({
      artist: 'Antonio Vivaldi',
      title: 'The Four Seasons, Spring - 1st Movement',
    })
  })

  it('falls back to the filename as the title', () => {
    expect(parseFileName('Archers.opus')).toEqual({
      artist: 'Unknown Artist',
      title: 'Archers',
    })
    expect(parseFileName('Route 66 (Beatmasters Mix).opus')).toEqual({
      artist: 'Unknown Artist',
      title: 'Route 66 (Beatmasters Mix)',
    })
  })
})

describe('isAudioFile', () => {
  it('accepts audio extensions and MIME types', () => {
    expect(isAudioFile(new File([new Uint8Array(1)], 'Archers.opus', { type: 'audio/opus' }))).toBe(true)
    expect(isAudioFile(new File([new Uint8Array(1)], 'track.ogg', { type: '' }))).toBe(true)
  })

  it('rejects video files even when the container is WebM', () => {
    expect(
      isAudioFile(new File([new Uint8Array(1)], 'Minecraft.webm', { type: 'video/webm' })),
    ).toBe(false)
  })
})
