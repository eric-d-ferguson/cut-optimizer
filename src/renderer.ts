import type { CutPlan, CutPlacement } from './types'
import { fromInches } from './format'

// Canvas can't read CSS variables directly, so these mirror style.css.
// board is the bare stock — what shows through is waste.
const LIGHT = {
  board: '#f3f3f1',
  border: '#2a5bb8',
  pieceBorder: '#ffffff',
  pieceText: '#0f1215',
  label: '#626a75',
}
const DARK = {
  board: '#121417',
  border: '#84a9f0',
  pieceBorder: '#1a1d21',
  pieceText: '#0f1215',
  label: '#9199a4',
}
const FONT = "'Inter', system-ui, sans-serif"

const currentTheme = () =>
  globalThis.matchMedia?.('(prefers-color-scheme: dark)').matches ? DARK : LIGHT

// Soft, distinct piece colors that keep dark label text legible on either board
const COLORS = [
  '#8fb3f2', '#86d6a5', '#f2c46d', '#c9a7f0', '#f2a3c4',
  '#7fd3d0', '#f5a97a', '#b5d77a', '#a7b4f5', '#e8d27a',
]

const PADDING = 20        // breathing room around the board
const CAPTION_GUTTER = 16 // space under the board for the stock caption
const MIN_FONT = 9        // below this text is unreadable — fall back to a badge
const MAX_FONT = 13
const TWO_LINE_MIN = 30   // height a piece needs to hold a label *and* its dims
const MAX_SCALE = 24      // px per inch, so a small offcut isn't blown up huge
const TEXT_INSET = 8      // keep label text clear of the piece's edges

// The space the finished diagram may occupy, padding and caption included, so
// callers can hand over a container's width without doing the arithmetic.
export interface DiagramBox { maxWidth: number; maxHeight: number }

// A piece's rectangle in screen pixels, after the board's orientation is applied
interface Box { x: number; y: number; w: number; h: number }

export function renderPlan(
  canvas: HTMLCanvasElement,
  plan: CutPlan,
  box: DiagramBox = { maxWidth: 760, maxHeight: 520 },
): void {
  const { stock, placements } = plan

  // Long stock reads best lengthwise. A 3 1/2" x 96" 2x4 drawn with its length
  // running down the page is a sliver barely wide enough for the board itself,
  // let alone a label; turned lengthwise it fills the card.
  const landscape = stock.length > stock.width
  const boardIn = landscape
    ? { w: stock.length, h: stock.width }
    : { w: stock.width, h: stock.length }

  const roomW = Math.max(40, box.maxWidth - PADDING * 2)
  const roomH = Math.max(40, box.maxHeight - PADDING * 2 - CAPTION_GUTTER)
  const scale = Math.min(roomW / boardIn.w, roomH / boardIn.h, MAX_SCALE)
  const boardW = boardIn.w * scale
  const boardH = boardIn.h * scale

  const cssW = boardW + PADDING * 2
  const cssH = boardH + PADDING * 2 + CAPTION_GUTTER

  // Draw at device resolution, in CSS pixel coordinates, so labels stay crisp
  // on high-DPI screens instead of being upscaled from a 1x bitmap.
  const dpr = globalThis.devicePixelRatio || 1
  canvas.width = Math.round(cssW * dpr)
  canvas.height = Math.round(cssH * dpr)
  canvas.style.width = `${cssW}px`
  canvas.style.height = `${cssH}px`

  const theme = currentTheme()
  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, cssW, cssH)

  // Stock background (bare board — what shows through is waste)
  ctx.fillStyle = theme.board
  ctx.fillRect(PADDING, PADDING, boardW, boardH)
  ctx.strokeStyle = theme.border
  ctx.lineWidth = 2
  ctx.strokeRect(PADDING, PADDING, boardW, boardH)

  // Draw each cut piece
  placements.forEach((placement, i) => {
    const b = screenBox(placement, landscape, scale)

    ctx.fillStyle = COLORS[i % COLORS.length] + 'E6'
    ctx.fillRect(b.x, b.y, b.w, b.h)
    ctx.strokeStyle = theme.pieceBorder
    ctx.lineWidth = 1
    ctx.strokeRect(b.x, b.y, b.w, b.h)

    drawPieceLabel(ctx, b, i + 1, placement, theme.pieceText)
  })

  // Stock caption below
  ctx.fillStyle = theme.label
  ctx.font = `11px ${FONT}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  const long = `${fromInches(stock.length, stock.unit)} long`
  const wide = `${fromInches(stock.width, stock.unit)} wide`
  ctx.fillText(
    `${stock.label} — ${landscape ? `${long} × ${wide}` : `${wide} × ${long}`} (${plan.wastePercent}% waste)`,
    cssW / 2,
    PADDING + boardH + 4,
  )
}

// Map a placement from stock space (x across the width, y along the length)
// into screen pixels, transposing the axes when the board is drawn lengthwise.
function screenBox(p: CutPlacement, landscape: boolean, scale: number): Box {
  const across = p.rotated ? p.cut.length : p.cut.width
  const along = p.rotated ? p.cut.width : p.cut.length
  const x = landscape ? p.y : p.x
  const y = landscape ? p.x : p.y
  const w = landscape ? along : across
  const h = landscape ? across : along
  return { x: PADDING + x * scale, y: PADDING + y * scale, w: w * scale, h: h * scale }
}

/**
 * Label a piece with the most informative text it can actually hold, measuring
 * each candidate rather than guessing from the piece's width. Falls back to a
 * numbered badge (matching the cut list) when the piece is too small for text,
 * and draws nothing at all rather than something illegible.
 */
function drawPieceLabel(
  ctx: CanvasRenderingContext2D,
  b: Box,
  index: number,
  placement: CutPlacement,
  textColor: string,
): void {
  const { cut, rotated } = placement
  const name = rotated ? `${cut.label} (R)` : cut.label
  const dims = `${fromInches(cut.width, cut.unit)} × ${fromInches(cut.length, cut.unit)}`

  // Text runs along the piece's longer screen axis, turned sideways for pieces
  // that are tall and narrow (a rip down a sheet) so it has room to breathe.
  const vertical = b.h > b.w * 1.4
  const along = vertical ? b.h : b.w
  const across = vertical ? b.w : b.h

  ctx.save()
  ctx.translate(b.x + b.w / 2, b.y + b.h / 2)
  if (vertical) ctx.rotate(-Math.PI / 2)
  ctx.fillStyle = textColor
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  const room = along - TEXT_INSET
  const fits = (text: string, font: number, weight = '') => {
    ctx.font = `${weight} ${font}px ${FONT}`.trim()
    return ctx.measureText(text).width <= room
  }

  // Try each candidate at the largest type it can hold, shrinking to a readable
  // floor before dropping to a less informative one — a piece is more useful
  // labelled "Leg 22 1/2"" in small type than "Leg" in large type.
  const bestFont = (text: string, preferred: number, weight = '') => {
    for (let f = Math.min(MAX_FONT, preferred); f >= MIN_FONT; f--) {
      if (fits(text, f, weight)) return f
    }
    return 0
  }

  // Two lines when the piece is deep enough to give them both room.
  if (across >= TWO_LINE_MIN) {
    const preferred = Math.floor(across * 0.32)
    const font = Math.min(bestFont(name, preferred, 'bold'), bestFont(dims, preferred))
    if (font >= MIN_FONT) {
      ctx.font = `bold ${font}px ${FONT}`
      ctx.fillText(name, 0, -font * 0.6)
      ctx.font = `${font}px ${FONT}`
      ctx.fillText(dims, 0, font * 0.6)
      ctx.restore()
      return
    }
  }

  // One line: name with both dimensions, then with just the long side, then bare.
  const longSide = fromInches(Math.max(cut.width, cut.length), cut.unit)
  const preferred = Math.floor(across * 0.5)
  for (const text of [`${name}  ${dims}`, `${name}  ${longSide}`, name, cut.label]) {
    const font = bestFont(text, preferred, 'bold')
    if (font >= MIN_FONT) {
      ctx.font = `bold ${font}px ${FONT}`
      ctx.fillText(text, 0, 0)
      ctx.restore()
      return
    }
  }

  // Too small for words — a badge still ties the piece to its cut-list entry.
  if (across >= MIN_FONT && fits(String(index), MIN_FONT, 'bold')) {
    ctx.font = `bold ${MIN_FONT}px ${FONT}`
    ctx.fillText(String(index), 0, 0)
  }
  ctx.restore()
}
