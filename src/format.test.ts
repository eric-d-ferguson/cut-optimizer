import { describe, it, expect } from 'vitest'
import { toFraction, fromInches } from './format'

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
