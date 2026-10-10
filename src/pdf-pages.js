import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'
import * as pdfjs from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'
import {
  FILE_ICON,
  canvasToBlob,
  bindDropzone,
  uniquePush,
  renderFileRows,
  renderResults,
  makeResult,
  triggerAllDownloads,
  baseName
} from './image-utils.js'

pdfjs.GlobalWorkerOptions.workerSrc = workerUrl

const format = document.body.dataset.tool === 'png' ? 'png' : 'jpeg'
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
  uniquePush(selectedFiles, ok, 5, showError)
  renderList()
}

async function renderPdf(file) {
  const data = await file.arrayBuffer()
  const doc = await pdfjs.getDocument({ data }).promise
  const out = []
  const quality = qualityInput ? Number(qualityInput.value) : 90
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i)
    const viewport = page.getViewport({ scale: 2 })
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise
    const blob = await canvasToBlob(canvas, format, quality)
    const name = `${baseName(file.name)}-page-${i}.${format === 'png' ? 'png' : 'jpg'}`
    out.push(makeResult(blob, name, file.size / doc.numPages, `${Math.round(viewport.width)}×${Math.round(viewport.height)}px`))
  }
  return out
}

async function run() {
  if (!selectedFiles.length) return
  clearError()
  runBtn.disabled = true
  fileListEl.classList.add('hidden')
  settingsEl.classList.add('hidden')
  progressEl.classList.remove('hidden')
  results = []
  for (let i = 0; i < selectedFiles.length; i++) {
    progressText.textContent = `Rendering PDF ${i + 1} of ${selectedFiles.length}…`
    progressFill.style.width = `${Math.round((i / selectedFiles.length) * 100)}%`
    try {
      results.push(...await renderPdf(selectedFiles[i]))
    } catch (err) {
      showError(err.message || 'Could not read this PDF.')
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
if (qualityInput && qualityValue) {
  qualityInput.addEventListener('input', () => { qualityValue.textContent = qualityInput.value })
}
runBtn.addEventListener('click', run)
downloadAllBtn.addEventListener('click', () => triggerAllDownloads(results))
resetBtn.addEventListener('click', resetTool)
document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
