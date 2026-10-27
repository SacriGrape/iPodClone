export function getNextPosition(
  position: number,
  length: number,
  repeatAll: boolean,
): number | null {
  if (length <= 0) return null
  const next = position + 1
  if (next < length) return next
  return repeatAll ? 0 : null
}

export function getPreviousPosition(
  position: number,
  length: number,
  repeatAll: boolean,
): number | null {
  if (length <= 0) return null
  const previous = position - 1
  if (previous >= 0) return previous
  return repeatAll ? length - 1 : null
}

export function buildShuffleOrder(
  length: number,
  startIndex: number,
  random: () => number = Math.random,
): number[] {
  if (length <= 0) return []

  const start = Math.min(Math.max(0, startIndex), length - 1)
  const rest = Array.from({ length }, (_, index) => index).filter((index) => index !== start)

  for (let index = rest.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1))
    const value = rest[index]
    rest[index] = rest[swapWith]
    rest[swapWith] = value
  }

  return [start, ...rest]
}
