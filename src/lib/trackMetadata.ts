import type { Track } from '../types'

const UNKNOWN_ARTIST = 'unknown artist'

// The Burnout Paradise folder is intentionally untagged. These are the
// soundtrack artists for the titles that would otherwise display as
// "Unknown Artist"; known artists are never overwritten.
const BURNOUT_ARTIST_BY_TITLE: Record<string, string> = {
  'Archers': 'Brand New',
  'The Archers Bows Have Broken': 'Brand New',
  'Beautiful Ruin': 'Make Good Your Escape',
  'Block out the World': 'Maxeen',
  'Block Out the World': 'Maxeen',
  'Calling All Cars': 'Senses Fail',
  'Collapse': 'Saosin',
  'Coming Down To Beijing': 'Brain Failure feat. Dicky Barrett',
  'Coming Down to Beijing': 'Brain Failure feat. Dicky Barrett',
  'Credits Music': 'Criterion Games',
  'Creepshow': 'Kerli',
  'Dead Living': 'Sugarcult',
  'Duel': 'Swervedriver',
  'Electable (Give It Up)': 'Jimmy Eat World',
  'Epic': 'Faith No More',
  'Fake It': 'Seether',
  'Fight Music for the Fight': 'Bromheads Jacket',
  'Finger on the Trigger': 'Never Heard of It',
  'Fire Away': 'Jupiter One',
  'Girlfriend': 'Avril Lavigne',
  'Going Through Changes': 'Army of Me',
  'Heart Of Fire': 'Innerpartysystem',
  'I Wanna Rock': 'Twisted Sister',
  "I'm Not Sorry": 'The Pigeon Detectives',
  'It Goes Off': 'Skybombers',
  'My Curse': 'Killswitch Engage',
  'Nothing to Lose': 'Operator',
  'Paradise City': "Guns N' Roses",
  'Red Orange Yellow': 'The Photo Atlas',
  'Rock Star': 'N.E.R.D.',
  'Rock Star (Jason Nevins Mix)': 'N.E.R.D.',
  'Route 66': 'Depeche Mode',
  'Route 66 (Beatmasters Mix)': 'Depeche Mode',
  'Rusty Cage': 'Soundgarden',
  'Sleeping Beauty Ballet Suite - Waltz': 'Pyotr Ilyich Tchaikovsky',
  'Snowhill': 'Agent Blue',
  'Stand and Deliver': 'Adam and the Ants',
  'Stop': "Jane's Addiction",
  'Stop!': "Jane's Addiction",
  'The Sleeping Beauty, Ballet Suite, op. 66a： Waltz': 'Pyotr Ilyich Tchaikovsky',
  'Too Much, Too Young, Too Fast': 'Airbourne',
  'Until You Leave': 'Permanent Me',
  'Us V Them': 'LCD Soundsystem',
  'Would？': 'Alice in Chains',
  'Would?': 'Alice in Chains',
}

const BURNOUT_ARTIST_LOOKUP = new Map(
  Object.entries(BURNOUT_ARTIST_BY_TITLE).map(([title, artist]) => [
    normalizeMetadataTitle(title),
    artist,
  ]),
)

export function normalizeMetadataTitle(title: string): string {
  return title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function isMissingArtist(artist: string): boolean {
  return !artist.trim() || artist.trim().toLowerCase() === UNKNOWN_ARTIST
}

function isBurnoutTrack(track: Track): boolean {
  const sourceKey = track.sourceKey.toLowerCase()
  return (
    track.album.trim().toLowerCase() === 'burnout paradise' ||
    sourceKey.includes('/ytdownloader/') ||
    sourceKey.includes('ytdownloader/')
  )
}

export function applyTrackMetadata(track: Track): Track {
  if (!isMissingArtist(track.artist) || !isBurnoutTrack(track)) return track

  const artist = BURNOUT_ARTIST_LOOKUP.get(normalizeMetadataTitle(track.title))
  return artist ? { ...track, artist } : track
}
