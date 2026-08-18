import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'

const dropzone = document.getElementById('dropzone')
const fileInput = document.getElementById('file-input')
const fileListEl = document.getElementById('file-list')
const settingsEl = document.getElementById('resize-settings')
const resizeBtn = document.getElementById('resize-btn')
const progressEl = document.getElementById('progress')
const progressFill = document.getElementById('progress-fill')
const progressText = document.getElementById('progress-text')
const resultsEl = document.getElementById('results')
const resultsList = document.getElementById('results-list')
const downloadAllBtn = document.getElementById('download-all-btn')
const resetBtn = document.getElementById('reset-btn')
const errorBox = document.getElementById('error-box')
const widthInput = document.getElementById('size-width')
const heightInput = document.getElementById('size-height')
const unitSelect = document.getElementById('size-unit')
const lockAspect = document.getElementById('lock-aspect')
const resolutionInput = document.getElementById('resolution')
const qualityInput = document.getElementById('quality')
const qualityValue = document.getElementById('quality-value')
const bgTransparent = document.getElementById('bg-transparent')
const bgColor = document.getElementById('bg-color')
const bgColorOption = document.querySelector('.bg-color-option')

const IMAGE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`

const REMOVE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`

let selectedFiles = []
let results = []
let aspectRef = null
let primary = 'w'

const MAX_CANVAS = 16384

const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' }
const EXT = { jpeg: '.jpg', png: '.png', webp: '.webp' }
const ACCEPTED = /^image\/(jpeg|png|gif|bmp|webp)$/i

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function showError(msg) {
  errorBox.textContent = msg
  errorBox.classList.remove('hidden')
}

function clearError() {
  errorBox.classList.add('hidden')
  errorBox.textContent = ''
}

function resetTool() {
  selectedFiles = []
  results = []
  aspectRef = null
  fileInput.value = ''
  renderFileList()
  settingsEl.classList.add('hidden')
  resultsEl.classList.add('hidden')
  progressEl.classList.add('hidden')
  clearError()
  resizeBtn.disabled = false
}

function renderFileList() {
  fileListEl.innerHTML = ''
  if (selectedFiles.length === 0) {
    settingsEl.classList.add('hidden')
    return
  }
  settingsEl.classList.remove('hidden')

  selectedFiles.forEach((file, index) => {
    const row = document.createElement('div')
    row.className = 'file-row'
    row.innerHTML = `
      <span class="file-icon">${IMAGE_ICON}</span>
      <div class="file-meta">
        <div class="file-name">${escapeHtml(file.name)}</div>
        <div class="file-size">${fmtSize(file.size)}</div>
      </div>
      <button type="button" class="file-remove" data-index="${index}" aria-label="Remove ${escapeHtml(file.name)}">${REMOVE_ICON}</button>
    `
    fileListEl.appendChild(row)
  })

  fileListEl.querySelectorAll('.file-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedFiles.splice(Number(btn.dataset.index), 1)
      renderFileList()
      syncAspectRef()
    })
  })
}

function addFiles(fileList) {
  const images = Array.from(fileList).filter((f) => ACCEPTED.test(f.type) || /\.(jpe?g|png|gif|bmp|webp)$/i.test(f.name))

  if (images.length !== fileList.length) {
    showError('Only JPG, PNG, GIF, BMP and WebP images are allowed. Invalid files were ignored.')
  } else {
    clearError()
  }

  if (images.length === 0) return

  const existingNames = new Set(selectedFiles.map((f) => f.name))
  const unique = images.filter((f) => {
    if (existingNames.has(f.name)) {
      showError(`"${f.name}" was skipped because a file with the same name already exists.`)
      return false
    }
    existingNames.add(f.name)
    return true
  })

  const spaceLeft = 20 - selectedFiles.length
  if (unique.length > spaceLeft) {
    showError(`Only ${spaceLeft} more image(s) can be added (max 20 files).`)
  }
  selectedFiles.push(...unique.slice(0, spaceLeft))
  renderFileList()
  syncAspectRef()
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Could not read "${file.name}". It may be corrupted or unsupported.`))
    }
    img.src = url
  })
}

async function syncAspectRef() {
  if (!selectedFiles.length) {
    aspectRef = null
    return
  }
  try {
    const img = await loadImage(selectedFiles[0])
    aspectRef = { w: img.naturalWidth, h: img.naturalHeight }
    if (unitSelect.value !== 'pct') {
      const dpi = getDpi()
      widthInput.value = roundUnit(pixelsToUnit(aspectRef.w, unitSelect.value, dpi))
      heightInput.value = roundUnit(pixelsToUnit(aspectRef.h, unitSelect.value, dpi))
      primary = 'w'
    }
  } catch (e) {
    aspectRef = null
  }
}

function roundUnit(v) {
  return Math.round(v * 100) / 100
}

function updateHeightFromWidth() {
  const w = parseFloat(widthInput.value)
  if (aspectRef && w > 0) heightInput.value = Math.round((w * aspectRef.h) / aspectRef.w)
}

function updateWidthFromHeight() {
  const h = parseFloat(heightInput.value)
  if (aspectRef && h > 0) widthInput.value = Math.round((h * aspectRef.w) / aspectRef.h)
}

function getSelectedFormat() {
  return document.querySelector('input[name="format"]:checked').value
}

function getSelectedMode() {
  return document.querySelector('input[name="mode"]:checked').value
}

function getDpi() {
  const dpi = parseFloat(resolutionInput.value)
  if (!(dpi > 0)) return 72
  return Math.min(dpi, 2000)
}

function unitToPixels(value, unit, dpi) {
  if (unit === 'in') return value * dpi
  if (unit === 'cm') return (value * dpi) / 2.54
  return value
}

function pixelsToUnit(value, unit, dpi) {
  if (unit === 'in') return value / dpi
  if (unit === 'cm') return (value * 2.54) / dpi
  return value
}

function computeTarget(originalW, originalH) {
  const unit = unitSelect.value
  const lock = lockAspect.checked
  const dpi = getDpi()
  let w = parseFloat(widthInput.value)
  let h = parseFloat(heightInput.value)

  if (unit === 'pct') {
    const pct = (w > 0 ? w : 100) / 100
    return {
      width: Math.max(1, Math.round(originalW * pct)),
      height: Math.max(1, Math.round(originalH * pct))
    }
  }

  if (lock && aspectRef) {
    if (primary === 'w') {
      if (!(w > 0)) return { width: originalW, height: originalH }
      const aspect = originalH / originalW
      const tw = unitToPixels(w, unit, dpi)
      return {
        width: Math.max(1, Math.round(tw)),
        height: Math.max(1, Math.round(tw * aspect))
      }
    }
    if (!(h > 0)) return { width: originalW, height: originalH }
    const aspect = originalW / originalH
    const th = unitToPixels(h, unit, dpi)
    return {
      width: Math.max(1, Math.round(th * aspect)),
      height: Math.max(1, Math.round(th))
    }
  }

  if (!(w > 0)) w = originalW
  if (!(h > 0)) h = originalH
  return {
    width: Math.max(1, Math.round(unitToPixels(w, unit, dpi))),
    height: Math.max(1, Math.round(unitToPixels(h, unit, dpi)))
  }
}

function drawResized(img, target, mode, bgStyle) {
  const canvas = document.createElement('canvas')
  canvas.width = target.width
  canvas.height = target.height
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = bgStyle
  ctx.fillRect(0, 0, target.width, target.height)

  const iw = img.naturalWidth
  const ih = img.naturalHeight

  if (mode === 'stretch') {
    ctx.drawImage(img, 0, 0, target.width, target.height)
    return canvas
  }

  const scale =
    mode === 'crop'
      ? Math.max(target.width / iw, target.height / ih)
      : Math.min(target.width / iw, target.height / ih)

  const dw = iw * scale
  const dh = ih * scale
  const dx = (target.width - dw) / 2
  const dy = (target.height - dh) / 2

  if (mode === 'crop') {
    const sx = (iw - target.width / scale) / 2
    const sy = (ih - target.height / scale) / 2
    ctx.drawImage(img, sx, sy, iw - sx * 2, ih - sy * 2, 0, 0, target.width, target.height)
  } else {
    ctx.drawImage(img, dx, dy, dw, dh)
  }
  return canvas
}

function canvasToBlob(canvas, format, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image.'))),
      MIME[format],
      quality / 100
    )
  })
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c >>> 0
  }
  return table
})()

function crc32(bytes) {
  let crc = 0xffffffff
  for (let i = 0; i < bytes.length; i++) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function setJpegDpi(buffer, dpi) {
  const view = new DataView(buffer)
  if (view.getUint8(0) !== 0xff || view.getUint8(1) !== 0xd8) return buffer

  const insertJfif = () => {
    const jfif = new Uint8Array(18)
    jfif.set([0xff, 0xe0, 0x00, 0x10], 0)
    jfif.set([0x4a, 0x46, 0x49, 0x46, 0x00], 4) // "JFIF\0"
    jfif.set([0x01, 0x01, 0x01], 9) // version 1.1, units = dots per inch
    new DataView(jfif.buffer).setUint16(12, dpi)
    new DataView(jfif.buffer).setUint16(14, dpi)
    const out = new Uint8Array(buffer.byteLength + jfif.length)
    out.set([0xff, 0xd8], 0)
    out.set(jfif, 2)
    out.set(new Uint8Array(buffer, 2), 2 + jfif.length)
    return out.buffer
  }

  // Scan segments after SOI looking for an APP0 JFIF marker
  let offset = 2
  const maxOffset = buffer.byteLength - 4
  while (offset < maxOffset) {
    if (view.getUint8(offset) !== 0xff) break
    const marker = view.getUint8(offset + 1)
    const len = view.getUint16(offset + 2)
    if (marker === 0xe0) {
      // APP0 found
      let isJfif = true
      for (let i = 0; i < 5; i++) {
        if (view.getUint8(offset + 4 + i) !== [0x4a, 0x46, 0x49, 0x46, 0x00][i]) isJfif = false
      }
      if (isJfif) {
        view.setUint8(offset + 11, 1) // units: dots per inch
        view.setUint16(offset + 12, dpi) // Xdensity
        view.setUint16(offset + 14, dpi) // Ydensity
        return buffer
      }
      return insertJfif()
    }
    if (marker === 0xda || marker === 0xd9) break // start of scan / end
    offset += 2 + len
  }
  return insertJfif()
}

function setPngDpi(buffer, dpi) {
  const bytes = new Uint8Array(buffer)
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  for (let i = 0; i < 8; i++) if (bytes[i] !== sig[i]) return buffer

  const ppm = Math.round(dpi / 0.0254) // pixels per meter
  const phyData = new Uint8Array(9)
  new DataView(phyData.buffer).setUint32(0, ppm)
  new DataView(phyData.buffer).setUint32(4, ppm)
  phyData[8] = 1 // unit: meter

  const phyBody = new Uint8Array(13)
  phyBody.set([0x70, 0x48, 0x59, 0x73], 0) // "pHYs"
  phyBody.set(phyData, 4)
  const crc = crc32(phyBody)
  const chunk = new Uint8Array(21)
  new DataView(chunk.buffer).setUint32(0, 9)
  chunk.set(phyBody, 4)
  new DataView(chunk.buffer).setUint32(17, crc)

  // Insert pHYs chunk right after IHDR chunk (type at bytes 12..15)
  const hasIhdr = String.fromCharCode(...bytes.subarray(12, 16)) === 'IHDR'
  const out = new Uint8Array(buffer.byteLength + chunk.length)
  const insertAt = hasIhdr ? 8 + 25 : 8
  out.set(bytes.subarray(0, insertAt), 0)
  out.set(chunk, insertAt)
  out.set(bytes.subarray(insertAt), insertAt + chunk.length)
  return out.buffer
}

async function embedDpi(blob, format, dpi) {
  if (!(dpi >= 1) || format === 'webp') return blob
  try {
    const buffer = await blob.arrayBuffer()
    const withDpi = format === 'jpeg' ? setJpegDpi(buffer, Math.round(dpi)) : setPngDpi(buffer, Math.round(dpi))
    return new Blob([withDpi], { type: MIME[format] })
  } catch (e) {
    return blob
  }
}

function baseName(name) {
  return name.replace(/\.(jpe?g|png|gif|bmp|webp)$/i, '') || 'image'
}

function isTransparentOutput(format) {
  return format !== 'jpeg' && bgTransparent.checked
}

function getBgStyle(format) {
  if (isTransparentOutput(format)) return 'rgba(0,0,0,0)'
  return bgColor.value
}

async function resize() {
  if (selectedFiles.length === 0) return

  clearError()
  resizeBtn.disabled = true
  fileListEl.classList.add('hidden')
  settingsEl.classList.add('hidden')
  progressEl.classList.remove('hidden')
  progressFill.style.width = '0%'

  const format = getSelectedFormat()
  const mode = getSelectedMode()
  const quality = Number(qualityInput.value)
  const dpi = getDpi()
  const bgStyle = getBgStyle(format)
  results = []

  for (let i = 0; i < selectedFiles.length; i++) {
    const file = selectedFiles[i]
    progressText.textContent = `Resizing ${i + 1} of ${selectedFiles.length}…`
    progressFill.style.width = `${Math.round((i / selectedFiles.length) * 100)}%`

    try {
      const img = await loadImage(file)
      const target = computeTarget(img.naturalWidth, img.naturalHeight)

      if (target.width > MAX_CANVAS || target.height > MAX_CANVAS) {
        throw new Error(`"${file.name}" would be too large (${target.width}×${target.height}). Reduce the target size.`)
      }

      const canvas = drawResized(img, target, mode, bgStyle)
      const rawBlob = await canvasToBlob(canvas, format, quality)
      const blob = await embedDpi(rawBlob, format, dpi)
      const outName = baseName(file.name) + EXT[format]
      const originalSize = file.size
      const saved = Math.max(0, originalSize - blob.size)
      const percent = originalSize > 0 ? Math.round((saved / originalSize) * 100) : 0

      results.push({
        blob,
        name: outName,
        originalName: file.name,
        originalSize,
        newSize: blob.size,
        originalSizeText: fmtSize(originalSize),
        newSizeText: fmtSize(blob.size),
        savedPercent: percent,
        notSmaller: blob.size >= originalSize,
        width: target.width,
        height: target.height,
        dpi: format === 'webp' ? null : dpi
      })
    } catch (err) {
      showError(err.message)
    }
  }

  progressText.textContent = 'Resizing…'
  progressFill.style.width = '100%'

  if (results.length === 0) {
    resizeBtn.disabled = false
    progressEl.classList.add('hidden')
    fileListEl.classList.remove('hidden')
    settingsEl.classList.remove('hidden')
    return
  }

  setTimeout(showResults, 250)
}

function showResults() {
  progressEl.classList.add('hidden')
  resultsEl.classList.remove('hidden')
  resultsList.innerHTML = ''

  results.forEach((r, i) => {
    const li = document.createElement('li')
    li.className = 'result-row'
    li.innerHTML = `
      <span class="file-icon">${IMAGE_ICON}</span>
      <div class="result-info">
        <div class="result-name">${escapeHtml(r.name)}</div>
        <div class="result-sizes">
          ${r.originalSizeText} <span class="arrow">→</span> <span class="new-size">${r.newSizeText}</span>
          <span class="result-dims">· ${r.width}×${r.height}px${r.dpi ? ` · ${r.dpi} DPI` : ''}</span>
        </div>
      </div>
      <span class="badge ${r.notSmaller ? 'same' : ''}">${r.notSmaller ? 'Similar size' : r.savedPercent + '% smaller'}</span>
      <button type="button" class="btn btn-primary btn-sm" data-index="${i}">Download</button>
    `
    resultsList.appendChild(li)
  })

  resultsList.querySelectorAll('button[data-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = results[Number(btn.dataset.index)]
      downloadBlob(r.blob, r.name)
    })
  })
}

function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

function triggerAllDownloads() {
  results.forEach((r, i) => {
    setTimeout(() => downloadBlob(r.blob, r.name), i * 250)
  })
}

dropzone.addEventListener('click', (e) => {
  if (e.target.closest('#file-input')) return
  fileInput.click()
})

dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fileInput.click()
  }
})

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files)
  fileInput.value = ''
})

;['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault()
    dropzone.classList.add('dragover')
  })
})

;['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault()
    dropzone.classList.remove('dragover')
  })
})

dropzone.addEventListener('drop', (e) => {
  addFiles(e.dataTransfer.files)
})

widthInput.addEventListener('input', () => {
  if (unitSelect.value !== 'pct' && lockAspect.checked && aspectRef) {
    primary = 'w'
    updateHeightFromWidth()
  }
})

heightInput.addEventListener('input', () => {
  if (unitSelect.value !== 'pct' && lockAspect.checked && aspectRef) {
    primary = 'h'
    updateWidthFromHeight()
  }
})

unitSelect.addEventListener('change', () => {
  if (unitSelect.value === 'pct') {
    widthInput.value = aspectRef ? 50 : 100
    heightInput.value = ''
    heightInput.disabled = true
    widthInput.disabled = false
  } else {
    heightInput.disabled = false
    if (aspectRef) {
      const dpi = getDpi()
      widthInput.value = roundUnit(pixelsToUnit(aspectRef.w, unitSelect.value, dpi))
      heightInput.value = roundUnit(pixelsToUnit(aspectRef.h, unitSelect.value, dpi))
      primary = 'w'
    }
  }
})

resolutionInput.addEventListener('input', () => {
  if (unitSelect.value !== 'pct' && aspectRef) {
    const dpi = getDpi()
    widthInput.value = roundUnit(pixelsToUnit(aspectRef.w, unitSelect.value, dpi))
    heightInput.value = roundUnit(pixelsToUnit(aspectRef.h, unitSelect.value, dpi))
    primary = 'w'
  }
})

lockAspect.addEventListener('change', () => {
  if (unitSelect.value === 'px' && lockAspect.checked && aspectRef) {
    if (primary === 'w') updateHeightFromWidth()
    else updateWidthFromHeight()
  }
})

qualityInput.addEventListener('input', () => {
  qualityValue.textContent = qualityInput.value
})

function syncBgControls() {
  const format = getSelectedFormat()
  bgTransparent.disabled = format === 'jpeg'
  const showColor = format === 'jpeg' || !bgTransparent.checked
  bgColorOption.classList.toggle('hidden', !showColor)
  if (format === 'jpeg') bgTransparent.checked = false
}

document.querySelectorAll('#format-options input').forEach((input) => {
  input.addEventListener('change', syncBgControls)
})

document.querySelectorAll('#mode-options input[name="mode"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('#mode-options .level-pill').forEach((pill) => {
      const inp = pill.querySelector('input')
      pill.classList.toggle('checked', inp.checked)
    })
  })
})

document.querySelectorAll('#format-options input[name="format"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('#format-options .level-pill').forEach((pill) => {
      const inp = pill.querySelector('input')
      pill.classList.toggle('checked', inp.checked)
    })
  })
})

bgTransparent.addEventListener('change', syncBgControls)

resizeBtn.addEventListener('click', resize)
downloadAllBtn.addEventListener('click', triggerAllDownloads)
resetBtn.addEventListener('click', resetTool)

document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
syncBgControls()
