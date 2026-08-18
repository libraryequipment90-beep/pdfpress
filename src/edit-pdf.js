import './style.css'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { initNavAuth, initNavToggle } from './nav-auth.js'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const dropzone = document.getElementById('dropzone')
const fileInput = document.getElementById('file-input')
const editorApp = document.getElementById('editor-app')
const thumbList = document.getElementById('thumb-list')
const stageEl = document.getElementById('editor-stage')
const editorFilename = document.getElementById('editor-filename')
const loadingEl = document.getElementById('loading')
const loadingFill = document.getElementById('loading-fill')
const loadingText = document.getElementById('loading-text')
const errorBox = document.getElementById('error-box')
const addTextBtn = document.getElementById('add-text-btn')
const deleteBtn = document.getElementById('delete-btn')
const downloadBtn = document.getElementById('download-btn')
const closeBtn = document.getElementById('close-btn')
const fontSizeSel = document.getElementById('font-size')
const fontColorInput = document.getElementById('font-color')

const DEFAULT_TEXT = 'Text'
const STAGE_MAX_WIDTH = 980
const THUMB_WIDTH = 150
const MAX_ZOOM = 1.5
const REDACT_PAD = 1.5

let pdfjsDoc = null
let pdfLibDoc = null
let originalName = 'document.pdf'
let pages = []
let selected = null
let activeIndex = 0

const FONT_MAP = [
  { re: /helvetica|arial|liberationsans/i, font: StandardFonts.Helvetica },
  { re: /times|liberationserif/i, font: StandardFonts.TimesRoman },
  { re: /courier|liberationmono/i, font: StandardFonts.Courier },
]

function mapFont(name) {
  const n = String(name || '')
  const match = FONT_MAP.find((f) => f.re.test(n))
  return match ? match.font : StandardFonts.Helvetica
}

function showError(msg) {
  errorBox.textContent = msg
  errorBox.classList.remove('hidden')
}

function clearError() {
  errorBox.classList.add('hidden')
  errorBox.textContent = ''
}

function setLoading(on) {
  loadingEl.classList.toggle('hidden', !on)
  if (on) loadingFill.style.width = '45%'
}

function setEditorOpen(open) {
  editorApp.classList.toggle('hidden', !open)
  document.body.classList.toggle('editor-open', open)
}

function downloadBlob(bytes, name) {
  const blob = new Blob([bytes], { type: 'application/pdf' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

function hexToRgb(hex) {
  const clean = hex.replace('#', '')
  const full = clean.length === 3 ? clean.split('').map((c) => c + c).join('') : clean
  const n = parseInt(full, 16)
  return rgb(((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255)
}

function selectBox(tb) {
  if (selected && selected.el) selected.el.classList.remove('selected')
  selected = tb
  if (tb) {
    tb.el.classList.add('selected')
    fontSizeSel.value = String(tb.fontSize)
    fontColorInput.value = tb.color
    deleteBtn.disabled = tb.kind === 'existing'
  } else {
    deleteBtn.disabled = true
  }
}

function paintRedact(box) {
  const page = box.page
  if (!page.redactCtx || !box.redact) return
  page.redactCtx.save()
  page.redactCtx.globalAlpha = 1
  page.redactCtx.fillStyle = '#ffffff'
  page.redactCtx.fillRect(box.redact.x, box.redact.y, box.redact.w, box.redact.h)
  page.redactCtx.restore()
}

function eraseRedact(box) {
  const page = box.page
  if (!page.redactCtx || !box.redact) return
  page.redactCtx.save()
  page.redactCtx.globalCompositeOperation = 'destination-out'
  page.redactCtx.fillRect(box.redact.x, box.redact.y, box.redact.w, box.redact.h)
  page.redactCtx.restore()
}

function exitEdit(tb) {
  if (!tb.editing) return
  tb.editing = false
  tb.el.contentEditable = 'false'
  tb.el.classList.remove('editing')
  const raw = (tb.el.innerText || '').replace(/\u00a0/g, ' ').replace(/^\n+|\n+$/g, '')
  tb.text = raw.length ? raw : ' '

  if (tb.kind === 'existing') {
    if (tb.text === tb.origText) {
      eraseRedact(tb)
      tb.changed = false
      tb.el.style.color = 'transparent'
    } else {
      tb.changed = true
      tb.el.style.color = tb.color
      updateRedactFromEl(tb)
    }
    tb.el.textContent = tb.text
  }
}

function enterEdit(tb) {
  if (tb.kind === 'existing' && !tb.changed) {
    paintRedact(tb)
  }
  tb.editing = true
  tb.el.contentEditable = 'true'
  tb.el.classList.add('editing')
  tb.el.style.color = tb.color
  tb.el.focus()
  const range = document.createRange()
  range.selectNodeContents(tb.el)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
  tb.el.addEventListener('blur', () => exitEdit(tb), { once: true })
}

function startDrag(e, tb) {
  const startX = e.clientX
  const startY = e.clientY
  const origLeft = tb.left
  const origTop = tb.top
  const onMove = (ev) => {
    tb.left = Math.max(0, origLeft + ev.clientX - startX)
    tb.top = Math.max(0, origTop + ev.clientY - startY)
    tb.el.style.left = tb.left + 'px'
    tb.el.style.top = tb.top + 'px'
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function setupBoxEvents(page, tb) {
  const el = tb.el
  el.addEventListener('mousedown', (e) => {
    if (tb.editing || e.target !== el) return
    e.preventDefault()
    e.stopPropagation()
    selectBox(tb)
    if (tb.kind === 'existing') {
      enterEdit(tb)
    } else {
      startDrag(e, tb)
    }
  })
  el.addEventListener('dblclick', (e) => {
    e.preventDefault()
    e.stopPropagation()
    selectBox(tb)
    enterEdit(tb)
  })
}

function addTextbox(page, x, y) {
  const tb = {
    kind: 'new',
    page,
    left: x,
    top: y,
    fontSize: 16,
    color: '#000000',
    text: DEFAULT_TEXT,
    editing: false,
    el: null,
  }
  const el = document.createElement('div')
  el.className = 'textbox textbox-new'
  el.style.left = x + 'px'
  el.style.top = y + 'px'
  el.style.fontSize = tb.fontSize + 'px'
  el.style.color = tb.color
  el.textContent = tb.text
  page.layer.appendChild(el)
  tb.el = el
  page.textboxes.push(tb)
  setupBoxEvents(page, tb)
  selectBox(tb)
  enterEdit(tb)
}

function removeTextbox(page, tb) {
  const idx = page.textboxes.indexOf(tb)
  if (idx === -1) return
  page.textboxes.splice(idx, 1)
  tb.el.remove()
  if (selected === tb) selectBox(null)
}

function deleteSelected() {
  if (!selected || selected.kind === 'existing') return
  for (const page of pages) {
    if (page.textboxes.includes(selected)) {
      removeTextbox(page, selected)
      return
    }
  }
}

function applyProps() {
  if (!selected) return
  const size = parseInt(fontSizeSel.value, 10) || 16
  selected.fontSize = size
  selected.el.style.fontSize = size + 'px'
  selected.color = fontColorInput.value
  selected.el.style.color = selected.color
  if (selected.kind === 'existing' && selected.changed) {
    updateRedactFromEl(selected)
  }
}

function selectPage(i) {
  if (i < 0 || i >= pages.length) return
  activeIndex = i
  pages.forEach((p, idx) => {
    p.wrap.classList.toggle('page-active', idx === i)
    p.thumbItem.classList.toggle('active', idx === i)
  })
  if (selected) selectBox(null)
  stageEl.scrollTop = 0
}

function buildRedactRect(item, scale) {
  const size = item.size
  const ascent = size * 0.8
  const descent = size * 0.22
  const pad = REDACT_PAD * scale
  const x = (item.x0 - REDACT_PAD) * scale
  const y = (item.pageH - item.baseline - ascent - REDACT_PAD) * scale
  const w = (item.widthPts + REDACT_PAD * 2) * scale
  const h = (ascent + descent + REDACT_PAD * 2) * scale
  return { x, y, w, h }
}

function createExistingBox(page, line) {
  const sizePx = line.size * page.scale
  const topPx = (line.pageH - line.baseline - line.size * 0.8) * page.scale
  const leftPx = line.x0 * page.scale

  const tb = {
    kind: 'existing',
    page,
    left: leftPx,
    top: topPx,
    fontSize: sizePx,
    color: '#000000',
    text: line.text,
    origText: line.text,
    editing: false,
    changed: false,
    fontName: line.fontName,
    x0: line.x0,
    baseline: line.baseline,
    sizePts: line.size,
    widthPts: line.widthPts,
    redact: null,
    el: null,
  }
  const el = document.createElement('div')
  el.className = 'textbox textbox-existing'
  el.style.left = leftPx + 'px'
  el.style.top = topPx + 'px'
  el.style.fontSize = sizePx + 'px'
  el.style.lineHeight = '1.2'
  el.style.color = 'transparent'
  el.textContent = tb.text
  page.layer.appendChild(el)
  tb.el = el
  tb.redact = buildRedactRect(line, page.scale)
  page.textboxes.push(tb)
  setupBoxEvents(page, tb)
}

function updateRedactFromEl(tb) {
  const wrap = tb.page.wrap
  const wrapRect = wrap.getBoundingClientRect()
  const elRect = tb.el.getBoundingClientRect()
  const pad = REDACT_PAD * tb.page.scale
  tb.redact = {
    x: elRect.left - wrapRect.left - pad,
    y: elRect.top - wrapRect.top - pad,
    w: elRect.width + pad * 2,
    h: elRect.height + pad * 2,
  }
  paintRedact(tb)
}

function groupTextItems(items, pageH) {
  const usable = items
    .map((it) => {
      const t = it.transform
      if (!t) return null
      const size = Math.abs(t[3])
      if (size < 1) return null
      const str = (it.str || '').replace(/\u00a0/g, ' ')
      if (!str.trim()) return null
      const x0 = t[4]
      const baseline = t[5]
      const widthPts = (it.width * Math.abs(t[0])) / size
      return { x0, baseline, size, widthPts, str, fontName: it.fontName }
    })
    .filter(Boolean)

  usable.sort((a, b) => b.baseline - a.baseline || a.x0 - b.x0)

  const lines = []
  for (const it of usable) {
    const line = lines.find((l) => Math.abs(l.baseline - it.baseline) < it.size * 0.5 && Math.abs(l.size - it.size) < it.size * 0.15)
    if (line) {
      line.widthPts = Math.max(line.widthPts, it.x0 + it.widthPts - line.x0)
      line.text += ' ' + it.str
      line.items.push(it)
    } else {
      lines.push({ x0: it.x0, baseline: it.baseline, size: it.size, widthPts: it.widthPts, text: it.str, fontName: it.fontName, items: [it], pageH })
    }
  }
  return lines
}

async function renderPage(i) {
  const pdfjsPage = await pdfjsDoc.getPage(i + 1)
  const baseViewport = pdfjsPage.getViewport({ scale: 1 })
  const widthPts = baseViewport.width
  const heightPts = baseViewport.height
  const scale = Math.min(STAGE_MAX_WIDTH / widthPts, MAX_ZOOM)
  const viewport = pdfjsPage.getViewport({ scale })

  const canvas = document.createElement('canvas')
  canvas.width = Math.round(viewport.width)
  canvas.height = Math.round(viewport.height)
  canvas.className = 'pdf-canvas'
  const ctx = canvas.getContext('2d')
  await pdfjsPage.render({ canvasContext: ctx, viewport }).promise

  const wrap = document.createElement('div')
  wrap.className = 'pdf-page-wrap'
  wrap.style.width = Math.round(viewport.width) + 'px'
  wrap.style.height = Math.round(viewport.height) + 'px'
  wrap.appendChild(canvas)

  const redactCanvas = document.createElement('canvas')
  redactCanvas.width = canvas.width
  redactCanvas.height = canvas.height
  redactCanvas.className = 'redact-canvas'
  wrap.appendChild(redactCanvas)

  const layer = document.createElement('div')
  layer.className = 'text-layer'
  wrap.appendChild(layer)

  const page = { scale, widthPts, heightPts, layer, textboxes: [], wrap, redactCtx: redactCanvas.getContext('2d') }
  pages.push(page)

  stageEl.appendChild(wrap)

  layer.addEventListener('click', (e) => {
    if (e.target !== layer) return
    const rect = layer.getBoundingClientRect()
    addTextbox(page, e.clientX - rect.left, e.clientY - rect.top)
  })

  const thumbScale = THUMB_WIDTH / widthPts
  const thumbCanvas = document.createElement('canvas')
  thumbCanvas.width = Math.round(widthPts * thumbScale)
  thumbCanvas.height = Math.round(heightPts * thumbScale)
  const tctx = thumbCanvas.getContext('2d')
  tctx.drawImage(canvas, 0, 0, thumbCanvas.width, thumbCanvas.height)

  const thumbItem = document.createElement('div')
  thumbItem.className = 'thumb-item'
  thumbItem.title = 'Page ' + (i + 1)
  thumbItem.appendChild(thumbCanvas)
  const thumbNum = document.createElement('div')
  thumbNum.className = 'thumb-num'
  thumbNum.textContent = 'Page ' + (i + 1)
  thumbItem.appendChild(thumbNum)
  thumbItem.addEventListener('click', () => selectPage(i))
  thumbList.appendChild(thumbItem)
  page.thumbItem = thumbItem

  try {
    const tc = await pdfjsPage.getTextContent()
    const lines = groupTextItems(tc.items, heightPts)
    for (const line of lines) createExistingBox(page, line)
  } catch (err) {
    console.warn('Text detection failed for page ' + (i + 1), err)
  }

  return page
}

async function loadPdf(file) {
  clearError()
  setLoading(true)
  setEditorOpen(false)

  try {
    const data = await file.arrayBuffer()
    pdfjsDoc = await pdfjs.getDocument({ data: data.slice(0) }).promise
    pdfLibDoc = await PDFDocument.load(data)
    originalName = (file.name || 'document.pdf').replace(/\.pdf$/i, '') + '-edited.pdf'
    editorFilename.textContent = file.name || 'document.pdf'
    editorFilename.title = editorFilename.textContent

    if (pdfjsDoc.numPages < 1) throw new Error('This PDF has no pages.')

    loadingText.textContent = 'Rendering ' + pdfjsDoc.numPages + ' page' + (pdfjsDoc.numPages > 1 ? 's' : '') + '…'
    for (let i = 0; i < pdfjsDoc.numPages; i++) {
      await renderPage(i)
      loadingFill.style.width = Math.round(((i + 1) / pdfjsDoc.numPages) * 100) + '%'
    }
    setLoading(false)
    selectPage(0)
    setEditorOpen(true)
  } catch (err) {
    console.error('Failed to load PDF:', err)
    setLoading(false)
    showError(err instanceof Error && err.message ? err.message : 'Could not read this PDF. The file may be corrupted or password-protected.')
  }
}

function resetState() {
  pdfjsDoc = null
  pdfLibDoc = null
  originalName = 'document.pdf'
  pages = []
  selected = null
  activeIndex = 0
  thumbList.innerHTML = ''
  stageEl.innerHTML = ''
  fileInput.value = ''
}

async function exportPdf() {
  if (!pdfLibDoc) return
  downloadBtn.disabled = true
  try {
    const out = await PDFDocument.create()
    const fonts = {}
    const fontCache = async (name) => {
      const key = mapFont(name)
      if (!fonts[key]) fonts[key] = await out.embedFont(key)
      return fonts[key]
    }
    const white = rgb(1, 1, 1)

    for (let i = 0; i < pages.length; i++) {
      const [copied] = await out.copyPages(pdfLibDoc, [i])
      out.addPage(copied)
    }
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      if (!page.textboxes.length) continue
      const outPage = out.getPage(i)
      const pageH = outPage.getHeight()
      const scale = page.scale
      const lineHeight = 1.25

      for (const tb of page.textboxes) {
        const lines = tb.text.split('\n')
        if (tb.kind === 'existing') {
          if (!tb.changed) continue
          const font = await fontCache(tb.fontName)
          const pad = REDACT_PAD
          const ascent = tb.sizePts * 0.8
          const descent = tb.sizePts * 0.22
          outPage.drawRectangle({
            x: tb.x0 - pad,
            y: tb.baseline - descent - pad,
            width: tb.widthPts + pad * 2,
            height: ascent + descent + pad * 2,
            color: white,
          })
          const size = tb.fontSize / scale
          let baseline = tb.baseline
          for (const line of lines) {
            if (line.length) {
              outPage.drawText(line, {
                x: tb.x0,
                y: baseline,
                size,
                font,
                color: hexToRgb(tb.color),
                lineHeight: size * lineHeight,
              })
            }
            baseline -= size * lineHeight
          }
        } else {
          const font = await fontCache(StandardFonts.Helvetica)
          const size = tb.fontSize / scale
          const x = tb.left / scale
          const topPts = tb.top / scale
          let baseline = pageH - topPts - size
          for (const line of lines) {
            if (line.length) {
              outPage.drawText(line, {
                x,
                y: baseline,
                size,
                font,
                color: hexToRgb(tb.color),
                lineHeight: size * lineHeight,
              })
            }
            baseline -= size * lineHeight
          }
        }
      }
    }
    const bytes = await out.save()
    downloadBlob(bytes, originalName)
  } catch (err) {
    console.error('Export failed:', err)
    showError('Could not export the edited PDF. Please try again.')
  } finally {
    downloadBtn.disabled = false
  }
}

function initDropzone() {
  const open = () => fileInput.click()
  dropzone.addEventListener('click', open)
  dropzone.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      open()
    }
  })
  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault()
    dropzone.classList.add('dragover')
  })
  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'))
  dropzone.addEventListener('drop', (e) => {
    e.preventDefault()
    dropzone.classList.remove('dragover')
    const file = e.dataTransfer.files && e.dataTransfer.files[0]
    if (file) loadPdf(file)
  })
  fileInput.addEventListener('change', () => {
    if (fileInput.files && fileInput.files[0]) loadPdf(fileInput.files[0])
  })
}

addTextBtn.addEventListener('click', () => {
  const page = pages[activeIndex]
  if (page) {
    addTextbox(page, Math.round(page.layer.clientWidth / 2) - 40, 30)
  }
})

deleteBtn.addEventListener('click', deleteSelected)
downloadBtn.addEventListener('click', exportPdf)
closeBtn.addEventListener('click', () => {
  setEditorOpen(false)
  document.getElementById('tool').scrollIntoView({ behavior: 'smooth' })
})

fontSizeSel.addEventListener('change', applyProps)
fontColorInput.addEventListener('input', applyProps)

document.addEventListener('keydown', (e) => {
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selected && !selected.editing && document.activeElement !== fontSizeSel && document.activeElement !== fontColorInput) {
      e.preventDefault()
      deleteSelected()
    }
  }
  if (e.key === 'Escape' && selected) {
    selectBox(null)
  }
})

initDropzone()
initNavToggle()
initNavAuth()
document.getElementById('year').textContent = String(new Date().getFullYear())
