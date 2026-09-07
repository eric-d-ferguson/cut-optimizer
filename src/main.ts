import './style.css'
import type { StockPiece, DesiredCut, Unit } from './types'
import { optimize } from './optimizer'
import { renderPlan } from './renderer'
import { renderShareBar } from './share'
import { toFraction, fromInches, parseMeasurement } from './format'

let stockList: StockPiece[] = []
let cutList: DesiredCut[] = []
let kerf = 0.125

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

// Convert a value the user entered (in their chosen unit) to inches for internal use
function toInches(value: number, unit: Unit) {
  return unit === 'ft' ? value * 12 : value
}

function renderStockTable() {
  const tbody = document.querySelector('#stock-table tbody')!
  tbody.innerHTML = stockList.map(s => `
    <tr data-id="${s.id}">
      <td>${s.label}</td>
      <td>${fromInches(s.width, s.unit)}</td>
      <td>${fromInches(s.length, s.unit)}</td>
      <td>${s.quantity}</td>
      <td><button class="remove-btn" data-list="stock" data-id="${s.id}">✕</button></td>
    </tr>
  `).join('')
}

function renderCutTable() {
  const tbody = document.querySelector('#cut-table tbody')!
  tbody.innerHTML = cutList.map(c => `
    <tr data-id="${c.id}">
      <td>${c.label}</td>
      <td>${fromInches(c.width, c.unit)}</td>
      <td>${fromInches(c.length, c.unit)}</td>
      <td>${c.quantity}</td>
      <td><button class="remove-btn" data-list="cuts" data-id="${c.id}">✕</button></td>
    </tr>
  `).join('')
}

function runOptimizer() {
  const resultsEl = document.getElementById('results')!
  resultsEl.innerHTML = ''

  if (stockList.length === 0 || cutList.length === 0) {
    resultsEl.innerHTML = '<p class="hint">Add stock and cuts above, then click Optimize.</p>'
    return
  }

  const result = optimize(stockList, cutList, kerf)

  // Summary header
  const summary = document.createElement('p')
  summary.className = 'summary'
  summary.textContent = `${result.plans.length} board(s) used · ${kerf}" kerf`
  resultsEl.appendChild(summary)

  // Share the optimized cut list (copy / email / Google Doc)
  if (result.plans.length > 0) {
    resultsEl.appendChild(renderShareBar(result, kerf))
  }

  // Let the diagrams use the full width of the results column. For long stock
  // like a 2x4 that directly sets how thick — and how legible — the board is.
  const CARD_CHROME = 34  // .plan-card padding + border
  const diagramBox = {
    maxWidth: resultsEl.clientWidth > 0 ? Math.max(280, resultsEl.clientWidth - CARD_CHROME) : 760,
    maxHeight: 520,
  }

  result.plans.forEach((plan, idx) => {
    const wrapper = document.createElement('div')
    wrapper.className = 'plan-card'

    const heading = document.createElement('h3')
    heading.textContent = `Board #${idx + 1} — ${plan.stock.label} (${fromInches(plan.stock.width, plan.stock.unit)} × ${fromInches(plan.stock.length, plan.stock.unit)}) · ${plan.wastePercent}% waste`
    wrapper.appendChild(heading)

    const canvas = document.createElement('canvas')
    renderPlan(canvas, plan, diagramBox)
    wrapper.appendChild(canvas)

    // Text cut list for this board
    const list = document.createElement('ul')
    list.className = 'cut-list'
    plan.placements.forEach((p, i) => {
      const li = document.createElement('li')
      const orient = p.rotated ? ' (rotated)' : ''
      const w = fromInches(p.cut.width, p.cut.unit)
      const l = fromInches(p.cut.length, p.cut.unit)
      li.textContent = `${i + 1}. ${p.cut.label}: ${w} × ${l}${orient} — at (${toFraction(p.x)}", ${toFraction(p.y)}")`
      list.appendChild(li)
    })
    wrapper.appendChild(list)

    resultsEl.appendChild(wrapper)
  })

  if (result.unplacedCuts.length > 0) {
    const warn = document.createElement('p')
    warn.className = 'warn'
    warn.textContent = `⚠ ${result.unplacedCuts.length} cut(s) could not be placed — add more stock.`
    resultsEl.appendChild(warn)
  }
}

function showError(prefix: string, message: string) {
  document.getElementById(`${prefix}-error`)!.textContent = message
}

const kerfInput = document.getElementById('kerf') as HTMLInputElement
kerfInput.value = String(kerf)
kerfInput.addEventListener('change', () => {
  const parsed = parseMeasurement(kerfInput.value)
  if (isNaN(parsed) || parsed < 0 || parsed > 1) {
    // Keep the last good kerf rather than silently snapping to the default,
    // which would quietly change every measurement in the plan.
    showError('kerf', `Can't read "${kerfInput.value}" as a blade width — keeping ${kerf}".`)
    kerfInput.value = String(kerf)
    return
  }
  showError('kerf', '')
  kerf = parsed
})

interface RowInput {
  label: string
  width: number
  length: number
  unit: Unit
  quantity: number
}

/**
 * Read one stock/cut entry row. Returns the parsed values, or a message saying
 * what needs fixing — the Add buttons used to `return` silently on any bad
 * field, which made a mistyped dimension look like a dead button.
 */
function readRow(prefix: 'stock' | 'cut'): RowInput | string {
  const field = (name: string) =>
    document.getElementById(`${prefix}-${name}`) as HTMLInputElement
  const noun = prefix === 'stock' ? 'stock' : 'cut'

  const label = field('label').value.trim()
  if (!label) return `Give this ${noun} a label first.`

  const dims: Record<string, number> = {}
  for (const name of ['width', 'length']) {
    const raw = field(name).value.trim()
    if (!raw) return `Enter a ${name}.`
    const value = parseMeasurement(raw)
    if (isNaN(value)) return `Can't read "${raw}" as a ${name}. Try 22.5, 22 1/2, or 1/2.`
    if (value <= 0) return `The ${name} has to be more than zero.`
    dims[name] = value
  }

  // A blank quantity reads as "just the one" rather than as a mistake.
  const qtyRaw = field('qty').value.trim()
  const quantity = qtyRaw === '' ? 1 : Number(qtyRaw)
  if (!Number.isInteger(quantity) || quantity < 1) {
    return `Quantity should be a whole number, 1 or more.`
  }

  const unit = (document.getElementById(`${prefix}-unit`) as HTMLSelectElement).value as Unit
  return { label, width: dims.width, length: dims.length, unit, quantity }
}

document.getElementById('add-stock')!.addEventListener('click', () => {
  const row = readRow('stock')
  if (typeof row === 'string') return showError('stock', row)
  showError('stock', '')
  stockList.push({
    id: generateId(), label: row.label, type: 'sheet', unit: row.unit,
    width: toInches(row.width, row.unit), length: toInches(row.length, row.unit),
    quantity: row.quantity,
  })
  renderStockTable()
})

document.getElementById('add-cut')!.addEventListener('click', () => {
  const row = readRow('cut')
  if (typeof row === 'string') return showError('cut', row)
  showError('cut', '')
  cutList.push({
    id: generateId(), label: row.label, unit: row.unit,
    width: toInches(row.width, row.unit), length: toInches(row.length, row.unit),
    quantity: row.quantity,
  })
  renderCutTable()
})

document.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest('.remove-btn') as HTMLElement | null
  if (!btn) return
  const list = btn.dataset.list
  const id = btn.dataset.id
  if (list === 'stock') stockList = stockList.filter(s => s.id !== id)
  if (list === 'cuts') cutList = cutList.filter(c => c.id !== id)
  renderStockTable()
  renderCutTable()
})

document.getElementById('optimize-btn')!.addEventListener('click', runOptimizer)

// Wire the footer link to a GitHub new-issue form with a light template.
// Falls back to the plain issues page (set in the HTML) if JS doesn't run.
const ISSUE_BODY = [
  '### What were you doing?',
  '',
  '',
  '### What did you expect?',
  '',
  '',
  '### What happened instead?',
  '',
  '',
  '---',
  '_Filed from the Cut Optimizer app._',
].join('\n')

const reportLink = document.getElementById('report-issue') as HTMLAnchorElement | null
if (reportLink) {
  const params = new URLSearchParams({
    assignees: 'eric-d-ferguson',  // auto-assign new issues to the repo owner
    body: ISSUE_BODY,
  })
  reportLink.href =
    `https://github.com/eric-d-ferguson/cut-optimizer/issues/new?${params}`
}
