import { describe, it, expect } from 'vitest'
import { toFraction, fromInches, parseMeasurement } from './format'

describe('toFraction', () => {
  it('renders whole numbers without a fraction', () => {
    expect(toFraction(48)).toBe('48')
    expect(toFraction(0)).toBe('0')
  })

  it('renders common fractions reduced', () => {
    expect(toFraction(47.5)).toBe('47 1/2')   // 8/16 -> 1/2
    expect(toFraction(0.25)).toBe('1/4')        // 4/16 -> 1/4
    expect(toFraction(11.75)).toBe('11 3/4')    // 12/16 -> 3/4
    expect(toFraction(0.0625)).toBe('1/16')     // smallest step
  })

  it('rounds to the nearest 1/16', () => {
    expect(toFraction(0.05)).toBe('1/16')       // 0.05 -> 0.0625
    expect(toFraction(2.97)).toBe('3')          // rounds up to whole, not "2 16/16"
  })

  it('handles negative values', () => {
    expect(toFraction(-1.5)).toBe('-1 1/2')
  })
})

describe('fromInches', () => {
  it('formats inches with a double-prime symbol', () => {
    expect(fromInches(47.5, 'in')).toBe('47 1/2"')
  })

  it('converts to feet with a prime symbol', () => {
    expect(fromInches(96, 'ft')).toBe("8'")     // 96" = 8'
    expect(fromInches(18, 'ft')).toBe("1 1/2'") // 18" = 1.5'
  })
})

describe('parseMeasurement', () => {
  it('reads decimals and whole numbers', () => {
    expect(parseMeasurement('22.5')).toBe(22.5)
    expect(parseMeasurement('47')).toBe(47)
    expect(parseMeasurement('  96  ')).toBe(96)
  })

  it('reads the fractions the app itself prints', () => {
    expect(parseMeasurement('22 1/2')).toBe(22.5)
    expect(parseMeasurement('22-1/2')).toBe(22.5)
    expect(parseMeasurement('1/2')).toBe(0.5)
    expect(parseMeasurement('3 1/16')).toBeCloseTo(3.0625)
    expect(parseMeasurement('7/8')).toBe(0.875)
  })

  it('round-trips its own output', () => {
    for (const v of [0.0625, 0.5, 3.5, 22.5, 47.9375, 96]) {
      expect(parseMeasurement(toFraction(v))).toBeCloseTo(v)
    }
  })

  it('tolerates unit marks, which the dropdown overrides anyway', () => {
    expect(parseMeasurement('47"')).toBe(47)
    expect(parseMeasurement("4'")).toBe(4)
    expect(parseMeasurement('22 1/2 in')).toBe(22.5)
    expect(parseMeasurement('8 ft')).toBe(8)
  })

  it('rejects anything that is not a measurement', () => {
    for (const bad of ['', '   ', 'abc', '1/0', '--', '1/2/3', '12..5', '-5', '1 2 3']) {
      expect(parseMeasurement(bad)).toBeNaN()
    }
  })
})
