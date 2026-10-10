import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'
import { ACCEPTED_IMAGE, IMAGE_EXT, loadImage, bindDropzone } from './image-utils.js'

const dropzone = document.getElementById('dropzone')
const fileInput = document.getElementById('file-input')
const settingsEl = document.getElementById('tool-settings')
const canvas = document.getElementById('picker-canvas')
const swatch = document.getElementById('color-swatch')
const hexBtn = document.getElementById('copy-hex')
const rgbBtn = document.getElementById('copy-rgb')
const hslBtn = document.getElementById('copy-hsl')
const errorBox = document.getElementById('error-box')
const resetBtn = document.getElementById('reset-btn')
const ctx = canvas.getContext('2d', { willReadFrequently: true })

function showError(msg) {
  errorBox.textContent = msg
  errorBox.classList.remove('hidden')
}

function clearError() {
  errorBox.classList.add('hidden')
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')
}

function rgbToHsl(r, g, b) {
  r /= 255
  g /= 255
  b /= 255
  const max = Math.max(r, g, b)
  const min = Math.min(r, g, b)
  let h = 0
  let s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h /= 6
  }
  return `hsl(${Math.round(h * 360)}, ${Math.round(s * 100)}%, ${Math.round(l * 100)}%)`
}

function setColor(r, g, b) {
  const hex = rgbToHex(r, g, b)
  const rgb = `rgb(${r}, ${g}, ${b})`
  const hsl = rgbToHsl(r, g, b)
  swatch.style.background = hex
  hexBtn.textContent = hex
  rgbBtn.textContent = rgb
  hslBtn.textContent = hsl
}

async function onFiles(list) {
  const f = Array.from(list).find((x) => ACCEPTED_IMAGE.test(x.type) || IMAGE_EXT.test(x.name))
  if (!f) {
    showError('Please select a JPG, PNG, GIF, BMP, WebP or SVG image.')
    return
  }
  clearError()
  const img = await loadImage(f)
  const maxW = 720
  const scale = Math.min(1, maxW / img.naturalWidth)
  canvas.width = Math.round(img.naturalWidth * scale)
  canvas.height = Math.round(img.naturalHeight * scale)
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  dropzone.classList.add('hidden')
  settingsEl.classList.remove('hidden')
  const px = ctx.getImageData(Math.floor(canvas.width / 2), Math.floor(canvas.height / 2), 1, 1).data
  setColor(px[0], px[1], px[2])
}

canvas.addEventListener('click', (e) => {
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width))
  const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height))
  const px = ctx.getImageData(x, y, 1, 1).data
  setColor(px[0], px[1], px[2])
})

canvas.addEventListener('mousemove', (e) => {
  if (e.buttons !== 1) return
  const rect = canvas.getBoundingClientRect()
  const x = Math.floor((e.clientX - rect.left) * (canvas.width / rect.width))
  const y = Math.floor((e.clientY - rect.top) * (canvas.height / rect.height))
  const px = ctx.getImageData(Math.max(0, x), Math.max(0, y), 1, 1).data
  setColor(px[0], px[1], px[2])
})

function copy(el) {
  navigator.clipboard.writeText(el.textContent).then(() => {
    const prev = el.textContent
    el.textContent = 'Copied'
    setTimeout(() => { el.textContent = prev }, 900)
  })
}

hexBtn.addEventListener('click', () => copy(hexBtn))
rgbBtn.addEventListener('click', () => copy(rgbBtn))
hslBtn.addEventListener('click', () => copy(hslBtn))

resetBtn.addEventListener('click', () => {
  settingsEl.classList.add('hidden')
  dropzone.classList.remove('hidden')
  clearError()
})

bindDropzone(dropzone, fileInput, onFiles)
document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
