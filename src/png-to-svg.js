import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'
import {
  IMAGE_ICON,
  MAX_FILES,
  loadImage,
  bindDropzone,
  uniquePush,
  renderFileRows,
  renderResults,
  makeResult,
  triggerAllDownloads,
  baseName
} from './image-utils.js'

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
  renderFileRows(fileListEl, selectedFiles, IMAGE_ICON, (i) => {
    selectedFiles.splice(i, 1)
    renderList()
  })
  settingsEl.classList.toggle('hidden', selectedFiles.length === 0)
}

function addFiles(list) {
  const ok = Array.from(list).filter((f) => f.type === 'image/png' || /\.png$/i.test(f.name))
  if (ok.length !== list.length) showError('Only PNG files are allowed.')
  else clearError()
  if (!ok.length) return
  uniquePush(selectedFiles, ok, MAX_FILES, showError)
  renderList()
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('Could not read file.'))
    reader.readAsDataURL(blob)
  })
}

async function processFile(file) {
  const img = await loadImage(file)
  const dataUrl = await blobToDataUrl(file)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${img.naturalWidth}" height="${img.naturalHeight}" viewBox="0 0 ${img.naturalWidth} ${img.naturalHeight}">
  <image width="${img.naturalWidth}" height="${img.naturalHeight}" xlink:href="${dataUrl}"/>
</svg>`
  const blob = new Blob([svg], { type: 'image/svg+xml' })
  return makeResult(blob, baseName(file.name) + '.svg', file.size, `${img.naturalWidth}×${img.naturalHeight}px`)
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
    progressText.textContent = `Converting ${i + 1} of ${selectedFiles.length}…`
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
  renderResults(resultsList, results, IMAGE_ICON)
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
