import { CutPlan } from './types'

const COLORS = [
  '#4E9AF1', '#F1A44E', '#4EF17A', '#F14E7A', '#A44EF1',
  '#F1E84E', '#4EF1E8', '#F16B4E', '#8AF14E', '#4E6BF1',
]

export function renderPlan(canvas: HTMLCanvasElement, plan: CutPlan, scale: number = 4): void {
  const { stock, placements } = plan
  const padding = 20

  canvas.width = stock.width * scale + padding * 2
  canvas.height = stock.length * scale + padding * 2

  const ctx = canvas.getContext('2d')!
  ctx.clearRect(0, 0, canvas.width, canvas.height)

  // Stock background
  ctx.fillStyle = '#f5e6c8'
  ctx.fillRect(padding, padding, stock.width * scale, stock.length * scale)
  ctx.strokeStyle = '#8B6914'
  ctx.lineWidth = 2
  ctx.strokeRect(padding, padding, stock.width * scale, stock.length * scale)

  // Draw each cut piece
  placements.forEach((placement, i) => {
    const color = COLORS[i % COLORS.length]
    const w = (placement.rotated ? placement.cut.length : placement.cut.width) * scale
    const h = (placement.rotated ? placement.cut.width : placement.cut.length) * scale
    const x = padding + placement.x * scale
    const y = padding + placement.y * scale

    ctx.fillStyle = color + 'CC'
    ctx.fillRect(x, y, w, h)
    ctx.strokeStyle = '#333'
    ctx.lineWidth = 1
    ctx.strokeRect(x, y, w, h)

    // Label
    ctx.fillStyle = '#111'
    ctx.font = `bold ${Math.min(12, w / 6)}px sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    const label = placement.rotated ? `${placement.cut.label} (R)` : placement.cut.label
    const dims = `${placement.cut.width}" × ${placement.cut.length}"`
    ctx.fillText(label, x + w / 2, y + h / 2 - 7)
    ctx.font = `${Math.min(10, w / 8)}px sans-serif`
    ctx.fillText(dims, x + w / 2, y + h / 2 + 7)
  })

  // Stock label below
  ctx.fillStyle = '#555'
  ctx.font = '11px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'top'
  ctx.fillText(
    `${stock.label} — ${stock.width}" × ${stock.length}" (${plan.wastePercent}% waste)`,
    canvas.width / 2,
    padding + stock.length * scale + 4
  )
}
