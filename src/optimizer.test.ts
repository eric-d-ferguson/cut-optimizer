import { describe, it, expect } from 'vitest'
import { optimize } from './optimizer'
import type { StockPiece, DesiredCut } from './types'

function sheet(width: number, length: number, quantity = 1): StockPiece {
  return { id: 's', label: 'Sheet', type: 'sheet', width, length, quantity, unit: 'in' }
}

// A 2x4 is 1.5" x 3.5" actual; only the 3.5" face matters for layout.
function twoByFour(lengthInches: number, quantity = 1): StockPiece {
  return { id: 's', label: '2x4', type: 'dimensional', width: 3.5, length: lengthInches, quantity, unit: 'in' }
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
    // Ripping a 48"-wide sheet at 24" leaves only 23 7/8" on the far side, so a
    // second 24"-wide panel no longer fits beside the first. Two of the four
    // panels fit on one sheet; the rest need more stock.
    const result = optimize([sheet(48, 96)], [cut(24, 48, 4, 'Panel')], 0.125)
    const placed = result.plans.reduce((n, p) => n + p.placements.length, 0)
    expect(placed).toBe(2)
    expect(result.unplacedCuts).toHaveLength(2)
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

  // Kerf is material lost *between* cuts. Charging it against the edge of the
  // stock used to reject any piece as wide as its board, which broke every
  // crosscut on dimensional lumber.
  describe('kerf at the edge of the stock', () => {
    it('cuts a 2x4 to full length without needing kerf clearance', () => {
      const result = optimize([twoByFour(96)], [cut(3.5, 96, 1, 'Full stud')], 0.125)
      expect(result.unplacedCuts).toHaveLength(0)
      expect(result.plans[0].placements).toHaveLength(1)
      expect(result.plans[0].placements[0]).toMatchObject({ x: 0, y: 0, rotated: false })
    })

    it('crosscuts a 2x4 across its full width', () => {
      // Two 47.9" pieces plus one 1/8" kerf is 95.925" — fits a 96" stud.
      const result = optimize([twoByFour(96)], [cut(3.5, 47.9, 2, 'Rail')], 0.125)
      expect(result.unplacedCuts).toHaveLength(0)
      expect(result.plans).toHaveLength(1)
      expect(result.plans[0].placements).toHaveLength(2)
    })

    it('fits full-width strips on a sheet', () => {
      const result = optimize([sheet(48, 96)], [cut(48, 12, 2, 'Strip')], 0.125)
      expect(result.unplacedCuts).toHaveLength(0)
      expect(result.plans[0].placements).toHaveLength(2)
    })

    it('places a piece that exactly fills the stock', () => {
      const result = optimize([sheet(48, 96)], [cut(48, 96, 1, 'Whole sheet')], 0.125)
      expect(result.unplacedCuts).toHaveLength(0)
      expect(result.plans[0].wastePercent).toBe(0)
    })
  })

  // The counterpart to the above: kerf must still be consumed between adjacent
  // cuts, so these guard against "fixing" the edge case by ignoring kerf.
  describe('kerf between cuts', () => {
    it('loses a kerf to each cut down a 2x4', () => {
      // 4 x 22 1/2" = 90", plus three 1/8" kerfs = 90 3/8" — fits a 96" stud.
      const result = optimize([twoByFour(96)], [cut(3.5, 22.5, 4, 'Leg')], 0.125)
      expect(result.unplacedCuts).toHaveLength(0)

      // Each piece starts one kerf past the end of the previous one.
      const ys = result.plans[0].placements.map(p => p.y)
      expect(ys).toEqual([0, 22.625, 45.25, 67.875])
    })

    it('cannot get four 24" legs out of a 96" 2x4', () => {
      // 4 x 24" = 96" exactly, but the three kerfs between them need 3/8" more.
      const result = optimize([twoByFour(96)], [cut(3.5, 24, 4, 'Leg')], 0.125)
      expect(result.plans[0].placements).toHaveLength(3)
      expect(result.unplacedCuts).toHaveLength(1)
    })

    it('gets all four 24" legs once kerf is zero', () => {
      const result = optimize([twoByFour(96)], [cut(3.5, 24, 4, 'Leg')], 0)
      expect(result.unplacedCuts).toHaveLength(0)
      expect(result.plans[0].placements.map(p => p.y)).toEqual([0, 24, 48, 72])
    })

    it('spreads 2x4 cuts across multiple boards', () => {
      // Three 30" rails per 96" stud (90" of wood + two 1/8" kerfs = 90 1/4"),
      // so seven rails fill two studs and start a third.
      const result = optimize([twoByFour(96, 3)], [cut(3.5, 30, 7, 'Rail')], 0.125)
      expect(result.unplacedCuts).toHaveLength(0)
      expect(result.plans).toHaveLength(3)
      expect(result.plans.map(p => p.placements.length)).toEqual([3, 3, 1])
    })
  })
})
