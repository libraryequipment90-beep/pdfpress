import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'
import { ACCEPTED_IMAGE, IMAGE_EXT, loadImage, canvasToBlob, downloadBlob, bindDropzone, baseName } from './image-utils.js'

const dropzone = document.getElementById('dropzone')
const fileInput = document.getElementById('file-input')
const settingsEl = document.getElementById('tool-settings')
const canvas = document.getElementById('meme-canvas')
const topInput = document.getElementById('meme-top')
const bottomInput = document.getElementById('meme-bottom')
const runBtn = document.getElementById('run-btn')
const resetBtn = document.getElementById('reset-btn')
const errorBox = document.getElementById('error-box')
const ctx = canvas.getContext('2d')

let source = null
let fileName = 'meme'

function showError(msg) {
  errorBox.textContent = msg
  errorBox.classList.remove('hidden')
}

function clearError() {
  errorBox.classList.add('hidden')
}

function wrapText(text, maxWidth) {
  const words = text.split(/\s+/)
  const lines = []
  let line = ''
  for (const word of words) {
    const test = line ? line + ' ' + word : word
    if (ctx.measureText(test).width > maxWidth && line) {
      lines.push(line)
      line = word
    } else {
      line = test
    }
  }
  if (line) lines.push(line)
  return lines
}

function drawMeme() {
  if (!source) return
  const w = source.naturalWidth
  const h = source.naturalHeight
  canvas.width = w
  canvas.height = h
  ctx.drawImage(source, 0, 0)
  const size = Math.max(28, Math.round(w / 12))
  ctx.font = `900 ${size}px Impact, Haettenschweiler, sans-serif`
  ctx.textAlign = 'center'
  ctx.lineJoin = 'round'
  ctx.lineWidth = Math.max(4, Math.round(size / 10))
  ctx.fillStyle = '#fff'
  ctx.strokeStyle = '#000'
  ctx.textBaseline = 'top'
  const maxW = w * 0.92
  const top = wrapText((topInput.value || '').toUpperCase(), maxW)
  top.forEach((line, i) => {
    const y = 16 + i * size * 1.1
    ctx.strokeText(line, w / 2, y)
    ctx.fillText(line, w / 2, y)
  })
  ctx.textBaseline = 'bottom'
  const bottom = wrapText((bottomInput.value || '').toUpperCase(), maxW)
  bottom.forEach((line, i) => {
    const y = h - 16 - (bottom.length - 1 - i) * size * 1.1
    ctx.strokeText(line, w / 2, y)
    ctx.fillText(line, w / 2, y)
  })
}

async function onFiles(list) {
  const f = Array.from(list).find((x) => ACCEPTED_IMAGE.test(x.type) || IMAGE_EXT.test(x.name))
  if (!f) {
    showError('Please select a JPG, PNG, GIF, BMP or WebP image.')
    return
  }
  clearError()
  fileName = baseName(f.name)
  source = await loadImage(f)
  dropzone.classList.add('hidden')
  settingsEl.classList.remove('hidden')
  drawMeme()
}

topInput.addEventListener('input', drawMeme)
bottomInput.addEventListener('input', drawMeme)

runBtn.addEventListener('click', async () => {
  if (!source) return
  drawMeme()
  const blob = await canvasToBlob(canvas, 'jpeg', 92)
  downloadBlob(blob, fileName + '-meme.jpg')
})

resetBtn.addEventListener('click', () => {
  source = null
  topInput.value = ''
  bottomInput.value = ''
  settingsEl.classList.add('hidden')
  dropzone.classList.remove('hidden')
  clearError()
})

bindDropzone(dropzone, fileInput, onFiles)
document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
