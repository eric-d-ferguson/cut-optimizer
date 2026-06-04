import './style.css'
import { StockPiece, DesiredCut } from './types'
import { optimize } from './optimizer'
import { renderPlan } from './renderer'

let stockList: StockPiece[] = []
let cutList: DesiredCut[] = []
let kerf = 0.125

function generateId() {
  return Math.random().toString(36).slice(2, 9)
}

function renderStockTable() {
  const tbody = document.querySelector('#stock-table tbody')!
  tbody.innerHTML = stockList.map(s => `
    <tr data-id="${s.id}">
      <td>${s.label}</td>
      <td>${s.width}"</td>
      <td>${s.length}"</td>
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
      <td>${c.width}"</td>
      <td>${c.length}"</td>
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

  result.plans.forEach(plan => {
    const wrapper = document.createElement('div')
    wrapper.className = 'plan-card'

    const canvas = document.createElement('canvas')
    const scale = Math.min(4, 600 / plan.stock.width)
    renderPlan(canvas, plan, scale)
    wrapper.appendChild(canvas)
    resultsEl.appendChild(wrapper)
  })

  if (result.unplacedCuts.length > 0) {
    const warn = document.createElement('p')
    warn.className = 'warn'
    warn.textContent = `⚠ ${result.unplacedCuts.length} cut(s) could not be placed — add more stock.`
    resultsEl.appendChild(warn)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const kerfInput = document.getElementById('kerf') as HTMLInputElement
  kerfInput.value = String(kerf)
  kerfInput.addEventListener('change', () => { kerf = parseFloat(kerfInput.value) || 0.125 })

  document.getElementById('add-stock')!.addEventListener('click', () => {
    const label = (document.getElementById('stock-label') as HTMLInputElement).value.trim()
    const width = parseFloat((document.getElementById('stock-width') as HTMLInputElement).value)
    const length = parseFloat((document.getElementById('stock-length') as HTMLInputElement).value)
    const quantity = parseInt((document.getElementById('stock-qty') as HTMLInputElement).value)
    if (!label || isNaN(width) || isNaN(length) || isNaN(quantity)) return
    stockList.push({ id: generateId(), label, type: 'sheet', width, length, quantity })
    renderStockTable()
  })

  document.getElementById('add-cut')!.addEventListener('click', () => {
    const label = (document.getElementById('cut-label') as HTMLInputElement).value.trim()
    const width = parseFloat((document.getElementById('cut-width') as HTMLInputElement).value)
    const length = parseFloat((document.getElementById('cut-length') as HTMLInputElement).value)
    const quantity = parseInt((document.getElementById('cut-qty') as HTMLInputElement).value)
    if (!label || isNaN(width) || isNaN(length) || isNaN(quantity)) return
    cutList.push({ id: generateId(), label, width, length, quantity })
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
})
