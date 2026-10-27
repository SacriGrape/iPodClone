import type {
  BacklightMode,
  ClickerMode,
  MouseAction,
  RepeatMode,
  Settings,
} from '../types'
import { DEFAULT_BACKLIGHT_COLOR, isHexColor, normalizeHexColor } from './color'

export const SETTINGS_KEY = 'ipod-clone:settings'

export const REPEAT_OPTIONS: Array<{ value: RepeatMode; label: string }> = [
  { value: 'off', label: 'Off' },
  { value: 'one', label: 'One' },
  { value: 'all', label: 'All' },
]

export const BACKLIGHT_OPTIONS: Array<{
  value: BacklightMode
  label: string
  timeout: number | null
}> = [
  { value: 'off', label: 'Off', timeout: 0 },
  { value: '1s', label: '1 second', timeout: 1000 },
  { value: '2s', label: '2 seconds', timeout: 2000 },
  { value: '3s', label: '3 seconds', timeout: 3000 },
  { value: '5s', label: '5 seconds', timeout: 5000 },
  { value: 'always', label: 'Always On', timeout: null },
]

export const CLICKER_OPTIONS: Array<{ value: ClickerMode; label: string }> = [
  { value: 'on', label: 'On' },
  { value: 'off', label: 'Off' },
]

export const MOUSE_ACTION_OPTIONS: Array<{ value: MouseAction; label: string }> = [
  { value: 'back', label: 'Back' },
  { value: 'next', label: 'Next Track' },
  { value: 'previous', label: 'Previous Track' },
  { value: 'playPause', label: 'Play/Pause' },
  { value: 'none', label: 'None' },
]

export const DEFAULT_WHEEL_STEP = 36
export const MIN_WHEEL_STEP = 1
export const MAX_WHEEL_STEP = 240

export function clampWheelStep(value: number): number {
  return Math.min(MAX_WHEEL_STEP, Math.max(MIN_WHEEL_STEP, Math.round(value)))
}

function legacyWheelStep(value: unknown): number | null {
  switch (value) {
    case 'low':
      return 90
    case 'normal':
      return 60
    case 'high':
      return 36
    case 'very-high':
      return 24
    default:
      return null
  }
}

export function defaultSettings(): Settings {
  return {
    volume: 0.7,
    shuffle: false,
    repeat: 'off',
    backlight: 'always',
    backlightColor: DEFAULT_BACKLIGHT_COLOR,
    clicker: 'on',
    wheelStep: DEFAULT_WHEEL_STEP,
    mouseSide1: 'back',
    mouseSide2: 'next',
  }
}

export function loadSettings(): Settings {
  const fallback = defaultSettings()

  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return fallback

    const parsed = JSON.parse(raw) as Partial<Settings> & { wheelSensitivity?: unknown }
    return {
      volume:
        typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : fallback.volume,
      shuffle: typeof parsed.shuffle === 'boolean' ? parsed.shuffle : fallback.shuffle,
      repeat: isRepeatMode(parsed.repeat) ? parsed.repeat : fallback.repeat,
      backlight: isBacklightMode(parsed.backlight) ? parsed.backlight : fallback.backlight,
      backlightColor: isHexColor(parsed.backlightColor)
        ? normalizeHexColor(parsed.backlightColor) ?? fallback.backlightColor
        : fallback.backlightColor,
      clicker: isClickerMode(parsed.clicker) ? parsed.clicker : fallback.clicker,
      wheelStep:
        typeof parsed.wheelStep === 'number' && Number.isFinite(parsed.wheelStep)
          ? clampWheelStep(parsed.wheelStep)
          : legacyWheelStep(parsed.wheelSensitivity) ?? fallback.wheelStep,
      mouseSide1: isMouseAction(parsed.mouseSide1)
        ? parsed.mouseSide1
        : fallback.mouseSide1,
      mouseSide2: isMouseAction(parsed.mouseSide2)
        ? parsed.mouseSide2
        : fallback.mouseSide2,
    }
  } catch {
    return fallback
  }
}

export function saveSettings(settings: Settings): void {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    // A blocked localStorage should not make the player unusable.
  }
}

export function isRepeatMode(value: unknown): value is RepeatMode {
  return value === 'off' || value === 'one' || value === 'all'
}

export function isBacklightMode(value: unknown): value is BacklightMode {
  return (
    value === 'off' ||
    value === '1s' ||
    value === '2s' ||
    value === '3s' ||
    value === '5s' ||
    value === 'always'
  )
}

export function isClickerMode(value: unknown): value is ClickerMode {
  return value === 'on' || value === 'off'
}

export function isMouseAction(value: unknown): value is MouseAction {
  return (
    value === 'back' ||
    value === 'next' ||
    value === 'previous' ||
    value === 'playPause' ||
    value === 'none'
  )
}
