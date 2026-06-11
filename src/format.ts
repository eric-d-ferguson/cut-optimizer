import type { Unit } from './types'

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b)
}

// Render a decimal as a mixed fraction to the nearest 1/denom (e.g. 47.5 -> "47 1/2")
export function toFraction(value: number, denom = 16): string {
  const negative = value < 0
  const abs = Math.abs(value)
  let whole = Math.floor(abs)
  let numer = Math.round((abs - whole) * denom)

  if (numer === denom) { whole += 1; numer = 0 }  // rounded up to next whole

  let str: string
  if (numer === 0) {
    str = `${whole}`
  } else {
    const g = gcd(numer, denom)
    const frac = `${numer / g}/${denom / g}`
    str = whole === 0 ? frac : `${whole} ${frac}`
  }
  return negative ? `-${str}` : str
}

// Format an internal inch measurement for display in the given unit, as a fraction
export function fromInches(inches: number, unit: Unit): string {
  const symbol = unit === 'ft' ? "'" : '"'
  const value = unit === 'ft' ? inches / 12 : inches
  return `${toFraction(value)}${symbol}`
}
