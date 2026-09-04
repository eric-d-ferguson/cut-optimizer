import { describe, it, expect, afterEach } from 'vitest'
import { renderPlan } from './renderer'
import { optimize } from './optimizer'
import type { CutPlan, CutPlacement, DesiredCut, StockPiece } from './types'

// A 2D context stand-in that records what was drawn. measureText approximates
// JetBrains Mono at 0.6em per character, which is what the real label fitting
// is measuring against.
function fakeCanvas() {
  const texts: { text: string; x: number; y: number; font: string }[] = []
  const rects: { x: number; y: number; w: number; h: number; fill: boolean }[] = []

  const ctx = {
    font: '10px monospace',
    fillStyle: '', strokeStyle: '', lineWidth: 1, textAlign: '', textBaseline: '',
    save() {}, restore() {}, translate() {}, rotate() {}, setTransform() {}, clearRect() {},
    fillRect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h, fill: true }) },
    strokeRect(x: number, y: number, w: number, h: number) { rects.push({ x, y, w, h, fill: false }) },
    fillText(text: string, x: number, y: number) { texts.push({ text, x, y, font: ctx.font }) },
    measureText(text: string) {
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(ctx.font)?.[1] ?? 10)
      return { width: text.length * px * 0.6 }
    },
  }

  const canvas = {
    width: 0, height: 0, style: {} as Record<string, string>,
    getContext: () => ctx,
  }
  return { canvas: canvas as unknown as HTMLCanvasElement, texts, rects }
}

const cssSize = (c: HTMLCanvasElement) => ({
  w: parseFloat(c.style.width),
  h: parseFloat(c.style.height),
})

function stock(label: string, width: number, length: number): StockPiece {
  return { id: 's', label, type: 'sheet', width, length, quantity: 1, unit: 'in' }
}

function cut(label: string, width: number, length: number): DesiredCut {
  return { id: 'c', label, width, length, quantity: 1, unit: 'in' }
}

function plan(s: StockPiece, placements: CutPlacement[], wastePercent = 10): CutPlan {
  return { stock: s, placements, wastePercent }
}

const BOX = { maxWidth: 766, maxHeight: 520 }

afterEach(() => { delete (globalThis as { devicePixelRatio?: number }).devicePixelRatio })

describe('renderPlan layout', () => {
  it('draws long stock lengthwise so a 2x4 is not a sliver', () => {
    const { canvas } = fakeCanvas()
    renderPlan(canvas, plan(stock('2x4', 3.5, 96), []), BOX)

    const { w, h } = cssSize(canvas)
    expect(w).toBeGreaterThan(h)          // the 96" length runs across the page
    expect(w).toBeCloseTo(BOX.maxWidth)   // and uses the width it was given
    expect(h).toBeLessThan(100)
  })

  it('keeps wide, short stock upright', () => {
    const { canvas } = fakeCanvas()
    renderPlan(canvas, plan(stock('Offcut', 20, 14), []), BOX)
    const { w, h } = cssSize(canvas)
    expect(w).toBeGreaterThan(h)
    // 20" is the width here, so it should not be transposed: 20:14 not 14:20
    expect((w - 40) / (h - 56)).toBeCloseTo(20 / 14, 1)
  })

  it('never exceeds the box it is given', () => {
    for (const s of [stock('a', 3.5, 96), stock('b', 48, 96), stock('c', 96, 96), stock('d', 2, 4)]) {
      const { canvas } = fakeCanvas()
      renderPlan(canvas, plan(s, []), BOX)
      const { w, h } = cssSize(canvas)
      expect(w).toBeLessThanOrEqual(BOX.maxWidth + 0.01)
      expect(h).toBeLessThanOrEqual(BOX.maxHeight + 0.01)
    }
  })

  it('does not magnify a small offcut past MAX_SCALE', () => {
    const { canvas } = fakeCanvas()
    renderPlan(canvas, plan(stock('Scrap', 6, 8), []), BOX)
    const { w } = cssSize(canvas)
    expect(w).toBeCloseTo(8 * 24 + 40)  // 8" long at 24 px/in, plus padding
  })

  it('sizes the backing store for the device pixel ratio', () => {
    ;(globalThis as { devicePixelRatio?: number }).devicePixelRatio = 2
    const { canvas } = fakeCanvas()
    renderPlan(canvas, plan(stock('2x4', 3.5, 96), []), BOX)
    const { w, h } = cssSize(canvas)
    expect(canvas.width).toBe(Math.round(w * 2))
    expect(canvas.height).toBe(Math.round(h * 2))
  })

  // Fed with real optimizer output, so the layouts under test are ones the app
  // can actually produce rather than coordinates invented here.
  it.each([
    ['a 2x4', stock('2x4', 3.5, 96), [{ ...cut('Leg', 3.5, 22.5), quantity: 4 }]],
    ['a sheet', stock('4x8', 48, 96), [
      { ...cut('Side panel', 22, 47), quantity: 2 },
      { ...cut('Cleat', 1.5, 10), quantity: 6 },
      { ...cut('Rip', 4, 88), quantity: 2 },
    ]],
    ['an offcut', stock('Offcut', 20, 14), [
      { ...cut('Block', 6, 6), quantity: 2 },
      { ...cut('Sliver', 1, 13), quantity: 2 },
    ]],
  ])('keeps every piece inside the drawn board (%s)', (_name, s, cuts) => {
    const result = optimize([s], cuts as DesiredCut[], 0.125)
    expect(result.plans.length).toBeGreaterThan(0)

    for (const p of result.plans) {
      const { canvas, rects } = fakeCanvas()
      renderPlan(canvas, p, BOX)

      // The first fill is the board itself; every later rect must sit inside it.
      const board = rects[0]
      expect(rects.length).toBe(2 + p.placements.length * 2)
      for (const r of rects.slice(1)) {
        expect(r.x).toBeGreaterThanOrEqual(board.x - 0.01)
        expect(r.y).toBeGreaterThanOrEqual(board.y - 0.01)
        expect(r.x + r.w).toBeLessThanOrEqual(board.x + board.w + 0.01)
        expect(r.y + r.h).toBeLessThanOrEqual(board.y + board.h + 0.01)
      }
    }
  })
})

describe('renderPlan labels', () => {
  it('gives a roomy piece its name and dimensions', () => {
    const s = stock('4x8', 48, 96)
    const { canvas, texts } = fakeCanvas()
    renderPlan(canvas, plan(s, [{ cut: cut('Side panel', 22, 47), x: 0, y: 0, rotated: false }]), BOX)

    expect(texts.map(t => t.text)).toContain('Side panel')
    expect(texts.map(t => t.text)).toContain('22" × 47"')
  })

  it('labels a 2x4 crosscut with its size on one line', () => {
    const s = stock('2x4', 3.5, 96)
    const { canvas, texts } = fakeCanvas()
    renderPlan(canvas, plan(s, [{ cut: cut('Leg', 3.5, 22.5), x: 0, y: 0, rotated: false }]), BOX)

    // A 3 1/2" board is too thin for two lines, so name and size share one.
    const label = texts.find(t => t.text.includes('Leg'))!
    expect(label.text).toBe('Leg  3 1/2" × 22 1/2"')
  })

  it('never labels a piece below the readable font floor', () => {
    const s = stock('4x8', 48, 96)
    const placements = Array.from({ length: 6 }, (_, i) => ({
      cut: cut('Cleat', 1.5, 10), x: i * 1.625, y: 0, rotated: false,
    }))
    const { canvas, texts } = fakeCanvas()
    renderPlan(canvas, plan(s, placements), BOX)

    for (const t of texts) {
      const px = Number(/(\d+(?:\.\d+)?)px/.exec(t.font)![1])
      expect(px).toBeGreaterThanOrEqual(9)
    }
  })

  it('falls back to a cut-list badge on a piece too small for words', () => {
    const s = stock('4x8', 48, 96)
    const { canvas, texts } = fakeCanvas()
    renderPlan(canvas, plan(s, [{ cut: cut('Cleat', 1.5, 10), x: 0, y: 0, rotated: false }]), BOX)

    // Index 1 in the diagram matches "1." in the rendered cut list.
    expect(texts.some(t => t.text === '1')).toBe(true)
    expect(texts.some(t => t.text.includes('Cleat'))).toBe(false)
  })

  it('marks rotated pieces', () => {
    const s = stock('4x8', 48, 96)
    const { canvas, texts } = fakeCanvas()
    renderPlan(canvas, plan(s, [{ cut: cut('Sliver', 1, 13), x: 0, y: 0, rotated: true }]), BOX)
    // 13" wide x 1" tall on the board: thin, but the (R) belongs on any label.
    const labelled = texts.filter(t => t.text.includes('Sliver'))
    for (const t of labelled) expect(t.text).toContain('(R)')
  })

  it('names the axes in the caption so a transposed board is unambiguous', () => {
    const { canvas, texts } = fakeCanvas()
    renderPlan(canvas, plan(stock('2x4 stud', 3.5, 96), [], 6), BOX)
    expect(texts.at(-1)!.text).toBe('2x4 stud — 96" long × 3 1/2" wide (6% waste)')
  })
})
