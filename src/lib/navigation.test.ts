import { describe, expect, it } from 'vitest'
import { clampIndex, getVisibleRange, stepIndex } from './navigation'

describe('stepIndex', () => {
  it('wraps in both directions', () => {
    expect(stepIndex(0, -1, 5)).toBe(4)
    expect(stepIndex(4, 1, 5)).toBe(0)
    expect(stepIndex(2, 3, 5)).toBe(0)
  })

  it('handles empty lists', () => {
    expect(stepIndex(3, 1, 0)).toBe(0)
  })
})

describe('clampIndex', () => {
  it('keeps the selection inside the list', () => {
    expect(clampIndex(-2, 4)).toBe(0)
    expect(clampIndex(9, 4)).toBe(3)
    expect(clampIndex(0, 0)).toBe(0)
  })
})

describe('getVisibleRange', () => {
  it('shows the first page for an early selection', () => {
    expect(getVisibleRange(0, 20, 6)).toEqual({ start: 0, end: 6 })
    expect(getVisibleRange(5, 20, 6)).toEqual({ start: 0, end: 6 })
  })

  it('scrolls the window to keep the selection visible', () => {
    expect(getVisibleRange(6, 20, 6)).toEqual({ start: 1, end: 7 })
    expect(getVisibleRange(19, 20, 6)).toEqual({ start: 14, end: 20 })
  })

  it('shrinks for short lists', () => {
    expect(getVisibleRange(1, 3, 6)).toEqual({ start: 0, end: 3 })
    expect(getVisibleRange(0, 0, 6)).toEqual({ start: 0, end: 0 })
  })
})
