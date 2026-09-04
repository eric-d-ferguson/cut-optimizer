import { describe, it, expect } from 'vitest'
import { optimize } from './optimizer'
import type { StockPiece, DesiredCut, CutPlan } from './types'

const EPS = 1e-6

// --- Physical validity of a plan, derived independently of the optimizer ---
function violations(plan: CutPlan, kerf: number): string[] {
  const bad: string[] = []
  const boxes = plan.placements.map(p => {
    const w = p.rotated ? p.cut.length : p.cut.width
    const h = p.rotated ? p.cut.width : p.cut.length
    return { x0: p.x, y0: p.y, x1: p.x + w, y1: p.y + h, label: p.cut.label }
  })

  // 1. every piece inside the stock
  for (const b of boxes) {
    if (b.x0 < -EPS || b.y0 < -EPS || b.x1 > plan.stock.width + EPS || b.y1 > plan.stock.length + EPS) {
      bad.push(`out of bounds: ${b.label} [${b.x0},${b.y0}]-[${b.x1},${b.y1}] on ${plan.stock.width}x${plan.stock.length}`)
    }
  }

  // 2. no two pieces overlap, and 3. any two are separated by at least a kerf
  //    on some axis (there has to be a saw path between them)
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j]
      const overlapX = a.x0 < b.x1 - EPS && b.x0 < a.x1 - EPS
      const overlapY = a.y0 < b.y1 - EPS && b.y0 < a.y1 - EPS
      if (overlapX && overlapY) { bad.push(`overlap: ${i} and ${j}`); continue }
      const gapX = Math.max(b.x0 - a.x1, a.x0 - b.x1)
      const gapY = Math.max(b.y0 - a.y1, a.y0 - b.y1)
      if (Math.max(gapX, gapY) < kerf - EPS) {
        bad.push(`no saw path between ${i} and ${j}: gaps ${gapX.toFixed(4)}/${gapY.toFixed(4)} < kerf ${kerf}`)
      }
    }
  }
  return bad
}

// Deterministic PRNG so a failure is reproducible
function rng(seed: number) {
  let s = seed
  return () => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s / 0x7fffffff }
}

describe('randomized invariants', () => {
  it('never produces an overlapping, out-of-bounds, or kerf-less layout', () => {
    const rand = rng(42)
    const kerfs = [0, 0.0625, 0.125, 0.25]
    const failures: string[] = []

    for (let trial = 0; trial < 3000; trial++) {
      const kerf = kerfs[Math.floor(rand() * kerfs.length)]
      const sw = 3.5 + Math.floor(rand() * 45)
      const sl = 12 + Math.floor(rand() * 84)
      const stock: StockPiece[] = [{ id: 's', label: 'S', type: 'sheet', width: sw, length: sl, quantity: 1 + Math.floor(rand() * 3), unit: 'in' }]
      const cuts: DesiredCut[] = Array.from({ length: 1 + Math.floor(rand() * 4) }, (_, k) => ({
        id: `c${k}`, label: `C${k}`, unit: 'in',
        // deliberately include exact-fit and oversize dimensions
        width: [sw, sw / 2, 1 + Math.floor(rand() * sw), 3.5][Math.floor(rand() * 4)],
        length: [sl, sl / 2, 1 + Math.floor(rand() * sl), 22.5][Math.floor(rand() * 4)],
        quantity: 1 + Math.floor(rand() * 5),
      }))

      const result = optimize(stock, cuts, kerf)

      // no cut is lost or duplicated
      const wanted = cuts.reduce((n, c) => n + c.quantity, 0)
      const got = result.plans.reduce((n, p) => n + p.placements.length, 0) + result.unplacedCuts.length
      if (got !== wanted) failures.push(`trial ${trial}: piece count ${got} != ${wanted}`)

      for (const plan of result.plans) {
        for (const v of violations(plan, kerf)) failures.push(`trial ${trial} (kerf ${kerf}, ${sw}x${sl}): ${v}`)
      }
    }
    expect(failures.slice(0, 10)).toEqual([])
  })
})

describe('1D lumber matches the closed-form maximum', () => {
  // On a board of length L, n pieces of length c need n*c + (n-1)*kerf <= L,
  // i.e. n = floor((L + kerf) / (c + kerf)).
  it('gets the theoretical best number of crosscuts from one 2x4', () => {
    const mismatches: string[] = []
    for (const L of [48, 72, 96, 120, 144]) {
      for (const kerf of [0, 0.0625, 0.125, 0.25]) {
        for (const c of [6, 10.5, 12, 16, 22.5, 24, 30, 31.75, 36, 47.9, 48]) {
          const expected = Math.floor((L + kerf) / (c + kerf) + 1e-9)
          const result = optimize(
            [{ id: 's', label: '2x4', type: 'dimensional', width: 3.5, length: L, quantity: 1, unit: 'in' }],
            [{ id: 'c', label: 'Leg', width: 3.5, length: c, quantity: expected + 2, unit: 'in' }],
            kerf,
          )
          const placed = result.plans.reduce((n, p) => n + p.placements.length, 0)
          if (placed !== expected) {
            mismatches.push(`L=${L} c=${c} kerf=${kerf}: placed ${placed}, theoretical max ${expected}`)
          }
        }
      }
    }
    expect(mismatches).toEqual([])
  })
})
