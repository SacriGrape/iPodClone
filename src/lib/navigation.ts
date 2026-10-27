export function clampIndex(index: number, length: number): number {
  if (length <= 0) return 0
  return Math.min(Math.max(0, index), length - 1)
}

export function stepIndex(index: number, delta: number, length: number): number {
  if (length <= 0) return 0
  return ((index + delta) % length + length) % length
}

export function getVisibleRange(
  selected: number,
  length: number,
  visibleRows: number,
): { start: number; end: number } {
  if (length <= 0 || visibleRows <= 0) return { start: 0, end: 0 }

  const count = Math.min(visibleRows, length)
  const clamped = clampIndex(selected, length)
  const start = Math.min(Math.max(0, clamped - count + 1), length - count)

  return { start, end: start + count }
}
