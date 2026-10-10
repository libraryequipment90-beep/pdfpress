import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'
import { PDFDocument } from 'pdf-lib'
import {
  IMAGE_ICON,
  FILE_ICON,
  ACCEPTED_IMAGE,
  IMAGE_EXT,
  MAX_FILES,
  loadImage,
  canvasToBlob,
  imageToCanvas,
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
  const ok = Array.from(list).filter((f) => ACCEPTED_IMAGE.test(f.type) || IMAGE_EXT.test(f.name))
  if (ok.length !== list.length) showError('Only image files are allowed.')
  else clearError()
  if (!ok.length) return
  uniquePush(selectedFiles, ok, MAX_FILES, showError)
  renderList()
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
    const pdf = await PDFDocument.create()
    const totalSize = selectedFiles.reduce((s, f) => s + f.size, 0)
    for (let i = 0; i < selectedFiles.length; i++) {
      progressText.textContent = `Adding image ${i + 1} of ${selectedFiles.length}…`
      progressFill.style.width = `${Math.round((i / selectedFiles.length) * 100)}%`
      const img = await loadImage(selectedFiles[i])
      const canvas = imageToCanvas(img, '#ffffff')
      const blob = await canvasToBlob(canvas, 'jpeg', 92)
      const bytes = new Uint8Array(await blob.arrayBuffer())
      const embedded = await pdf.embedJpg(bytes)
      const page = pdf.addPage([embedded.width, embedded.height])
      page.drawImage(embedded, { x: 0, y: 0, width: embedded.width, height: embedded.height })
    }
    const bytes = await pdf.save()
    const blob = new Blob([bytes], { type: 'application/pdf' })
    const name = (selectedFiles.length === 1 ? baseName(selectedFiles[0].name) : 'images') + '.pdf'
    results = [makeResult(blob, name, totalSize, `${selectedFiles.length} page${selectedFiles.length > 1 ? 's' : ''}`)]
    progressFill.style.width = '100%'
    progressEl.classList.add('hidden')
    resultsEl.classList.remove('hidden')
    renderResults(resultsList, results, FILE_ICON)
  } catch (err) {
    showError(err.message || 'Could not create PDF.')
    runBtn.disabled = false
    progressEl.classList.add('hidden')
    fileListEl.classList.remove('hidden')
    settingsEl.classList.remove('hidden')
  }
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
