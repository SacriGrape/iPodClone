import { describe, expect, it } from 'vitest'
import type { Track } from '../types'
import { buildArtists, buildPlaylists, sortAlbumTracks, sortTracks } from './library'

function makeTrack(
  id: string,
  title: string,
  artist: string,
  album: string,
  trackNumber: number,
  addedAt: number,
): Track {
  return {
    id,
    sourceKey: id,
    title,
    artist,
    album,
    duration: 120,
    trackNumber,
    discNumber: 1,
    fileName: `${id}.mp3`,
    mimeType: 'audio/mpeg',
    size: 1024,
    addedAt,
    blob: new Blob(),
  }
}

const tracks = [
  makeTrack('b', 'Beta', 'Artist One', 'Album X', 2, 100),
  makeTrack('a', 'Alpha', 'Artist One', 'Album X', 1, 200),
  makeTrack('c', 'Gamma', 'Artist Two', 'Album Y', 1, 300),
]

describe('sortTracks', () => {
  it('sorts by title', () => {
    expect(sortTracks(tracks).map((track) => track.title)).toEqual(['Alpha', 'Beta', 'Gamma'])
  })
})

describe('sortAlbumTracks', () => {
  it('sorts by disc and track number', () => {
    expect(sortAlbumTracks(tracks.slice(0, 2)).map((track) => track.title)).toEqual([
      'Alpha',
      'Beta',
    ])
  })
})

describe('buildArtists', () => {
  it('groups tracks by artist and sorts artist names', () => {
    const artists = buildArtists(tracks)
    expect(artists.map((artist) => artist.name)).toEqual(['Artist One', 'Artist Two'])
    expect(artists[0]?.tracks.map((track) => track.title)).toEqual(['Alpha', 'Beta'])
  })
})

describe('buildPlaylists', () => {
  it('adds all-songs and recently-added before album playlists', () => {
    const playlists = buildPlaylists(tracks)
    expect(playlists.map((playlist) => playlist.name)).toEqual([
      'All Songs',
      'Recently Added',
      'Album X',
      'Album Y',
    ])
    expect(playlists[0]?.tracks.map((track) => track.title)).toEqual([
      'Alpha',
      'Beta',
      'Gamma',
    ])
    expect(playlists[3]?.tracks.map((track) => track.title)).toEqual(['Gamma'])
  })

  it('returns no playlists for an empty library', () => {
    expect(buildPlaylists([])).toEqual([])
  })
})
