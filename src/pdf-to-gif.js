import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import { GIFEncoder, quantize, applyPalette } from 'gifenc'
import {
  FILE_ICON,
  bindDropzone,
  uniquePush,
  renderFileRows,
  renderResults,
  makeResult,
  triggerAllDownloads,
  baseName
} from './image-utils.js'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

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
const delayInput = document.getElementById('gif-delay')

let selectedFiles = []
let results = []

function showError(msg) {
  errorBox.textContent = msg
  errorBox.classList.remove('hidden')
}

function clearError() {
  errorBox.classList.add('hidden')
}

function renderList() {
  renderFileRows(fileListEl, selectedFiles, FILE_ICON, (i) => {
    selectedFiles.splice(i, 1)
    renderList()
  })
  settingsEl.classList.toggle('hidden', selectedFiles.length === 0)
}

function addFiles(list) {
  const ok = Array.from(list).filter((f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name))
  if (ok.length !== list.length) showError('Only PDF files are allowed.')
  else clearError()
  if (!ok.length) return
  uniquePush(selectedFiles, ok, 1, showError)
  renderList()
}

async function renderGif(file) {
  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const delay = Math.max(100, Number(delayInput.value) || 800)
  const gif = GIFEncoder()
  let width = 0
  let height = 0
  for (let i = 1; i <= doc.numPages; i++) {
    progressText.textContent = `Rendering page ${i} of ${doc.numPages}…`
    progressFill.style.width = `${Math.round((i / doc.numPages) * 100)}%`
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 1.2 })
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(viewport.width)
    canvas.height = Math.round(viewport.height)
    width = canvas.width
    height = canvas.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const ctx = canvas.getContext('2d')
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
    const palette = quantize(imageData.data, 256)
    const index = applyPalette(imageData.data, palette)
    gif.writeFrame(index, canvas.width, canvas.height, { palette, delay })
  }
  gif.finish()
  const blob = new Blob([gif.bytes()], { type: 'image/gif' })
  return makeResult(blob, baseName(file.name) + '.gif', file.size, `${width}×${height}px · ${doc.numPages} frames`)
}

async function run() {
  if (!selectedFiles.length) return
  clearError()
  runBtn.disabled = true
  fileListEl.classList.add('hidden')
  settingsEl.classList.add('hidden')
  progressEl.classList.remove('hidden')
  results = []
  try {
    results.push(await renderGif(selectedFiles[0]))
  } catch (err) {
    showError(err.message || 'Could not convert this PDF.')
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
  renderResults(resultsList, results, FILE_ICON)
}

function resetTool() {
  selectedFiles = []
  results = []
  renderList()
  resultsEl.classList.add('hidden')
  progressEl.classList.add('hidden')
  runBtn.disabled = false
  clearError()
}

bindDropzone(dropzone, fileInput, addFiles)
runBtn.addEventListener('click', run)
downloadAllBtn.addEventListener('click', () => triggerAllDownloads(results))
resetBtn.addEventListener('click', resetTool)
document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
