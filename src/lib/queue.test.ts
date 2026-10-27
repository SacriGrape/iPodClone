import { describe, expect, it } from 'vitest'
import { buildShuffleOrder, getNextPosition, getPreviousPosition } from './queue'

describe('getNextPosition', () => {
  it('advances and stops at the end without repeat', () => {
    expect(getNextPosition(0, 3, false)).toBe(1)
    expect(getNextPosition(2, 3, false)).toBeNull()
  })

  it('wraps with repeat-all', () => {
    expect(getNextPosition(2, 3, true)).toBe(0)
  })

  it('handles empty queues', () => {
    expect(getNextPosition(0, 0, true)).toBeNull()
  })
})

describe('getPreviousPosition', () => {
  it('moves backwards and stops at the start without repeat', () => {
    expect(getPreviousPosition(2, 3, false)).toBe(1)
    expect(getPreviousPosition(0, 3, false)).toBeNull()
  })

  it('wraps with repeat-all', () => {
    expect(getPreviousPosition(0, 3, true)).toBe(2)
  })
})

describe('buildShuffleOrder', () => {
  it('keeps the selected track first and includes every other track once', () => {
    const order = buildShuffleOrder(6, 2, () => 0)
    expect(order[0]).toBe(2)
    expect([...order].sort((left, right) => left - right)).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('handles empty and single-item queues', () => {
    expect(buildShuffleOrder(0, 0)).toEqual([])
    expect(buildShuffleOrder(1, 0, () => 0)).toEqual([0])
  })
})
