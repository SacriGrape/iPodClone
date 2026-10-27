import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_WHEEL_STEP,
  MAX_WHEEL_STEP,
  MIN_WHEEL_STEP,
  SETTINGS_KEY,
  clampWheelStep,
  defaultSettings,
  loadSettings,
} from './settings'

function stubSettings(raw: string | null) {
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => (key === SETTINGS_KEY ? raw : null),
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('wheel calibration', () => {
  it('defaults to a reasonable notch size', () => {
    expect(defaultSettings().wheelStep).toBe(DEFAULT_WHEEL_STEP)
  })

  it('defaults the side buttons to back and next', () => {
    const settings = defaultSettings()
    expect(settings.mouseSide1).toBe('back')
    expect(settings.mouseSide2).toBe('next')
  })

  it('clamps and rounds measured step sizes', () => {
    expect(clampWheelStep(0)).toBe(MIN_WHEEL_STEP)
    expect(clampWheelStep(4)).toBe(4)
    expect(clampWheelStep(9.6)).toBe(10)
    expect(clampWheelStep(1000)).toBe(MAX_WHEEL_STEP)
  })

  it('migrates the old sensitivity setting', () => {
    stubSettings(JSON.stringify({ wheelSensitivity: 'very-high' }))
    expect(loadSettings().wheelStep).toBe(24)
  })

  it('clamps a stored calibration', () => {
    stubSettings(JSON.stringify({ wheelStep: 1000 }))
    expect(loadSettings().wheelStep).toBe(MAX_WHEEL_STEP)
  })

  it('loads persisted side-button mappings', () => {
    stubSettings(JSON.stringify({ mouseSide1: 'previous', mouseSide2: 'none' }))
    const settings = loadSettings()
    expect(settings.mouseSide1).toBe('previous')
    expect(settings.mouseSide2).toBe('none')
  })
})
