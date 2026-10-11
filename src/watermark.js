import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'
import {
  ACCEPTED_IMAGE,
  IMAGE_EXT,
  EXT,
  loadImage,
  canvasToBlob,
  downloadBlob,
  bindDropzone,
  bindPills,
  baseName
} from './image-utils.js'
import { fromImage } from './image-filters.js'

const dropzone = document.getElementById('dropzone')
const fileInput = document.getElementById('file-input')
const settingsEl = document.getElementById('tool-settings')
const preview = document.getElementById('preview-canvas')
const runBtn = document.getElementById('run-btn')
const resetBtn = document.getElementById('reset-btn')
const errorBox = document.getElementById('error-box')
const textInput = document.getElementById('wm-text')
const pctx = preview.getContext('2d')

let source = null
let fileName = 'image'

function showError(msg) {
  errorBox.textContent = msg
  errorBox.classList.remove('hidden')
}

function clearError() {
  errorBox.classList.add('hidden')
}

function getFormat() {
  const el = document.querySelector('input[name="format"]:checked')
  return el ? el.value : 'jpeg'
}

function stamp(canvas, scale) {
  const ctx = canvas.getContext('2d')
  const text = (textInput.value || 'PDFpress').trim() || 'PDFpress'
  const opacity = Number(document.getElementById('wm-opacity').value) / 100
  const size = Math.max(12, Math.round((canvas.width / 18) * (Number(document.getElementById('wm-size').value) / 100) * scale))
  const color = document.getElementById('wm-color').value || '#ffffff'
  const pos = document.querySelector('input[name="pos"]:checked')?.value || 'center'
  ctx.save()
  ctx.globalAlpha = opacity
  ctx.fillStyle = color
  ctx.strokeStyle = 'rgba(0,0,0,0.35)'
  ctx.lineWidth = Math.max(1, size / 14)
  ctx.font = `700 ${size}px Inter, system-ui, sans-serif`
  ctx.textBaseline = 'middle'
  if (pos === 'tile') {
    ctx.textAlign = 'center'
    const gapX = size * 8
    const gapY = size * 5
    ctx.rotate(-0.35)
    for (let y = -canvas.height; y < canvas.height * 2; y += gapY) {
      for (let x = -canvas.width; x < canvas.width * 2; x += gapX) {
        ctx.fillText(text, x, y)
      }
    }
  } else {
    const pad = size
    let x = canvas.width / 2
    let y = canvas.height / 2
    ctx.textAlign = 'center'
    if (pos === 'tl') { x = pad; y = pad; ctx.textAlign = 'left'; ctx.textBaseline = 'top' }
    if (pos === 'tr') { x = canvas.width - pad; y = pad; ctx.textAlign = 'right'; ctx.textBaseline = 'top' }
    if (pos === 'bl') { x = pad; y = canvas.height - pad; ctx.textAlign = 'left'; ctx.textBaseline = 'bottom' }
    if (pos === 'br') { x = canvas.width - pad; y = canvas.height - pad; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom' }
    ctx.strokeText(text, x, y)
    ctx.fillText(text, x, y)
  }
  ctx.restore()
  return canvas
}

function render() {
  if (!source) return
  const max = 900
  const scale = Math.min(1, max / Math.max(source.naturalWidth, source.naturalHeight))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(source.naturalWidth * scale)
  canvas.height = Math.round(source.naturalHeight * scale)
  canvas.getContext('2d').drawImage(source, 0, 0, canvas.width, canvas.height)
  stamp(canvas, 1)
  preview.width = canvas.width
  preview.height = canvas.height
  pctx.clearRect(0, 0, preview.width, preview.height)
  pctx.drawImage(canvas, 0, 0)
}

async function onFiles(list) {
  const f = Array.from(list).find((x) => ACCEPTED_IMAGE.test(x.type) || IMAGE_EXT.test(x.name))
  if (!f) {
    showError('Please select a JPG, PNG, GIF, BMP, WebP or SVG image.')
    return
  }
  clearError()
  source = await loadImage(f)
  fileName = baseName(f.name)
  dropzone.classList.add('hidden')
  settingsEl.classList.remove('hidden')
  render()
}

async function download() {
  if (!source) return
  const canvas = fromImage(source)
  stamp(canvas, 1)
  const format = getFormat()
  const blob = await canvasToBlob(canvas, format, 92)
  downloadBlob(blob, fileName + '-watermark' + EXT[format])
}

bindDropzone(dropzone, fileInput, onFiles)
bindPills('#format-options')
bindPills('#pos-options')
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
  source = null
  settingsEl.classList.add('hidden')
  dropzone.classList.remove('hidden')
  clearError()
})
document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
