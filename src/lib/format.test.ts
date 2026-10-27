import { describe, expect, it } from 'vitest'
import { formatBytes, formatCount, formatDuration, formatLongDuration } from './format'

describe('formatDuration', () => {
  it('formats minutes and hours', () => {
    expect(formatDuration(0)).toBe('0:00')
    expect(formatDuration(65)).toBe('1:05')
    expect(formatDuration(3665)).toBe('1:01:05')
  })

  it('guards invalid values', () => {
    expect(formatDuration(Number.NaN)).toBe('0:00')
    expect(formatDuration(-1)).toBe('0:00')
  })
})

describe('formatLongDuration', () => {
  it('formats library durations', () => {
    expect(formatLongDuration(0)).toBe('0 min')
    expect(formatLongDuration(30)).toBe('<1 min')
    expect(formatLongDuration(65 * 60)).toBe('1 hr 5 min')
    expect(formatLongDuration(120 * 60)).toBe('2 hr')
  })
})

describe('formatBytes', () => {
  it('formats small and large libraries', () => {
    expect(formatBytes(0)).toBe('0 MB')
    expect(formatBytes(1024)).toBe('1 KB')
    expect(formatBytes(5 * 1024 * 1024)).toBe('5.0 MB')
    expect(formatBytes(2 * 1024 * 1024 * 1024)).toBe('2.0 GB')
  })
})

describe('formatCount', () => {
  it('uses singular and plural forms', () => {
    expect(formatCount(1, 'track')).toBe('1 track')
    expect(formatCount(2, 'track')).toBe('2 tracks')
    expect(formatCount(2, 'duplicate')).toBe('2 duplicates')
  })
})
