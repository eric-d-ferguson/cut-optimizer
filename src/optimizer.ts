import { StockPiece, DesiredCut, CutPlan, CutPlacement, OptimizeResult } from './types'

/**
 * Simple guillotine bin-packing algorithm.
 * Works for both sheet goods (2D) and dimensional lumber (1D treated as 2D with fixed width).
 */
export function optimize(
  stock: StockPiece[],
  cuts: DesiredCut[],
  kerf: number = 0.125
): OptimizeResult {
  const plans: CutPlan[] = []

  // Expand desired cuts by quantity into individual pieces
  const remaining: DesiredCut[] = cuts.flatMap(c =>
    Array.from({ length: c.quantity }, (_, i) => ({ ...c, id: `${c.id}-${i}` }))
  )

  // Sort cuts largest first (better packing)
  remaining.sort((a, b) => (b.width * b.length) - (a.width * a.length))

  // Expand stock by quantity
  const stockSheets = stock.flatMap(s =>
    Array.from({ length: s.quantity }, (_, i) => ({ ...s, id: `${s.id}-${i}` }))
  )

  const unplacedCuts: DesiredCut[] = []

  for (const sheet of stockSheets) {
    if (remaining.length === 0) break

    const placements: CutPlacement[] = []
    const freeRects = [{ x: 0, y: 0, w: sheet.width, h: sheet.length }]

    for (let i = remaining.length - 1; i >= 0; i--) {
      const cut = remaining[i]
      const placed = tryPlace(cut, freeRects, kerf)
      if (placed) {
        placements.push(placed)
        remaining.splice(i, 1)
      }
    }

    if (placements.length > 0) {
      const usedArea = placements.reduce((sum, p) => {
        const w = p.rotated ? p.cut.length : p.cut.width
        const h = p.rotated ? p.cut.width : p.cut.length
        return sum + w * h
      }, 0)
      const totalArea = sheet.width * sheet.length
      const wastePercent = Math.round((1 - usedArea / totalArea) * 100)

      plans.push({ stock: sheet, placements, wastePercent })
    }
  }

  unplacedCuts.push(...remaining)

  return { plans, kerf, unplacedCuts }
}

interface FreeRect { x: number; y: number; w: number; h: number }

function tryPlace(cut: DesiredCut, freeRects: FreeRect[], kerf: number): CutPlacement | null {
  const orientations = [
    { w: cut.width, h: cut.length, rotated: false },
    { w: cut.length, h: cut.width, rotated: true },
  ]

  for (const rect of freeRects) {
    for (const { w, h, rotated } of orientations) {
      if (w + kerf <= rect.w && h + kerf <= rect.h) {
        // Place it — split remaining free space
        const placement: CutPlacement = { cut, x: rect.x, y: rect.y, rotated }

        // Guillotine split: right and bottom
        const rightRect = { x: rect.x + w + kerf, y: rect.y, w: rect.w - w - kerf, h }
        const bottomRect = { x: rect.x, y: rect.y + h + kerf, w: rect.w, h: rect.h - h - kerf }

        freeRects.splice(freeRects.indexOf(rect), 1)
        if (rightRect.w > 0 && rightRect.h > 0) freeRects.push(rightRect)
        if (bottomRect.w > 0 && bottomRect.h > 0) freeRects.push(bottomRect)

        return placement
      }
    }
  }
  return null
}
