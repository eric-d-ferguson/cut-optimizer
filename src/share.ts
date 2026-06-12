import type { OptimizeResult } from './types'
import { toFraction, fromInches } from './format'

const APP_URL = 'https://eric-d-ferguson.github.io/cut-optimizer/'
// Google Docs has no URL param to pre-fill a new doc, so we open a blank one
// and copy the list to the clipboard for the user to paste in.
const NEW_GOOGLE_DOC_URL = 'https://docs.google.com/document/create'
// Many mail clients truncate long mailto bodies (the practical ceiling is
// ~2000 characters for the whole URL), so warn before we risk a cut-off email.
const MAILTO_SAFE_LENGTH = 1800

// True when the URL-encoded cut list is long enough that an email body may be
// truncated by the mail client. Copy / Google Doc have no such limit.
export function isEmailBodyTooLong(text: string): boolean {
  return encodeURIComponent(text).length > MAILTO_SAFE_LENGTH
}

// Render the optimized result as a plain-text cut list, suitable for copying,
// emailing, or pasting into a document.
export function buildShareText(result: OptimizeResult, kerf: number): string {
  const lines: string[] = []
  lines.push('Cut Optimizer — Cut List')
  lines.push('========================')
  lines.push(`${result.plans.length} board(s) used · ${kerf}" kerf`)
  lines.push('')

  result.plans.forEach((plan, idx) => {
    const stock = plan.stock
    lines.push(
      `Board #${idx + 1} — ${stock.label} (${fromInches(stock.width, stock.unit)} × ${fromInches(stock.length, stock.unit)}) · ${plan.wastePercent}% waste`
    )
    plan.placements.forEach(p => {
      const orient = p.rotated ? ' (rotated)' : ''
      const w = fromInches(p.cut.width, p.cut.unit)
      const l = fromInches(p.cut.length, p.cut.unit)
      lines.push(`  - ${p.cut.label}: ${w} × ${l}${orient} — at (${toFraction(p.x)}", ${toFraction(p.y)}")`)
    })
    lines.push('')
  })

  if (result.unplacedCuts.length > 0) {
    lines.push(`! ${result.unplacedCuts.length} cut(s) could not be placed — add more stock.`)
    lines.push('')
  }

  lines.push(`Generated with ${APP_URL}`)
  return lines.join('\n')
}

// Copy text to the clipboard, falling back to a hidden textarea on browsers
// that block the async Clipboard API (e.g. non-secure contexts).
async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path below
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.focus()
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}

// Briefly swap a button's label to confirm an action, then restore it.
function flash(btn: HTMLButtonElement, msg: string) {
  const original = btn.dataset.label ?? btn.textContent ?? ''
  btn.dataset.label = original
  btn.textContent = msg
  btn.disabled = true
  setTimeout(() => {
    btn.textContent = btn.dataset.label ?? original
    btn.disabled = false
  }, 1600)
}

// Build the share bar (Copy / Email / Google Doc) for an optimized result.
export function renderShareBar(result: OptimizeResult, kerf: number): HTMLElement {
  const text = buildShareText(result, kerf)

  const bar = document.createElement('div')
  bar.className = 'share-bar'

  const label = document.createElement('span')
  label.className = 'share-label'
  label.textContent = 'Share cut list:'
  bar.appendChild(label)

  const copyBtn = document.createElement('button')
  copyBtn.textContent = 'Copy to clipboard'
  copyBtn.addEventListener('click', async () => {
    const ok = await copyToClipboard(text)
    flash(copyBtn, ok ? 'Copied ✓' : 'Copy failed')
  })
  bar.appendChild(copyBtn)

  const emailBtn = document.createElement('button')
  emailBtn.textContent = 'Email'
  emailBtn.addEventListener('click', () => {
    if (isEmailBodyTooLong(text)) {
      const proceed = confirm(
        'This cut list is long, and some email apps may cut it off.\n\n' +
        'For the complete list, use “Copy to clipboard” or “Google Doc” instead.\n\n' +
        'Open your email anyway?'
      )
      if (!proceed) return
    }
    const subject = encodeURIComponent('Cut List')
    const body = encodeURIComponent(text)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  })
  bar.appendChild(emailBtn)

  const docBtn = document.createElement('button')
  docBtn.textContent = 'Google Doc'
  docBtn.title = 'Copies the cut list and opens a new Google Doc — just paste'
  docBtn.addEventListener('click', async () => {
    const ok = await copyToClipboard(text)
    window.open(NEW_GOOGLE_DOC_URL, '_blank', 'noopener')
    flash(docBtn, ok ? 'Copied — paste in doc' : 'Doc opened')
  })
  bar.appendChild(docBtn)

  return bar
}
