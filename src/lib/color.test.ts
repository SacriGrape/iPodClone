import { describe, expect, it } from 'vitest'
import {
  BACKLIGHT_COLOR_PRESETS,
  DEFAULT_BACKLIGHT_COLOR,
  adjustBacklightChannel,
  backlightColorLabel,
  hexToRgb,
  isHexColor,
  normalizeHexColor,
  rgbToHex,
} from './color'

describe('backlight colors', () => {
  it('accepts only six-digit hex colors', () => {
    expect(isHexColor('#A1B2C3')).toBe(true)
    expect(isHexColor('#abc')).toBe(false)
    expect(isHexColor('a1b2c3')).toBe(false)
    expect(isHexColor(123)).toBe(false)
  })

  it('normalizes hex colors to lowercase', () => {
    expect(normalizeHexColor('#A1B2C3')).toBe('#a1b2c3')
    expect(normalizeHexColor('nope')).toBeNull()
  })

  it('round-trips rgb values', () => {
    expect(hexToRgb('#1e90ff')).toEqual({ r: 30, g: 144, b: 255 })
    expect(rgbToHex({ r: 30, g: 144, b: 255 })).toBe('#1e90ff')
  })

  it('clamps channel adjustments', () => {
    expect(adjustBacklightChannel('#0a141e', 'r', -20)).toBe('#00141e')
    expect(adjustBacklightChannel('#f0e6dc', 'b', 40)).toBe('#f0e6ff')
    expect(adjustBacklightChannel('#808080', 'g', 7)).toBe('#808780')
  })

  it('falls back to the default for invalid input', () => {
    expect(hexToRgb('bad')).toEqual(hexToRgb(DEFAULT_BACKLIGHT_COLOR))
  })

  it('labels presets and custom colors', () => {
    expect(backlightColorLabel('#DCEEFF')).toBe('Ice')
    expect(backlightColorLabel('#123456')).toBe('Custom')
    expect(backlightColorLabel(BACKLIGHT_COLOR_PRESETS[3].color)).toBe('Aqua')
  })
})
