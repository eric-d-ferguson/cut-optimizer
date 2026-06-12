import { describe, it, expect } from 'vitest'
import { buildShareText, isEmailBodyTooLong } from './share'
import type { OptimizeResult, CutPlan, DesiredCut } from './types'

function cut(label: string, width: number, length: number): DesiredCut {
  return { id: 'c', label, width, length, quantity: 1, unit: 'in' }
}

function plan(): CutPlan {
  return {
    stock: { id: 's', label: '4x8 Plywood', type: 'sheet', width: 48, length: 96, quantity: 1, unit: 'in' },
    placements: [
      { cut: cut('Shelf', 12, 24), x: 0, y: 0, rotated: false },
      { cut: cut('Shelf', 12, 24), x: 12, y: 0, rotated: true },
    ],
    wastePercent: 12,
  }
}

describe('buildShareText', () => {
  it('includes a header, board summary, and each placement', () => {
    const result: OptimizeResult = { plans: [plan()], kerf: 0.125, unplacedCuts: [] }
    const text = buildShareText(result, 0.125)

    expect(text).toContain('Cut Optimizer — Cut List')
    expect(text).toContain('1 board(s) used · 0.125" kerf')
    expect(text).toContain('Board #1 — 4x8 Plywood (48" × 96") · 12% waste')
    expect(text).toContain('Shelf: 12" × 24" — at (0", 0")')
    expect(text).toContain('Shelf: 12" × 24" (rotated) — at (12", 0")')
    expect(text).toContain('https://eric-d-ferguson.github.io/cut-optimizer/')
  })

  it('notes unplaced cuts when present', () => {
    const result: OptimizeResult = { plans: [plan()], kerf: 0, unplacedCuts: [cut('Too Big', 50, 50)] }
    const text = buildShareText(result, 0)
    expect(text).toContain('1 cut(s) could not be placed')
  })

  it('omits the unplaced note when everything fits', () => {
    const result: OptimizeResult = { plans: [plan()], kerf: 0, unplacedCuts: [] }
    expect(buildShareText(result, 0)).not.toContain('could not be placed')
  })
})

describe('isEmailBodyTooLong', () => {
  it('is false for a short cut list', () => {
    const result: OptimizeResult = { plans: [plan()], kerf: 0.125, unplacedCuts: [] }
    expect(isEmailBodyTooLong(buildShareText(result, 0.125))).toBe(false)
  })

  it('is true once the encoded body exceeds the safe length', () => {
    const big: CutPlan = {
      ...plan(),
      placements: Array.from({ length: 200 }, () => ({
        cut: cut('Shelf', 12, 24), x: 0, y: 0, rotated: false,
      })),
    }
    const result: OptimizeResult = { plans: [big], kerf: 0.125, unplacedCuts: [] }
    expect(isEmailBodyTooLong(buildShareText(result, 0.125))).toBe(true)
  })
})
