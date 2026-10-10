import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'
import { ACCEPTED_IMAGE, IMAGE_EXT, EXT, loadImage, canvasToBlob, downloadBlob, bindDropzone, bindPills, baseName } from './image-utils.js'

const dropzone = document.getElementById('dropzone')
const fileInput = document.getElementById('file-input')
const settingsEl = document.getElementById('tool-settings')
const imgEl = document.getElementById('crop-img')
const box = document.getElementById('crop-box')
const stage = document.getElementById('crop-stage')
const runBtn = document.getElementById('run-btn')
const resetBtn = document.getElementById('reset-btn')
const errorBox = document.getElementById('error-box')

let file = null
let natural = { w: 0, h: 0 }
let crop = { x: 0, y: 0, w: 0, h: 0 }
let drag = null

function showError(msg) {
  errorBox.textContent = msg
  errorBox.classList.remove('hidden')
}

function clearError() {
  errorBox.classList.add('hidden')
}

function applyBox() {
  box.style.left = crop.x + 'px'
  box.style.top = crop.y + 'px'
  box.style.width = crop.w + 'px'
  box.style.height = crop.h + 'px'
}

function clamp() {
  const sw = imgEl.clientWidth
  const sh = imgEl.clientHeight
  crop.w = Math.max(24, Math.min(crop.w, sw))
  crop.h = Math.max(24, Math.min(crop.h, sh))
  crop.x = Math.max(0, Math.min(crop.x, sw - crop.w))
  crop.y = Math.max(0, Math.min(crop.y, sh - crop.h))
}

async function onFiles(list) {
  const f = Array.from(list).find((x) => ACCEPTED_IMAGE.test(x.type) || IMAGE_EXT.test(x.name))
  if (!f) {
    showError('Please select a JPG, PNG, GIF, BMP or WebP image.')
    return
  }
  clearError()
  file = f
  const img = await loadImage(f)
  natural = { w: img.naturalWidth, h: img.naturalHeight }
  imgEl.src = URL.createObjectURL(f)
  dropzone.classList.add('hidden')
  settingsEl.classList.remove('hidden')
  imgEl.onload = () => {
    const sw = imgEl.clientWidth
    const sh = imgEl.clientHeight
    crop = { x: sw * 0.1, y: sh * 0.1, w: sw * 0.8, h: sh * 0.8 }
    applyBox()
  }
}

box.addEventListener('pointerdown', (e) => {
  const handle = e.target.dataset.h || 'move'
  drag = {
    handle,
    sx: e.clientX,
    sy: e.clientY,
    ox: crop.x,
    oy: crop.y,
    ow: crop.w,
    oh: crop.h
  }
  box.setPointerCapture(e.pointerId)
  e.preventDefault()
})

box.addEventListener('pointermove', (e) => {
  if (!drag) return
  const dx = e.clientX - drag.sx
  const dy = e.clientY - drag.sy
  const h = drag.handle
  if (h === 'move') {
    crop.x = drag.ox + dx
    crop.y = drag.oy + dy
  } else {
    if (h.includes('w')) {
      crop.x = drag.ox + dx
      crop.w = drag.ow - dx
    }
    if (h.includes('e')) crop.w = drag.ow + dx
    if (h.includes('n')) {
      crop.y = drag.oy + dy
      crop.h = drag.oh - dy
    }
    if (h.includes('s')) crop.h = drag.oh + dy
  }
  clamp()
  applyBox()
})

box.addEventListener('pointerup', () => { drag = null })
box.addEventListener('pointercancel', () => { drag = null })

runBtn.addEventListener('click', async () => {
  if (!file) return
  const scaleX = natural.w / imgEl.clientWidth
  const scaleY = natural.h / imgEl.clientHeight
  const sx = Math.round(crop.x * scaleX)
  const sy = Math.round(crop.y * scaleY)
  const sw = Math.round(crop.w * scaleX)
  const sh = Math.round(crop.h * scaleY)
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, sw)
  canvas.height = Math.max(1, sh)
  const ctx = canvas.getContext('2d')
  const img = await loadImage(file)
  const format = document.querySelector('input[name="format"]:checked').value
  if (format === 'jpeg') {
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
  const blob = await canvasToBlob(canvas, format, 92)
  downloadBlob(blob, baseName(file.name) + '-cropped' + EXT[format])
})

resetBtn.addEventListener('click', () => {
  file = null
  imgEl.src = ''
  settingsEl.classList.add('hidden')
  dropzone.classList.remove('hidden')
  clearError()
})

bindDropzone(dropzone, fileInput, onFiles)
bindPills('#format-options')
document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
