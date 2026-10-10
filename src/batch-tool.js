import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'
import {
  IMAGE_ICON,
  ACCEPTED_IMAGE,
  IMAGE_EXT,
  MAX_FILES,
  MAX_CANVAS,
  EXT,
  loadImage,
  canvasToBlob,
  imageToCanvas,
  bindDropzone,
  bindPills,
  filterFiles,
  uniquePush,
  renderFileRows,
  renderResults,
  sizeBadge,
  makeResult,
  triggerAllDownloads,
  baseName
} from './image-utils.js'

const tool = document.body.dataset.tool || 'convert'
const dropzone = document.getElementById('dropzone')
const fileInput = document.getElementById('file-input')
const fileListEl = document.getElementById('file-list')
const settingsEl = document.getElementById('tool-settings')
const runBtn = document.getElementById('run-btn')
const progressEl = document.getElementById('progress')
const progressFill = document.getElementById('progress-fill')
const progressText = document.getElementById('progress-text')
const resultsEl = document.getElementById('results')
const resultsList = document.getElementById('results-list')
const downloadAllBtn = document.getElementById('download-all-btn')
const resetBtn = document.getElementById('reset-btn')
const errorBox = document.getElementById('error-box')
const qualityInput = document.getElementById('quality')
const qualityValue = document.getElementById('quality-value')

let selectedFiles = []
let results = []

function showError(msg) {
  errorBox.textContent = msg
  errorBox.classList.remove('hidden')
}

function clearError() {
  errorBox.classList.add('hidden')
  errorBox.textContent = ''
}

function getFormat() {
  const el = document.querySelector('input[name="format"]:checked')
  return el ? el.value : 'jpeg'
}

function getQuality() {
  return qualityInput ? Number(qualityInput.value) : 90
}

function resetTool() {
  selectedFiles = []
  results = []
  fileInput.value = ''
  renderList()
  resultsEl.classList.add('hidden')
  progressEl.classList.add('hidden')
  clearError()
  runBtn.disabled = false
}

function renderList() {
  renderFileRows(fileListEl, selectedFiles, IMAGE_ICON, (i) => {
    selectedFiles.splice(i, 1)
    renderList()
  })
  if (selectedFiles.length === 0) settingsEl.classList.add('hidden')
  else settingsEl.classList.remove('hidden')
}

function addFiles(fileList) {
  const images = filterFiles(
    fileList,
    (f) => ACCEPTED_IMAGE.test(f.type) || IMAGE_EXT.test(f.name),
    'Only JPG, PNG, GIF, BMP, WebP and SVG images are allowed. Invalid files were ignored.',
    showError,
    clearError
  )
  if (!images.length) return
  uniquePush(selectedFiles, images, MAX_FILES, showError)
  renderList()
}

function drawFlip(img, dir) {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (dir === 'horizontal') {
    ctx.translate(w, 0)
    ctx.scale(-1, 1)
  } else {
    ctx.translate(0, h)
    ctx.scale(1, -1)
  }
  ctx.drawImage(img, 0, 0)
  return canvas
}

function drawRotate(img, deg) {
  const w = img.naturalWidth
  const h = img.naturalHeight
  const rad = (deg * Math.PI) / 180
  const swap = deg === 90 || deg === 270
  const canvas = document.createElement('canvas')
  canvas.width = swap ? h : w
  canvas.height = swap ? w : h
  const ctx = canvas.getContext('2d')
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate(rad)
  ctx.drawImage(img, -w / 2, -h / 2)
  return canvas
}

function drawEnlarge(img, factor) {
  const w = Math.round(img.naturalWidth * factor)
  const h = Math.round(img.naturalHeight * factor)
  if (w > MAX_CANVAS || h > MAX_CANVAS) {
    throw new Error(`Result would be too large (${w}×${h}). Choose a smaller scale.`)
  }
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

async function processFile(file) {
  const img = await loadImage(file)
  const format = getFormat()
  const quality = getQuality()
  let canvas
  let suffix = ''

  if (tool === 'compress') {
    canvas = imageToCanvas(img, format === 'jpeg' ? '#ffffff' : null)
    suffix = '-compressed'
  } else if (tool === 'convert') {
    canvas = imageToCanvas(img, format === 'jpeg' ? '#ffffff' : null)
    suffix = ''
  } else if (tool === 'flip') {
    const dir = document.querySelector('input[name="flip"]:checked').value
    canvas = drawFlip(img, dir)
    suffix = '-flipped'
  } else if (tool === 'rotate') {
    const deg = Number(document.querySelector('input[name="rotate"]:checked').value)
    canvas = drawRotate(img, deg)
    suffix = '-rotated'
  } else if (tool === 'enlarge') {
    const factor = Number(document.querySelector('input[name="scale"]:checked').value)
    canvas = drawEnlarge(img, factor)
    suffix = `-${factor}x`
  } else {
    canvas = imageToCanvas(img, format === 'jpeg' ? '#ffffff' : null)
  }

  const blob = await canvasToBlob(canvas, format, quality)
  const name = baseName(file.name) + suffix + EXT[format]
  const meta = `${canvas.width}×${canvas.height}px`
  return makeResult(blob, name, file.size, meta)
}

async function run() {
  if (!selectedFiles.length) return
  clearError()
  runBtn.disabled = true
  fileListEl.classList.add('hidden')
  settingsEl.classList.add('hidden')
  progressEl.classList.remove('hidden')
  progressFill.style.width = '0%'
  results = []

  for (let i = 0; i < selectedFiles.length; i++) {
    progressText.textContent = `Processing ${i + 1} of ${selectedFiles.length}…`
    progressFill.style.width = `${Math.round((i / selectedFiles.length) * 100)}%`
    try {
      results.push(await processFile(selectedFiles[i]))
    } catch (err) {
      showError(err.message)
    }
  }

  progressFill.style.width = '100%'
  if (!results.length) {
    runBtn.disabled = false
    progressEl.classList.add('hidden')
    fileListEl.classList.remove('hidden')
    settingsEl.classList.remove('hidden')
    return
  }

  progressEl.classList.add('hidden')
  resultsEl.classList.remove('hidden')
  renderResults(resultsList, results, IMAGE_ICON, sizeBadge)
}

bindDropzone(dropzone, fileInput, addFiles)
bindPills('#format-options')
bindPills('#flip-options')
bindPills('#rotate-options')
bindPills('#scale-options')
if (qualityInput && qualityValue) {
  qualityInput.addEventListener('input', () => {
    qualityValue.textContent = qualityInput.value
  })
}
runBtn.addEventListener('click', run)
downloadAllBtn.addEventListener('click', () => triggerAllDownloads(results))
resetBtn.addEventListener('click', resetTool)
document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
