import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'
import {
  ACCEPTED_IMAGE,
  IMAGE_EXT,
  EXT,
  MAX_FILES,
  loadImage,
  canvasToBlob,
  downloadBlob,
  bindDropzone,
  bindPills,
  uniquePush,
  renderFileRows,
  IMAGE_ICON
} from './image-utils.js'

const dropzone = document.getElementById('dropzone')
const fileInput = document.getElementById('file-input')
const fileListEl = document.getElementById('file-list')
const settingsEl = document.getElementById('tool-settings')
const preview = document.getElementById('preview-canvas')
const runBtn = document.getElementById('run-btn')
const resetBtn = document.getElementById('reset-btn')
const errorBox = document.getElementById('error-box')
const pctx = preview.getContext('2d')

let selectedFiles = []

function showError(msg) {
  errorBox.textContent = msg
  errorBox.classList.remove('hidden')
}

function clearError() {
  errorBox.classList.add('hidden')
}

function layout() {
  const v = document.querySelector('input[name="grid"]:checked')?.value || '2x2'
  const [cols, rows] = v.split('x').map(Number)
  return { cols, rows, cells: cols * rows }
}

function cover(ctx, img, x, y, w, h) {
  const ir = img.naturalWidth / img.naturalHeight
  const cr = w / h
  let dw = w
  let dh = h
  let sx = 0
  let sy = 0
  let sw = img.naturalWidth
  let sh = img.naturalHeight
  if (ir > cr) {
    sw = img.naturalHeight * cr
    sx = (img.naturalWidth - sw) / 2
  } else {
    sh = img.naturalWidth / cr
    sy = (img.naturalHeight - sh) / 2
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, dw, dh)
}

async function compose(size) {
  const { cols, rows, cells } = layout()
  const gap = Number(document.getElementById('gap').value)
  const bg = document.getElementById('bg').value || '#ffffff'
  const files = selectedFiles.slice(0, cells)
  const images = await Promise.all(files.map(loadImage))
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = Math.round(size * (rows / cols))
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  const cellW = (canvas.width - gap * (cols + 1)) / cols
  const cellH = (canvas.height - gap * (rows + 1)) / rows
  for (let i = 0; i < images.length; i++) {
    const c = i % cols
    const r = Math.floor(i / cols)
    const x = gap + c * (cellW + gap)
    const y = gap + r * (cellH + gap)
    cover(ctx, images[i], x, y, cellW, cellH)
  }
  return canvas
}

async function render() {
  if (!selectedFiles.length) return
  const canvas = await compose(720)
  preview.width = canvas.width
  preview.height = canvas.height
  pctx.clearRect(0, 0, preview.width, preview.height)
  pctx.drawImage(canvas, 0, 0)
}

function renderList() {
  renderFileRows(fileListEl, selectedFiles, IMAGE_ICON, (i) => {
    selectedFiles.splice(i, 1)
    renderList()
    if (!selectedFiles.length) {
      settingsEl.classList.add('hidden')
      dropzone.classList.remove('hidden')
    } else render()
  })
  if (selectedFiles.length) {
    settingsEl.classList.remove('hidden')
    render()
  }
}

function addFiles(list) {
  const images = Array.from(list).filter((f) => ACCEPTED_IMAGE.test(f.type) || IMAGE_EXT.test(f.name))
  if (images.length !== list.length) showError('Only JPG, PNG, GIF, BMP, WebP and SVG images are allowed.')
  else clearError()
  if (!images.length) return
  uniquePush(selectedFiles, images, MAX_FILES, showError)
  renderList()
}

async function download() {
  if (!selectedFiles.length) return
  const canvas = await compose(1800)
  const format = document.querySelector('input[name="format"]:checked')?.value || 'jpeg'
  const blob = await canvasToBlob(canvas, format, 92)
  downloadBlob(blob, 'collage' + EXT[format])
}

bindDropzone(dropzone, fileInput, addFiles)
bindPills('#format-options')
bindPills('#grid-options')
settingsEl.querySelectorAll('input[type="range"]').forEach((input) => {
  const live = document.getElementById(input.id + '-value')
  if (!live) return
  input.addEventListener('input', () => {
    live.textContent = input.value
  })
})
settingsEl.addEventListener('input', render)
settingsEl.addEventListener('change', render)
runBtn.addEventListener('click', download)
resetBtn.addEventListener('click', () => {
  selectedFiles = []
  fileInput.value = ''
  fileListEl.innerHTML = ''
  settingsEl.classList.add('hidden')
  dropzone.classList.remove('hidden')
  clearError()
})
document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
