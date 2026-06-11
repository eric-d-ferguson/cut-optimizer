import { describe, it, expect } from 'vitest'
import { optimize } from './optimizer'
import type { StockPiece, DesiredCut } from './types'

function sheet(width: number, length: number, quantity = 1): StockPiece {
  return { id: 's', label: 'Sheet', type: 'sheet', width, length, quantity, unit: 'in' }
}

function cut(width: number, length: number, quantity = 1, label = 'Cut'): DesiredCut {
  return { id: 'c', label, width, length, quantity, unit: 'in' }
}

describe('optimize', () => {
  it('tiles four 24x48 panels onto a 4x8 sheet with zero waste', () => {
    // A 4x8 sheet is 48" x 96". Four 24x48 panels fit exactly (2 across, 2 down).
    const result = optimize([sheet(48, 96)], [cut(24, 48, 4, 'Panel')], 0)

    expect(result.plans).toHaveLength(1)
    expect(result.unplacedCuts).toHaveLength(0)

    const plan = result.plans[0]
    expect(plan.wastePercent).toBe(0)
    expect(plan.placements).toHaveLength(4)

    // Exact, deterministic layout (no kerf)
    const coords = plan.placements.map(p => ({ x: p.x, y: p.y, rotated: p.rotated }))
    expect(coords).toEqual([
      { x: 0,  y: 0,  rotated: false },
      { x: 24, y: 0,  rotated: false },
      { x: 0,  y: 48, rotated: false },
      { x: 24, y: 48, rotated: false },
    ])
  })

  it('accounts for blade kerf so pieces still fit', () => {
    // With a 1/8" kerf, four 24x48 panels can no longer all fit on one 48x96 sheet.
    const result = optimize([sheet(48, 96)], [cut(24, 48, 4, 'Panel')], 0.125)
    const placed = result.plans.reduce((n, p) => n + p.placements.length, 0)
    // All four still get placed, but they require a second sheet...
    // With only one sheet, some are left unplaced.
    expect(placed + result.unplacedCuts.length).toBe(4)
    expect(result.unplacedCuts.length).toBeGreaterThan(0)
  })

  it('uses a second sheet when one is not enough', () => {
    // Each 40x90 piece nearly fills a sheet, so two pieces need two sheets.
    const result = optimize([sheet(48, 96, 2)], [cut(40, 90, 2, 'Big Panel')], 0.125)
    const placed = result.plans.reduce((n, p) => n + p.placements.length, 0)
    expect(placed).toBe(2)
    expect(result.plans).toHaveLength(2)
    expect(result.unplacedCuts).toHaveLength(0)
  })

  it('reports cuts that are too large to ever fit', () => {
    const result = optimize([sheet(48, 96)], [cut(50, 50, 1, 'Too Big')], 0)
    expect(result.plans).toHaveLength(0)
    expect(result.unplacedCuts).toHaveLength(1)
    expect(result.unplacedCuts[0].label).toBe('Too Big')
  })

  it('rotates a piece when it only fits the other way', () => {
    // A 96x10 piece cannot fit a 48x96 sheet as-is (96 > 48 wide),
    // but fits rotated (10 wide x 96 long).
    const result = optimize([sheet(48, 96)], [cut(96, 10, 1, 'Long Strip')], 0)
    expect(result.unplacedCuts).toHaveLength(0)
    expect(result.plans[0].placements[0].rotated).toBe(true)
  })

  it('places larger cuts first', () => {
    const result = optimize([sheet(48, 96)], [
      cut(10, 10, 1, 'Small'),
      cut(40, 40, 1, 'Large'),
    ], 0)
    expect(result.plans[0].placements[0].cut.label).toBe('Large')
  })

  it('returns no plans when there is no stock', () => {
    const result = optimize([], [cut(10, 10, 1)], 0)
    expect(result.plans).toHaveLength(0)
    expect(result.unplacedCuts).toHaveLength(1)
  })
})
