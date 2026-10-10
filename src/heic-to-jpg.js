import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'
import {
  IMAGE_ICON,
  MAX_FILES,
  EXT,
  loadImage,
  bindDropzone,
  uniquePush,
  renderFileRows,
  renderResults,
  sizeBadge,
  makeResult,
  triggerAllDownloads,
  baseName
} from './image-utils.js'
import heic2any from 'heic2any'

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

function isHeic(f) {
  return /heic|heif/i.test(f.type) || /\.(heic|heif)$/i.test(f.name)
}

function renderList() {
  renderFileRows(fileListEl, selectedFiles, IMAGE_ICON, (i) => {
    selectedFiles.splice(i, 1)
    renderList()
  })
  settingsEl.classList.toggle('hidden', selectedFiles.length === 0)
}

function addFiles(list) {
  const ok = Array.from(list).filter(isHeic)
  if (ok.length !== list.length) showError('Only HEIC / HEIF files are allowed.')
  else clearError()
  if (!ok.length) return
  uniquePush(selectedFiles, ok, MAX_FILES, showError)
  renderList()
}

async function processFile(file) {
  const converted = await heic2any({ blob: file, toType: 'image/jpeg', quality: Number(qualityInput.value) / 100 })
  const blob = Array.isArray(converted) ? converted[0] : converted
  const img = await loadImage(new File([blob], 'tmp.jpg', { type: 'image/jpeg' }))
  return makeResult(blob, baseName(file.name) + EXT.jpeg, file.size, `${img.naturalWidth}×${img.naturalHeight}px`)
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
      showError(err.message || 'Could not convert this HEIC file.')
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
qualityInput.addEventListener('input', () => { qualityValue.textContent = qualityInput.value })
runBtn.addEventListener('click', run)
downloadAllBtn.addEventListener('click', () => triggerAllDownloads(results))
resetBtn.addEventListener('click', resetTool)
document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
