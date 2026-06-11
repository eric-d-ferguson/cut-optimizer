import './style.css'
import type { StockPiece, DesiredCut, Unit } from './types'
import { optimize } from './optimizer'
import { renderPlan } from './renderer'
import { toFraction, fromInches } from './format'

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

  result.plans.forEach((plan, idx) => {
    const wrapper = document.createElement('div')
    wrapper.className = 'plan-card'

    const heading = document.createElement('h3')
    heading.textContent = `Board #${idx + 1} — ${plan.stock.label} (${fromInches(plan.stock.width, plan.stock.unit)} × ${fromInches(plan.stock.length, plan.stock.unit)}) · ${plan.wastePercent}% waste`
    wrapper.appendChild(heading)

    // Scale the diagram to fill a target area regardless of orientation
    const targetW = 560, targetH = 460
    const scale = Math.min(targetW / plan.stock.width, targetH / plan.stock.length)
    const canvas = document.createElement('canvas')
    renderPlan(canvas, plan, scale)
    wrapper.appendChild(canvas)

    // Text cut list for this board
    const list = document.createElement('ul')
    list.className = 'cut-list'
    plan.placements.forEach(p => {
      const li = document.createElement('li')
      const orient = p.rotated ? ' (rotated)' : ''
      const w = fromInches(p.cut.width, p.cut.unit)
      const l = fromInches(p.cut.length, p.cut.unit)
      li.textContent = `${p.cut.label}: ${w} × ${l}${orient} — at (${toFraction(p.x)}", ${toFraction(p.y)}")`
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

const kerfInput = document.getElementById('kerf') as HTMLInputElement
kerfInput.value = String(kerf)
kerfInput.addEventListener('change', () => { kerf = parseFloat(kerfInput.value) || 0.125 })

document.getElementById('add-stock')!.addEventListener('click', () => {
  const label = (document.getElementById('stock-label') as HTMLInputElement).value.trim()
  const width = parseFloat((document.getElementById('stock-width') as HTMLInputElement).value)
  const length = parseFloat((document.getElementById('stock-length') as HTMLInputElement).value)
  const unit = (document.getElementById('stock-unit') as HTMLSelectElement).value as Unit
  const quantity = parseInt((document.getElementById('stock-qty') as HTMLInputElement).value)
  if (!label || isNaN(width) || isNaN(length) || isNaN(quantity)) return
  stockList.push({
    id: generateId(), label, type: 'sheet', unit,
    width: toInches(width, unit), length: toInches(length, unit), quantity,
  })
  renderStockTable()
})

document.getElementById('add-cut')!.addEventListener('click', () => {
  const label = (document.getElementById('cut-label') as HTMLInputElement).value.trim()
  const width = parseFloat((document.getElementById('cut-width') as HTMLInputElement).value)
  const length = parseFloat((document.getElementById('cut-length') as HTMLInputElement).value)
  const unit = (document.getElementById('cut-unit') as HTMLSelectElement).value as Unit
  const quantity = parseInt((document.getElementById('cut-qty') as HTMLInputElement).value)
  if (!label || isNaN(width) || isNaN(length) || isNaN(quantity)) return
  cutList.push({
    id: generateId(), label, unit,
    width: toInches(width, unit), length: toInches(length, unit), quantity,
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
