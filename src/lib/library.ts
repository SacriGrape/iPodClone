import type { Artist, Playlist, Track } from '../types'

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

export function sortTracks(tracks: Track[]): Track[] {
  return [...tracks].sort(
    (left, right) =>
      collator.compare(left.title, right.title) || collator.compare(left.artist, right.artist),
  )
}

export function sortAlbumTracks(tracks: Track[]): Track[] {
  return [...tracks].sort(
    (left, right) =>
      (left.discNumber ?? 0) - (right.discNumber ?? 0) ||
      (left.trackNumber ?? 0) - (right.trackNumber ?? 0) ||
      collator.compare(left.title, right.title),
  )
}

export function buildArtists(tracks: Track[]): Artist[] {
  const grouped = new Map<string, Track[]>()

  for (const track of tracks) {
    const artistTracks = grouped.get(track.artist)
    if (artistTracks) artistTracks.push(track)
    else grouped.set(track.artist, [track])
  }

  return [...grouped.entries()]
    .map(([name, artistTracks]) => ({ name, tracks: sortTracks(artistTracks) }))
    .sort((left, right) => collator.compare(left.name, right.name))
}

export function buildPlaylists(tracks: Track[]): Playlist[] {
  if (tracks.length === 0) return []

  const albums = new Map<string, Track[]>()
  for (const track of tracks) {
    const albumTracks = albums.get(track.album)
    if (albumTracks) albumTracks.push(track)
    else albums.set(track.album, [track])
  }

  const albumPlaylists = [...albums.entries()]
    .map(([name, albumTracks]) => ({
      id: `album:${name}`,
      name,
      tracks: sortAlbumTracks(albumTracks),
    }))
    .sort((left, right) => collator.compare(left.name, right.name))

  const recent = [...tracks]
    .sort((left, right) => right.addedAt - left.addedAt)
    .slice(0, 30)

  return [
    { id: 'all-songs', name: 'All Songs', tracks: sortTracks(tracks) },
    { id: 'recently-added', name: 'Recently Added', tracks: recent },
    ...albumPlaylists,
  ]
}

export function recentTracks(tracks: Track[], limit = 4): Track[] {
  return [...tracks].sort((left, right) => right.addedAt - left.addedAt).slice(0, limit)
}

export function totalDuration(tracks: Track[]): number {
  return tracks.reduce((total, track) => total + track.duration, 0)
}

export function totalSize(tracks: Track[]): number {
  return tracks.reduce((total, track) => total + track.size, 0)
}
