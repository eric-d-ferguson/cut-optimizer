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

/**
 * Parse a measurement written the way it would be on a board: a decimal
 * ("22.5"), a whole number ("47"), a mixed fraction ("22 1/2" or "22-1/2"), or
 * a bare fraction ("1/2"). Inch and foot marks are tolerated and discarded —
 * the unit dropdown beside the field decides the unit, not the typed mark.
 * Returns NaN for anything that isn't a measurement.
 */
export function parseMeasurement(input: string): number {
  const s = input
    .replace(/["'′″]/g, '')
    .replace(/\b(inches|inch|in|feet|foot|ft)\b/gi, '')
    .trim()
  if (!s) return NaN

  const mixed = /^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)$/.exec(s)
  if (mixed) return Number(mixed[1]) + fraction(mixed[2], mixed[3])

  const frac = /^(\d+)\s*\/\s*(\d+)$/.exec(s)
  if (frac) return fraction(frac[1], frac[2])

  if (/^\d+(\.\d+)?$/.test(s)) return Number(s)

  return NaN
}

function fraction(numer: string, denom: string): number {
  const d = Number(denom)
  return d === 0 ? NaN : Number(numer) / d
}

// Format an internal inch measurement for display in the given unit, as a fraction
export function fromInches(inches: number, unit: Unit): string {
  const symbol = unit === 'ft' ? "'" : '"'
  const value = unit === 'ft' ? inches / 12 : inches
  return `${toFraction(value)}${symbol}`
}
