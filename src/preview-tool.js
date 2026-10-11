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
import * as F from './image-filters.js'

const tool = document.body.dataset.tool || 'adjust'
const dropzone = document.getElementById('dropzone')
const fileInput = document.getElementById('file-input')
const settingsEl = document.getElementById('tool-settings')
const preview = document.getElementById('preview-canvas')
const runBtn = document.getElementById('run-btn')
const resetBtn = document.getElementById('reset-btn')
const errorBox = document.getElementById('error-box')
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

function val(name) {
  const el = document.getElementById(name) || document.querySelector(`[name="${name}"]:checked`)
  return el ? el.value : ''
}

function num(name, fallback = 0) {
  const n = Number(val(name))
  return Number.isFinite(n) ? n : fallback
}

function getFormat() {
  const el = document.querySelector('input[name="format"]:checked')
  if (el) return el.value
  if (['rounded', 'circle-crop', 'transparent', 'trim'].includes(tool)) return 'png'
  return 'jpeg'
}

function applyTool(canvas) {
  if (tool === 'adjust') {
    return F.adjust(canvas, {
      brightness: num('brightness'),
      contrast: num('contrast'),
      saturation: num('saturation')
    })
  }
  if (tool === 'filters') {
    const name = val('filter') || 'grayscale'
    if (name === 'grayscale') return F.grayscale(canvas)
    if (name === 'invert') return F.invert(canvas)
    if (name === 'sepia') return F.sepia(canvas)
    if (name === 'solarize') return F.solarize(canvas)
    if (name === 'threshold') return F.threshold(canvas, num('level', 128))
    if (name === 'posterize') return F.posterize(canvas, num('levels', 4))
    if (name === 'colorize') return F.colorize(canvas, val('tint') || '#ff4b55', 0.45)
    if (name === 'duotone') return F.duotone(canvas, val('dark') || '#1a1a2e', val('light') || '#e94560')
    if (name === 'false-color') return F.falseColor(canvas)
    if (name === 'hue') return F.hueRotate(canvas, num('hue', 90))
    return F.applyPreset(canvas, name)
  }
  if (tool === 'effects') {
    const name = val('effect') || 'blur'
    if (name === 'blur') return F.blur(canvas, num('radius', 4))
    if (name === 'sharpen') return F.sharpen(canvas)
    if (name === 'emboss') return F.emboss(canvas)
    if (name === 'edge') return F.edgeDetect(canvas)
    if (name === 'pixelate') return F.pixelate(canvas, num('block', 12))
    if (name === 'dither') return F.dither(canvas)
    if (name === 'vignette') return F.vignette(canvas, num('strength', 55) / 100)
    if (name === 'sketch') return F.sketch(canvas)
    if (name === 'cartoon') return F.cartoon(canvas)
    if (name === 'glow') return F.glow(canvas)
    if (name === 'scanlines') return F.scanlines(canvas)
    if (name === 'glitch') return F.glitch(canvas)
    if (name === 'chromatic') return F.chromatic(canvas, num('offset', 4))
    if (name === 'anaglyph') return F.anaglyph(canvas)
    if (name === 'kaleidoscope') return F.kaleidoscope(canvas)
    if (name === 'mosaic') return F.mosaic(canvas, num('block', 16))
    if (name === 'halftone') return F.halftone(canvas, num('cell', 10))
    if (name === 'wave') return F.wave(canvas, num('amp', 12))
    if (name === 'twirl') return F.twirl(canvas, num('twist', 22) / 10)
    return canvas
  }
  if (tool === 'blur') return F.blur(canvas, num('radius', 6))
  if (tool === 'grayscale') return F.grayscale(canvas)
  if (tool === 'invert') return F.invert(canvas)
  if (tool === 'sepia') return F.sepia(canvas)
  if (tool === 'pixelate') return F.pixelate(canvas, num('block', 12))
  if (tool === 'vignette') return F.vignette(canvas, num('strength', 55) / 100)
  if (tool === 'sketch') return F.sketch(canvas)
  if (tool === 'cartoon') return F.cartoon(canvas)
  if (tool === 'border') return F.addBorder(canvas, num('width', 24), val('color') || '#ffffff')
  if (tool === 'padding') return F.addPadding(canvas, num('pad', 40), val('color') || '#ffffff')
  if (tool === 'rounded') return F.rounded(canvas, num('radius', 48))
  if (tool === 'circle-crop') return F.circleCrop(canvas)
  if (tool === 'shadow') return F.dropShadow(canvas, num('blur', 18))
  if (tool === 'reflection') return F.reflection(canvas, num('height', 40) / 100)
  if (tool === 'polaroid') return F.polaroid(canvas)
  if (tool === 'outline') return F.outline(canvas, num('width', 8), val('color') || '#111111')
  if (tool === 'letterbox') {
    const preset = val('box') || '1920x1080'
    const [tw, th] = preset.split('x').map(Number)
    return F.letterbox(canvas, tw, th, val('color') || '#000000')
  }
  if (tool === 'trim') return F.trimWhitespace(canvas, num('limit', 245))
  if (tool === 'transparent') return F.makeTransparent(canvas, val('key') || '#ffffff', num('tolerance', 40))
  if (tool === 'replace-color') return F.replaceColor(canvas, val('from') || '#ffffff', val('to') || '#ff4b55', num('tolerance', 40))
  if (tool === 'background') return F.changeBackground(canvas, val('color') || '#ffffff')
  if (tool === 'gradient') return F.gradientOverlay(canvas, val('c1') || '#ff4b55', val('c2') || '#ff7a3d', num('alpha', 35) / 100)
  if (tool === 'thumbnail') return F.thumbnail(canvas, num('max', 256))
  if (tool === 'sharpen') return F.sharpen(canvas)
  if (tool === 'noise') return F.noise(canvas, num('amount', 30))
  if (tool === 'temperature') return F.temperature(canvas, num('amount', 30))
  return canvas
}

function scaledSource(max) {
  const w = source.naturalWidth
  const h = source.naturalHeight
  const scale = Math.min(1, max / Math.max(w, h))
  if (scale >= 1) return F.fromImage(source)
  const c = document.createElement('canvas')
  c.width = Math.max(1, Math.round(w * scale))
  c.height = Math.max(1, Math.round(h * scale))
  c.getContext('2d').drawImage(source, 0, 0, c.width, c.height)
  return c
}

function render() {
  if (!source) return
  const canvas = applyTool(scaledSource(900))
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
  const canvas = applyTool(F.fromImage(source))
  const format = getFormat()
  const blob = await canvasToBlob(canvas, format, 92)
  downloadBlob(blob, fileName + '-' + tool + EXT[format])
}

function resetTool() {
  source = null
  preview.width = preview.height = 0
  settingsEl.classList.add('hidden')
  dropzone.classList.remove('hidden')
  fileInput.value = ''
  clearError()
}

bindDropzone(dropzone, fileInput, onFiles)
bindPills('#format-options')
bindPills('#filter-options')
bindPills('#effect-options')
bindPills('#box-options')
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
resetBtn.addEventListener('click', resetTool)
document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
