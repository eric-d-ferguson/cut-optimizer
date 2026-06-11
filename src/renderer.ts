import type { CutPlan } from './types'
import { fromInches } from './format'

// Theme colors (match the site's dark palette)
const THEME = {
  board: '#1a1e2a',   // --bg3, shown as the bare board / waste area
  border: '#22d3ee',  // --cyan accent
  pieceBorder: '#0d0f14',
  pieceText: '#0d0f14',
  label: '#5a6478',   // --muted
  font: "'JetBrains Mono', monospace",
}

// Bright, distinct piece colors that read well on the dark board
const COLORS = [
  '#22d3ee', '#4ade80', '#38bdf8', '#fbbf24', '#c084fc',
  '#f472b6', '#a3e635', '#fb923c', '#2dd4bf', '#818cf8',
]

export function renderPlan(canvas: HTMLCanvasElement, plan: CutPlan, scale: number = 4): void {
  const { stock, placements } = plan
  const padding = 20

  canvas.width = stock.width * scale + padding * 2
  canvas.height = stock.length * scale + padding * 2

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Stock background (bare board — what shows through is waste)
  ctx.fillStyle = THEME.board
  ctx.fillRect(padding, padding, stock.width * scale, stock.length * scale)
  ctx.strokeStyle = THEME.border
  ctx.lineWidth = 2
  ctx.strokeRect(padding, padding, stock.width * scale, stock.length * scale)

  // Draw each cut piece
  placements.forEach((placement, i) => {
    const color = COLORS[i % COLORS.length]
    const w = (placement.rotated ? placement.cut.length : placement.cut.width) * scale
    const h = (placement.rotated ? placement.cut.width : placement.cut.length) * scale
    const x = padding + placement.x * scale
    const y = padding + placement.y * scale

    ctx.fillStyle = color + 'E6'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = THEME.pieceBorder
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)

    // Label
    ctx.fillStyle = THEME.pieceText
    ctx.font = `bold ${Math.min(12, w / 6)}px ${THEME.font}`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const label = placement.rotated ? `${placement.cut.label} (R)` : placement.cut.label
    const dims = `${fromInches(placement.cut.width, placement.cut.unit)} × ${fromInches(placement.cut.length, placement.cut.unit)}`
    ctx.fillText(label, x + w / 2, y + h / 2 - 7)
    ctx.font = `${Math.min(10, w / 8)}px ${THEME.font}`
    ctx.fillText(dims, x + w / 2, y + h / 2 + 7)
  })

  // Stock label below
  ctx.fillStyle = THEME.label
  ctx.font = `11px ${THEME.font}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(
    `${stock.label} — ${fromInches(stock.width, stock.unit)} × ${fromInches(stock.length, stock.unit)} (${plan.wastePercent}% waste)`,
    canvas.width / 2,
    padding + stock.length * scale + 4
  )
}
