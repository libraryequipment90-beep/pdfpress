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
const undoBtn = document.getElementById('undo-btn')
const redoBtn = document.getElementById('redo-btn')
const boldBtn = document.getElementById('bold-btn')
const italicBtn = document.getElementById('italic-btn')
const underlineBtn = document.getElementById('underline-btn')
const fontSizeSel = document.getElementById('font-size')
const fontColorInput = document.getElementById('font-color')
const shapeBtns = {
  rect: document.getElementById('shape-rect'),
  ellipse: document.getElementById('shape-ellipse'),
  line: document.getElementById('shape-line'),
  arrow: document.getElementById('shape-arrow'),
}

const DEFAULT_TEXT = 'Text'
const STAGE_MAX_WIDTH = 980
const THUMB_WIDTH = 150
const MAX_ZOOM = 1.5
const REDACT_PAD = 1.5
const ASCENT = 0.8
const DESCENT = 0.22
const SVGNS = 'http://www.w3.org/2000/svg'

let pdfjsDoc = null
let pdfLibDoc = null
let originalName = 'document.pdf'
let pages = []
let selected = null
let activeIndex = 0
let placeMode = null
let justDrewShape = false

let history = []
let historyIndex = -1

const FONT_FAMILIES = {
  Helvetica: {
    normal: StandardFonts.Helvetica,
    bold: StandardFonts.HelveticaBold,
    italic: StandardFonts.HelveticaOblique,
    boldItalic: StandardFonts.HelveticaBoldOblique,
  },
  TimesRoman: {
    normal: StandardFonts.TimesRoman,
    bold: StandardFonts.TimesRomanBold,
    italic: StandardFonts.TimesRomanItalic,
    boldItalic: StandardFonts.TimesRomanBoldItalic,
  },
  Courier: {
    normal: StandardFonts.Courier,
    bold: StandardFonts.CourierBold,
    italic: StandardFonts.CourierOblique,
    boldItalic: StandardFonts.CourierBoldOblique,
  },
}

function mapFamily(name) {
  const n = String(name || '')
  if (/courier|liberationmono/i.test(n)) return 'Courier'
  if (/times|liberationserif/i.test(n)) return 'TimesRoman'
  return 'Helvetica'
}

function pickFont(family, bold, italic) {
  const f = FONT_FAMILIES[family] || FONT_FAMILIES.Helvetica
  return bold && italic ? f.boldItalic : bold ? f.bold : italic ? f.italic : f.normal
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

/* ===== Undo / Redo ===== */

function serializeItem(it) {
  if (it.type === 'shape') {
    return {
      type: 'shape',
      shapeType: it.shapeType,
      x1: it.x1,
      y1: it.y1,
      x2: it.x2,
      y2: it.y2,
      strokeColor: it.strokeColor,
      strokeWidth: it.strokeWidth,
    }
  }
  return {
    type: 'text',
    kind: it.kind,
    text: it.text,
    origText: it.origText,
    changed: it.changed,
    fontSize: it.fontSize,
    color: it.color,
    bold: it.bold,
    italic: it.italic,
    underline: it.underline,
    left: it.left,
    top: it.top,
    x0: it.x0,
    baseline: it.baseline,
    sizePts: it.sizePts,
    widthPts: it.widthPts,
    fontName: it.fontName,
  }
}

function captureState() {
  return pages.map((p) => ({ items: p.items.map(serializeItem) }))
}

function commit() {
  history = history.slice(0, historyIndex + 1)
  history.push(captureState())
  if (history.length > 60) history.shift()
  historyIndex = history.length - 1
}

function applyState(state) {
  pages.forEach((page, i) => {
    page.items = []
    page.layer.innerHTML = ''
    page.redactCtx.clearRect(0, 0, page.redactCtx.canvas.width, page.redactCtx.canvas.height)
    for (const it of state[i].items) {
      if (it.type === 'shape') rebuildShape(page, it)
      else rebuildText(page, it)
    }
  })
  if (selected) selectBox(null)
}

function undo() {
  if (historyIndex > 0) {
    historyIndex--
    applyState(history[historyIndex])
  }
}

function redo() {
  if (historyIndex < history.length - 1) {
    historyIndex++
    applyState(history[historyIndex])
  }
}

/* ===== Selection ===== */

function selectBox(tb) {
  if (selected && selected.el) selected.el.classList.remove('selected')
  selected = tb
  if (tb) {
    tb.el.classList.add('selected')
    if (tb.type === 'text') {
      fontSizeSel.value = String(tb.fontSize)
      fontColorInput.value = tb.color
      boldBtn.classList.toggle('active', !!tb.bold)
      italicBtn.classList.toggle('active', !!tb.italic)
      underlineBtn.classList.toggle('active', !!tb.underline)
      deleteBtn.disabled = tb.kind === 'existing'
    } else {
      fontColorInput.value = tb.strokeColor
      deleteBtn.disabled = false
    }
  } else {
    deleteBtn.disabled = true
  }
  updateShapeHandles()
}

function updateShapeHandles() {
  pages.forEach((p) => p.items.forEach((it) => {
    if (it.type === 'shape' && it.el) it.el.classList.toggle('selected', it === selected)
  }))
}

/* ===== Redaction ===== */

function redactRectFor(item) {
  const scale = item.page ? item.page.scale : 1
  const pad = REDACT_PAD * scale
  const ascent = item.sizePts * ASCENT
  const descent = item.sizePts * DESCENT
  return {
    x: (item.x0 - REDACT_PAD) * scale,
    y: (item.pageH - item.baseline - ascent - REDACT_PAD) * scale,
    w: (item.widthPts + REDACT_PAD * 2) * scale,
    h: (ascent + descent + REDACT_PAD * 2) * scale,
  }
}

function paintRedact(page, item) {
  const r = item.redact || redactRectFor({ ...item, page })
  item.redact = r
  page.redactCtx.save()
  page.redactCtx.fillStyle = '#ffffff'
  page.redactCtx.fillRect(r.x, r.y, r.w, r.h)
  page.redactCtx.restore()
}

function eraseRedact(page, item) {
  if (!item.redact) return
  page.redactCtx.save()
  page.redactCtx.globalCompositeOperation = 'destination-out'
  page.redactCtx.fillRect(item.redact.x, item.redact.y, item.redact.w, item.redact.h)
  page.redactCtx.restore()
}

function repaintRedactions(page) {
  page.redactCtx.clearRect(0, 0, page.redactCtx.canvas.width, page.redactCtx.canvas.height)
  for (const it of page.items) {
    if (it.type === 'text' && it.kind === 'existing' && it.changed) {
      it.redact = null
      paintRedact(page, it)
    }
  }
}

function updateRedactFromEl(page, it) {
  const wrapRect = page.wrap.getBoundingClientRect()
  const elRect = it.el.getBoundingClientRect()
  const pad = REDACT_PAD * page.scale
  it.redact = {
    x: elRect.left - wrapRect.left - pad,
    y: elRect.top - wrapRect.top - pad,
    w: elRect.width + pad * 2,
    h: elRect.height + pad * 2,
  }
  eraseRedact(page, it)
  paintRedact(page, it)
}

/* ===== Text boxes ===== */

function exitEdit(it) {
  if (!it.editing) return
  it.editing = false
  it.el.contentEditable = 'false'
  it.el.classList.remove('editing')
  const raw = (it.el.innerText || '').replace(/\u00a0/g, ' ').replace(/^\n+|\n+$/g, '')
  const newText = raw.length ? raw : ' '

  if (it.kind === 'existing') {
    const didChange = newText !== it.origText
    if (!didChange) {
      it.text = newText
      it.changed = false
      it.el.style.color = 'transparent'
      it.el.textContent = it.text
      repaintRedactions(it.page)
      selectBox(it)
      return
    }
    it.text = newText
    it.changed = true
    it.el.style.color = it.color
    it.el.textContent = it.text
    updateRedactFromEl(it.page, it)
    commit()
    return
  }

  if (newText === it.text) return
  it.text = newText
  commit()
}

function enterEdit(it) {
  it.editing = true
  it.el.contentEditable = 'true'
  it.el.classList.add('editing')
  it.el.style.color = it.color
  it.el.focus()
  const range = document.createRange()
  range.selectNodeContents(it.el)
  const sel = window.getSelection()
  sel.removeAllRanges()
  sel.addRange(range)
  it.el.addEventListener('blur', () => exitEdit(it), { once: true })
}

function startDrag(e, it, update, onUp) {
  const startX = e.clientX
  const startY = e.clientY
  const onMove = (ev) => {
    update(ev.clientX - startX, ev.clientY - startY)
  }
  const done = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', done)
    if (onUp) onUp()
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', done)
}

function applyTextStyle(it) {
  const el = it.el
  el.style.fontWeight = it.bold ? '700' : '400'
  el.style.fontStyle = it.italic ? 'italic' : 'normal'
  el.style.textDecoration = it.underline ? 'underline' : 'none'
}

function createTextEl(page, it) {
  const el = document.createElement('div')
  el.className = 'textbox textbox-' + it.kind
  el.style.left = it.left + 'px'
  el.style.top = it.top + 'px'
  el.style.fontSize = it.fontSize + 'px'
  el.style.color = it.kind === 'existing' && !it.changed ? 'transparent' : it.color
  el.textContent = it.text
  page.layer.appendChild(el)
  it.el = el
  it.page = page
  applyTextStyle(it)

  el.addEventListener('mousedown', (e) => {
    if (it.editing || e.target !== el) return
    e.preventDefault()
    e.stopPropagation()
    selectBox(it)
    if (it.kind === 'existing') {
      enterEdit(it)
    } else {
      const origLeft = it.left
      const origTop = it.top
      startDrag(e, it, (dx, dy) => {
        it.left = Math.max(0, origLeft + dx)
        it.top = Math.max(0, origTop + dy)
        it.el.style.left = it.left + 'px'
        it.el.style.top = it.top + 'px'
      }, () => commit())
    }
  })
  el.addEventListener('dblclick', (e) => {
    e.preventDefault()
    e.stopPropagation()
    selectBox(it)
    enterEdit(it)
  })
  return el
}

function addTextbox(page, x, y) {
  const it = {
    type: 'text',
    kind: 'new',
    left: x,
    top: y,
    fontSize: 16,
    color: '#000000',
    text: DEFAULT_TEXT,
    origText: DEFAULT_TEXT,
    changed: false,
    bold: false,
    italic: false,
    underline: false,
    editing: false,
  }
  page.items.push(it)
  createTextEl(page, it)
  commit()
  selectBox(it)
  enterEdit(it)
}

function rebuildText(page, it) {
  const copy = { ...it }
  page.items.push(copy)
  createTextEl(page, copy)
  if (copy.kind === 'existing') {
    copy.redact = null
    if (copy.changed) paintRedact(page, copy)
  }
}

function rebuildShape(page, it) {
  const copy = { ...it }
  page.items.push(copy)
  createShapeEl(page, copy)
}

function deleteSelected() {
  if (!selected || selected.kind === 'existing') return
  for (const page of pages) {
    const idx = page.items.indexOf(selected)
    if (idx !== -1) {
      page.items.splice(idx, 1)
      selected.el.remove()
      selectBox(null)
      commit()
      return
    }
  }
}

function applyProps() {
  if (!selected || selected.type !== 'text') return
  const size = parseInt(fontSizeSel.value, 10) || 16
  selected.fontSize = size
  selected.el.style.fontSize = size + 'px'
  selected.color = fontColorInput.value
  selected.el.style.color = selected.color
  commit()
}

function toggleFormat(which) {
  if (!selected || selected.type !== 'text') return
  selected[which] = !selected[which]
  applyTextStyle(selected)
  selectBox(selected)
  commit()
}

/* ===== Shapes ===== */

function setPlaceMode(mode) {
  placeMode = placeMode === mode ? null : mode
  Object.entries(shapeBtns).forEach(([k, btn]) => btn.classList.toggle('active', k === placeMode))
}

function createShapeEl(page, shape) {
  const el = document.createElement('div')
  el.className = 'shape-el shape-' + shape.shapeType
  page.layer.appendChild(el)
  shape.el = el
  shape.page = page
  shape.handles = document.createElement('div')
  shape.handles.className = 'shape-handles'
  for (const pos of ['se', 'nw', 'ne', 'sw']) {
    const h = document.createElement('span')
    h.className = 'shape-handle shape-handle-' + pos
    shape.handles.appendChild(h)
  }
  updateShapeEl(shape)
  setupShapeEvents(shape)
  return el
}

function updateShapeEl(shape) {
  const el = shape.el
  const left = Math.min(shape.x1, shape.x2)
  const top = Math.min(shape.y1, shape.y2)
  const w = Math.abs(shape.x2 - shape.x1) || 1
  const h = Math.abs(shape.y2 - shape.y1) || 1
  el.style.left = left + 'px'
  el.style.top = top + 'px'
  el.style.width = w + 'px'
  el.style.height = h + 'px'

  if (shape.shapeType === 'line' || shape.shapeType === 'arrow') {
    el.innerHTML = ''
    const svg = document.createElementNS(SVGNS, 'svg')
    svg.setAttribute('width', '100%')
    svg.setAttribute('height', '100%')
    svg.style.overflow = 'visible'
    const line = document.createElementNS(SVGNS, 'line')
    line.setAttribute('x1', shape.x1 - left)
    line.setAttribute('y1', shape.y1 - top)
    line.setAttribute('x2', shape.x2 - left)
    line.setAttribute('y2', shape.y2 - top)
    line.setAttribute('stroke', shape.strokeColor)
    line.setAttribute('stroke-width', String(shape.strokeWidth))
    svg.appendChild(line)
    if (shape.shapeType === 'arrow') {
      const ang = Math.atan2(shape.y2 - shape.y1, shape.x2 - shape.x1)
      const len = shape.strokeWidth * 5
      for (const off of [0.45, -0.45]) {
        const l2 = document.createElementNS(SVGNS, 'line')
        l2.setAttribute('x1', shape.x2 - left)
        l2.setAttribute('y1', shape.y2 - top)
        l2.setAttribute('x2', (shape.x2 - left) - len * Math.cos(ang + off))
        l2.setAttribute('y2', (shape.y2 - top) - len * Math.sin(ang + off))
        l2.setAttribute('stroke', shape.strokeColor)
        l2.setAttribute('stroke-width', String(shape.strokeWidth))
        svg.appendChild(l2)
      }
    }
    el.appendChild(svg)
  } else {
    el.style.border = shape.strokeWidth + 'px solid ' + shape.strokeColor
    el.style.borderRadius = shape.shapeType === 'ellipse' ? '50%' : '0'
  }
  if (!shape.handles.parentNode) el.appendChild(shape.handles)
}

function setupShapeEvents(shape) {
  const el = shape.el
  el.addEventListener('mousedown', (e) => {
    if (e.target.classList.contains('shape-handle')) return
    e.preventDefault()
    e.stopPropagation()
    selectBox(shape)
    const dx0 = shape.x1
    const dy0 = shape.y1
    const dx1 = shape.x2
    const dy1 = shape.y2
    startDrag(e, shape, (dx, dy) => {
      shape.x1 = dx0 + dx
      shape.y1 = dy0 + dy
      shape.x2 = dx1 + dx
      shape.y2 = dy1 + dy
      updateShapeEl(shape)
    }, () => commit())
  })
  el.addEventListener('dblclick', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  el.querySelectorAll('.shape-handle').forEach((handle) => {
    handle.addEventListener('mousedown', (e) => {
      e.preventDefault()
      e.stopPropagation()
      selectBox(shape)
      const cls = Array.from(handle.classList).find((c) => c.startsWith('shape-handle-'))
      const which = cls.replace('shape-handle-', '')
      startShapeResize(shape, which, e)
    })
  })
}

function startShapeResize(shape, handle, e) {
  const startX = e.clientX
  const startY = e.clientY
  const rect = shape.page.layer.getBoundingClientRect()
  const anchorX = handle.includes('w') ? shape.x2 : shape.x1
  const anchorY = handle.includes('n') ? shape.y2 : shape.y1
  const onMove = (ev) => {
    const mx = ev.clientX - rect.left
    const my = ev.clientY - rect.top
    shape.x1 = handle.includes('w') ? mx : anchorX
    shape.y1 = handle.includes('n') ? my : anchorY
    shape.x2 = handle.includes('e') ? mx : anchorX
    shape.y2 = handle.includes('s') ? my : anchorY
    updateShapeEl(shape)
  }
  const onUp = () => {
    document.removeEventListener('mousemove', onMove)
    document.removeEventListener('mouseup', onUp)
    commit()
  }
  document.addEventListener('mousemove', onMove)
  document.addEventListener('mouseup', onUp)
}

function addShape(page, mode, x1, y1, x2, y2) {
  const shape = {
    type: 'shape',
    shapeType: mode,
    x1,
    y1,
    x2,
    y2,
    strokeColor: fontColorInput.value,
    strokeWidth: 2,
  }
  page.items.push(shape)
  createShapeEl(page, shape)
  commit()
  selectBox(shape)
}

/* ===== Page rendering ===== */

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

function groupTextItems(items, pageH) {
  const usable = items
    .map((it) => {
      const t = it.transform
      if (!t) return null
      const size = Math.abs(t[3])
      if (size < 1) return null
      const str = (it.str || '').replace(/\u00a0/g, ' ')
      if (!str.trim()) return null
      return {
        x0: t[4],
        baseline: t[5],
        size,
        widthPts: (it.width * Math.abs(t[0])) / size,
        str,
        fontName: it.fontName,
      }
    })
    .filter(Boolean)

  usable.sort((a, b) => b.baseline - a.baseline || a.x0 - b.x0)

  const lines = []
  for (const it of usable) {
    const line = lines.find((l) => Math.abs(l.baseline - it.baseline) < it.size * 0.5 && Math.abs(l.size - it.size) < it.size * 0.15)
    if (line) {
      line.widthPts = Math.max(line.widthPts, it.x0 + it.widthPts - line.x0)
      line.text += ' ' + it.str
    } else {
      lines.push({ x0: it.x0, baseline: it.baseline, size: it.size, widthPts: it.widthPts, text: it.str, fontName: it.fontName, pageH })
    }
  }
  return lines
}

function createExistingBox(page, line) {
  const sizePx = line.size * page.scale
  const topPx = (line.pageH - line.baseline - line.size * ASCENT) * page.scale
  const leftPx = line.x0 * page.scale

  const it = {
    type: 'text',
    kind: 'existing',
    left: leftPx,
    top: topPx,
    fontSize: sizePx,
    color: '#000000',
    text: line.text,
    origText: line.text,
    changed: false,
    bold: false,
    italic: false,
    underline: false,
    editing: false,
    fontName: line.fontName,
    x0: line.x0,
    baseline: line.baseline,
    sizePts: line.size,
    widthPts: line.widthPts,
    pageH: line.pageH,
  }
  page.items.push(it)
  createTextEl(page, it)
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

  const page = {
    scale,
    widthPts,
    heightPts,
    layer,
    items: [],
    wrap,
    redactCtx: redactCanvas.getContext('2d'),
  }
  pages.push(page)

  stageEl.appendChild(wrap)

  layer.addEventListener('click', (e) => {
    if (e.target !== layer || placeMode || justDrewShape) return
    const rect = layer.getBoundingClientRect()
    addTextbox(page, e.clientX - rect.left, e.clientY - rect.top)
  })

  layer.addEventListener('mousedown', (e) => {
    if (!placeMode || e.target !== layer) return
    e.preventDefault()
    const rect = layer.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const anchorX = mx
    const anchorY = my
    let endX = mx
    let endY = my
    const shape = {
      type: 'shape',
      shapeType: placeMode,
      x1: anchorX,
      y1: anchorY,
      x2: endX,
      y2: endY,
      strokeColor: fontColorInput.value,
      strokeWidth: 2,
    }
    page.items.push(shape)
    createShapeEl(page, shape)
    const onMove = (ev) => {
      endX = ev.clientX - rect.left
      endY = ev.clientY - rect.top
      shape.x2 = endX
      shape.y2 = endY
      updateShapeEl(shape)
    }
    const onUp = () => {
      document.removeEventListener('mousemove', onMove)
      document.removeEventListener('mouseup', onUp)
      setPlaceMode(null)
      justDrewShape = true
      setTimeout(() => { justDrewShape = false }, 0)
      commit()
      selectBox(shape)
    }
    document.addEventListener('mousemove', onMove)
    document.addEventListener('mouseup', onUp)
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
    commit()
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
  placeMode = null
  justDrewShape = false
  history = []
  historyIndex = -1
  thumbList.innerHTML = ''
  stageEl.innerHTML = ''
  fileInput.value = ''
  Object.values(shapeBtns).forEach((b) => b.classList.remove('active'))
}

/* ===== Export ===== */

async function exportPdf() {
  if (!pdfLibDoc) return
  downloadBtn.disabled = true
  try {
    const out = await PDFDocument.create()
    const fontCache = {}
    const getFont = async (family, bold, italic) => {
      const std = pickFont(family, bold, italic)
      if (!fontCache[std]) fontCache[std] = await out.embedFont(std)
      return fontCache[std]
    }
    const white = rgb(1, 1, 1)

    for (let i = 0; i < pages.length; i++) {
      const [copied] = await out.copyPages(pdfLibDoc, [i])
      out.addPage(copied)
    }
    for (let i = 0; i < pages.length; i++) {
      const page = pages[i]
      if (!page.items.length) continue
      const outPage = out.getPage(i)
      const pageH = outPage.getHeight()
      const scale = page.scale
      const lineHeight = 1.25

      for (const it of page.items) {
        if (it.type === 'shape') {
          exportShape(outPage, it, scale, pageH)
          continue
        }
        const lines = it.text.split('\n')
        if (it.kind === 'existing') {
          if (!it.changed) continue
          const family = mapFamily(it.fontName)
          const font = await getFont(family, it.bold, it.italic)
          const pad = REDACT_PAD
          const ascent = it.sizePts * ASCENT
          const descent = it.sizePts * DESCENT
          outPage.drawRectangle({
            x: it.x0 - pad,
            y: it.baseline - descent - pad,
            width: it.widthPts + pad * 2,
            height: ascent + descent + pad * 2,
            color: white,
          })
          const size = it.fontSize / scale
          let baseline = it.baseline
          for (const line of lines) {
            if (line.length) {
              outPage.drawText(line, { x: it.x0, y: baseline, size, font, color: hexToRgb(it.color), lineHeight: size * lineHeight })
              if (it.underline) {
                const w = font.widthOfTextAtSize(line, size)
                outPage.drawLine({
                  start: { x: it.x0, y: baseline - size * 0.12 },
                  end: { x: it.x0 + w, y: baseline - size * 0.12 },
                  thickness: Math.max(0.7, size * 0.05),
                  color: hexToRgb(it.color),
                })
              }
            }
            baseline -= size * lineHeight
          }
        } else {
          const family = mapFamily(it.fontName)
          const font = await getFont(family, it.bold, it.italic)
          const size = it.fontSize / scale
          const x = it.left / scale
          const topPts = it.top / scale
          let baseline = pageH - topPts - size
          for (const line of lines) {
            if (line.length) {
              outPage.drawText(line, { x, y: baseline, size, font, color: hexToRgb(it.color), lineHeight: size * lineHeight })
              if (it.underline) {
                const w = font.widthOfTextAtSize(line, size)
                outPage.drawLine({
                  start: { x, y: baseline - size * 0.12 },
                  end: { x: x + w, y: baseline - size * 0.12 },
                  thickness: Math.max(0.7, size * 0.05),
                  color: hexToRgb(it.color),
                })
              }
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

function exportShape(outPage, shape, scale, pageH) {
  const p1 = { x: shape.x1 / scale, y: pageH - shape.y1 / scale }
  const p2 = { x: shape.x2 / scale, y: pageH - shape.y2 / scale }
  const color = hexToRgb(shape.strokeColor)
  const thickness = shape.strokeWidth / scale
  if (shape.shapeType === 'rect') {
    outPage.drawRectangle({
      x: Math.min(p1.x, p2.x),
      y: Math.min(p1.y, p2.y),
      width: Math.abs(p2.x - p1.x),
      height: Math.abs(p2.y - p1.y),
      borderColor: color,
      borderWidth: thickness,
    })
  } else if (shape.shapeType === 'ellipse') {
    outPage.drawEllipse({
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      xScale: Math.abs(p2.x - p1.x) / 2,
      yScale: Math.abs(p2.y - p1.y) / 2,
      borderColor: color,
      borderWidth: thickness,
    })
  } else {
    outPage.drawLine({ start: p1, end: p2, thickness, color })
    if (shape.shapeType === 'arrow') {
      const ang = Math.atan2(p2.y - p1.y, p2.x - p1.x)
      const len = thickness * 5
      for (const off of [0.45, -0.45]) {
        outPage.drawLine({
          start: p2,
          end: { x: p2.x - len * Math.cos(ang + off), y: p2.y - len * Math.sin(ang + off) },
          thickness,
          color,
        })
      }
    }
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
undoBtn.addEventListener('click', undo)
redoBtn.addEventListener('click', redo)
closeBtn.addEventListener('click', () => {
  setEditorOpen(false)
  document.getElementById('tool').scrollIntoView({ behavior: 'smooth' })
})

boldBtn.addEventListener('click', () => toggleFormat('bold'))
italicBtn.addEventListener('click', () => toggleFormat('italic'))
underlineBtn.addEventListener('click', () => toggleFormat('underline'))

fontSizeSel.addEventListener('change', applyProps)
fontColorInput.addEventListener('change', applyProps)
fontColorInput.addEventListener('input', () => {
  if (selected && selected.type === 'text') {
    selected.color = fontColorInput.value
    selected.el.style.color = selected.color
  } else if (selected && selected.type === 'shape') {
    selected.strokeColor = fontColorInput.value
    updateShapeEl(selected)
  }
})

Object.entries(shapeBtns).forEach(([mode, btn]) => {
  btn.addEventListener('click', () => setPlaceMode(mode))
})

document.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey
  if (mod && e.key === 'z') {
    e.preventDefault()
    if (e.shiftKey) redo()
    else undo()
    return
  }
  if (mod && e.key === 'y') {
    e.preventDefault()
    redo()
    return
  }
  if (mod && e.key === 'b') {
    if (selected && selected.type === 'text') {
      e.preventDefault()
      toggleFormat('bold')
    }
    return
  }
  if (mod && e.key === 'i') {
    if (selected && selected.type === 'text') {
      e.preventDefault()
      toggleFormat('italic')
    }
    return
  }
  if (mod && e.key === 'u') {
    if (selected && selected.type === 'text') {
      e.preventDefault()
      toggleFormat('underline')
    }
    return
  }
  if (e.key === 'Delete' || e.key === 'Backspace') {
    if (selected && !selected.editing && document.activeElement !== fontSizeSel && document.activeElement !== fontColorInput) {
      e.preventDefault()
      deleteSelected()
    }
  }
  if (e.key === 'Escape') {
    if (placeMode) setPlaceMode(null)
    if (selected) {
      if (selected.editing) exitEdit(selected)
      selectBox(null)
    }
  }
})

initDropzone()
initNavToggle()
initNavAuth()
document.getElementById('year').textContent = String(new Date().getFullYear())
