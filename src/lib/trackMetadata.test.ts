import { describe, expect, it } from 'vitest'
import type { Track } from '../types'
import { applyTrackMetadata, normalizeMetadataTitle } from './trackMetadata'

function makeTrack(overrides: Partial<Track> = {}): Track {
  return {
    id: 'track-1',
    sourceKey: 'file:/Volumes/External/YTDownloader/Archers.opus:1:1',
    title: 'Archers',
    artist: 'Unknown Artist',
    album: 'Burnout Paradise',
    duration: 254,
    fileName: 'Archers.opus',
    mimeType: 'audio/ogg',
    size: 1024,
    addedAt: 1,
    ...overrides,
  }
}

describe('normalizeMetadataTitle', () => {
  it('matches punctuation and full-width variants', () => {
    expect(normalizeMetadataTitle('Would？')).toBe('would')
    expect(normalizeMetadataTitle('Would?')).toBe('would')
    expect(normalizeMetadataTitle("I'm Not Sorry")).toBe('i m not sorry')
    expect(normalizeMetadataTitle('The Sleeping Beauty, Ballet Suite, op. 66a： Waltz')).toBe(
      'the sleeping beauty ballet suite op 66a waltz',
    )
  })
})

describe('applyTrackMetadata', () => {
  it('fills the artist for a Burnout filename that has no tag', () => {
    expect(applyTrackMetadata(makeTrack()).artist).toBe('Brand New')
  })

  it('matches the full-width Would? title', () => {
    const track = makeTrack({ title: 'Would？', fileName: 'Would？.opus' })
    expect(applyTrackMetadata(track).artist).toBe('Alice in Chains')
  })

  it('fills the classical track that has no composer prefix', () => {
    const track = makeTrack({
      title: 'The Sleeping Beauty, Ballet Suite, op. 66a： Waltz',
      artist: 'Unknown Artist',
      fileName: 'The Sleeping Beauty, Ballet Suite, op. 66a： Waltz.opus',
    })
    expect(applyTrackMetadata(track).artist).toBe('Pyotr Ilyich Tchaikovsky')
  })

  it('fills the extra credits track', () => {
    const track = makeTrack({ title: 'Credits Music', fileName: 'Credits Music.opus' })
    expect(applyTrackMetadata(track).artist).toBe('Criterion Games')
  })

  it('never overwrites an artist that is already known', () => {
    const track = makeTrack({ artist: 'Someone Else' })
    expect(applyTrackMetadata(track)).toBe(track)
  })

  it('does not touch unknown tracks outside the Burnout library', () => {
    const track = makeTrack({
      sourceKey: 'file:/Users/me/Downloads/Archers.opus:1:1',
      album: 'Downloads',
    })
    expect(applyTrackMetadata(track)).toBe(track)
  })

  it('recognizes the Burnout folder even if the album override differs', () => {
    const track = makeTrack({ album: 'Imported folder' })
    expect(applyTrackMetadata(track).artist).toBe('Brand New')
  })
})
