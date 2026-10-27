export interface RgbColor {
  r: number
  g: number
  b: number
}

export type ColorChannel = 'r' | 'g' | 'b'

export interface BacklightColorPreset {
  color: string
  label: string
}

export const DEFAULT_BACKLIGHT_COLOR = '#dceeff'

export const BACKLIGHT_COLOR_PRESETS: BacklightColorPreset[] = [
  { color: '#dceeff', label: 'Ice' },
  { color: '#fff2dc', label: 'Warm' },
  { color: '#ffffff', label: 'Mono' },
  { color: '#8ff0e6', label: 'Aqua' },
  { color: '#a5f0a5', label: 'Green' },
  { color: '#ffd18a', label: 'Amber' },
  { color: '#ffb3cf', label: 'Rose' },
  { color: '#cdb5ff', label: 'Violet' },
  { color: '#ff9e9e', label: 'Red' },
]

const HEX_COLOR = /^#[0-9a-f]{6}$/i

function clampChannel(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

export function isHexColor(value: unknown): value is string {
  return typeof value === 'string' && HEX_COLOR.test(value)
}

export function normalizeHexColor(value: string): string | null {
  return isHexColor(value) ? value.toLowerCase() : null
}

export function hexToRgb(hex: string): RgbColor {
  const safe = isHexColor(hex) ? hex : DEFAULT_BACKLIGHT_COLOR
  return {
    r: Number.parseInt(safe.slice(1, 3), 16),
    g: Number.parseInt(safe.slice(3, 5), 16),
    b: Number.parseInt(safe.slice(5, 7), 16),
  }
}

export function rgbToHex({ r, g, b }: RgbColor): string {
  const channel = (value: number) => clampChannel(value).toString(16).padStart(2, '0')
  return `#${channel(r)}${channel(g)}${channel(b)}`
}

export function adjustBacklightChannel(
  hex: string,
  channel: ColorChannel,
  delta: number,
): string {
  const rgb = hexToRgb(hex)
  rgb[channel] = clampChannel(rgb[channel] + delta)
  return rgbToHex(rgb)
}

export function backlightColorLabel(hex: string): string {
  const normalized = hex.toLowerCase()
  return (
    BACKLIGHT_COLOR_PRESETS.find((preset) => preset.color === normalized)?.label ?? 'Custom'
  )
}
