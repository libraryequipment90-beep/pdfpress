import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'

const dropzone = document.getElementById('dropzone')
const fileInput = document.getElementById('file-input')
const fileListEl = document.getElementById('file-list')
const compressSettings = document.getElementById('compress-settings')
const compressBtn = document.getElementById('compress-btn')
const progressEl = document.getElementById('progress')
const progressFill = document.getElementById('progress-fill')
const progressText = document.getElementById('progress-text')
const resultsEl = document.getElementById('results')
const resultsList = document.getElementById('results-list')
const downloadAllBtn = document.getElementById('download-all-btn')
const resetBtn = document.getElementById('reset-btn')
const errorBox = document.getElementById('error-box')

let selectedFiles = []
let sessionId = null
let resultData = []
let pollTimer = null

const FILE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`

const REMOVE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

function showError(msg) {
  errorBox.textContent = msg
  errorBox.classList.remove('hidden')
}

function clearError() {
  errorBox.classList.add('hidden')
  errorBox.textContent = ''
}

function resetTool() {
  selectedFiles = []
  sessionId = null
  resultData = []
  pollTimer = null
  fileInput.value = ''
  renderFileList()
  compressSettings.classList.add('hidden')
  resultsEl.classList.add('hidden')
  progressEl.classList.add('hidden')
  clearError()
  compressBtn.disabled = false
}

function renderFileList() {
  fileListEl.innerHTML = ''
  if (selectedFiles.length === 0) {
    compressSettings.classList.add('hidden')
    return
  }
  compressSettings.classList.remove('hidden')

  selectedFiles.forEach((file, index) => {
    const row = document.createElement('div')
    row.className = 'file-row'
    row.innerHTML = `
      <span class="file-icon">${FILE_ICON}</span>
      <div class="file-meta">
        <div class="file-name">${escapeHtml(file.name)}</div>
        <div class="file-size">${fmtSize(file.size)}</div>
      </div>
      <button type="button" class="file-remove" data-index="${index}" aria-label="Remove ${escapeHtml(file.name)}">${REMOVE_ICON}</button>
    `
    fileListEl.appendChild(row)
  })

  fileListEl.querySelectorAll('.file-remove').forEach((btn) => {
    btn.addEventListener('click', () => {
      selectedFiles.splice(Number(btn.dataset.index), 1)
      renderFileList()
    })
  })
}

function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

function addFiles(fileList) {
  const pdfs = Array.from(fileList).filter(
    (f) => f.type === 'application/pdf' || /\.pdf$/i.test(f.name)
  )

  if (pdfs.length !== fileList.length) {
    showError('Only PDF files are allowed. Invalid files were ignored.')
  } else {
    clearError()
  }

  if (pdfs.length === 0) return

  const existingNames = new Set(selectedFiles.map((f) => f.name))
  const unique = pdfs.filter((f) => {
    if (existingNames.has(f.name)) {
      showError(`"${f.name}" was skipped because a file with the same name already exists.`)
      return false
    }
    existingNames.add(f.name)
    return true
  })

  const spaceLeft = 20 - selectedFiles.length
  if (unique.length > spaceLeft) {
    showError(`Only ${spaceLeft} more file(s) can be added (max 20 files).`)
  }
  selectedFiles.push(...unique.slice(0, spaceLeft))
  renderFileList()
}

dropzone.addEventListener('click', (e) => {
  if (e.target.closest('#file-input')) return
  fileInput.click()
})

dropzone.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault()
    fileInput.click()
  }
})

fileInput.addEventListener('change', () => {
  addFiles(fileInput.files)
  fileInput.value = ''
})

;['dragenter', 'dragover'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault()
    dropzone.classList.add('dragover')
  })
})

;['dragleave', 'drop'].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault()
    dropzone.classList.remove('dragover')
  })
})

dropzone.addEventListener('drop', (e) => {
  addFiles(e.dataTransfer.files)
})

function compress() {
  if (selectedFiles.length === 0) return

  clearError()
  compressBtn.disabled = true
  fileListEl.classList.add('hidden')
  compressSettings.classList.add('hidden')
  progressEl.classList.remove('hidden')
  progressFill.style.width = '0%'
  progressText.textContent = 'Uploading files…'

  const level = document.querySelector('input[name="level"]:checked').value
  const formData = new FormData()
  formData.append('level', level)
  selectedFiles.forEach((f) => formData.append('files', f))

  const xhr = new XMLHttpRequest()
  xhr.open('POST', '/api/compress')

  xhr.upload.onprogress = (e) => {
    if (e.lengthComputable) {
      const pct = Math.round((e.loaded / e.total) * 100)
      progressFill.style.width = pct + '%'
      progressText.textContent = `Uploading… ${pct}%`
    }
  }

  xhr.onload = () => {
    let data = null
    try {
      data = JSON.parse(xhr.responseText)
    } catch (_) {
      data = null
    }

    if (xhr.status >= 200 && xhr.status < 300 && data) {
      sessionId = data.sessionId
      pollStatus()
    } else {
      failCompress(data && data.error ? data.error : 'Something went wrong. Please try again.')
    }
  }

  xhr.onerror = () => failCompress('Network error. Please check your connection and try again.')
  xhr.send(formData)
}

async function pollStatus() {
  try {
    const res = await fetch(`/api/compress-status/${sessionId}`)
    const data = await res.json()

    if (!res.ok || !sessionId) {
      failCompress(data && data.error ? data.error : 'Session expired. Please try again.')
      return
    }

    if (data.status === 'error') {
      failCompress(data.error || 'Compression failed. Please try again.')
      return
    }

    if (data.status === 'done') {
      resultData = data.results
      progressText.textContent = 'Compressing…'
      progressFill.style.width = '100%'
      setTimeout(showResults, 300)
      return
    }

    const pct = Math.round((data.done / data.total) * 100)
    progressFill.style.width = pct + '%'
    progressText.textContent = `Compressing ${data.done} of ${data.total}…`
    pollTimer = setTimeout(pollStatus, 1200)
  } catch (e) {
    failCompress('Unable to check compression status. Please try again.')
  }
}

function failCompress(msg) {
  compressBtn.disabled = false
  progressEl.classList.add('hidden')
  fileListEl.classList.remove('hidden')
  compressSettings.classList.remove('hidden')
  showError(msg)
}

function showResults() {
  progressEl.classList.add('hidden')
  resultsEl.classList.remove('hidden')
  resultsList.innerHTML = ''

  resultData.forEach((r) => {
    const li = document.createElement('li')
    li.className = 'result-row'
    li.innerHTML = `
      <span class="file-icon">${FILE_ICON}</span>
      <div class="result-info">
        <div class="result-name">${escapeHtml(r.compressedName)}</div>
        <div class="result-sizes">
          ${r.originalSizeText} <span class="arrow">→</span> <span class="new-size">${r.compressedSizeText}</span>
        </div>
      </div>
      <span class="badge ${r.notSmaller ? 'same' : ''}">${r.notSmaller ? 'Similar size' : r.savedPercent + '% smaller'}</span>
      <a class="btn btn-primary btn-sm" href="/api/download/${sessionId}/${r.id}">Download</a>
    `
    resultsList.appendChild(li)
  })
}

downloadAllBtn.addEventListener('click', () => {
  if (!sessionId) return
  window.location.href = `/api/download-all/${sessionId}`
})

resetBtn.addEventListener('click', resetTool)
document.querySelectorAll('#level-options input[name="level"]').forEach((radio) => {
  radio.addEventListener('change', () => {
    document.querySelectorAll('.level-pill').forEach((pill) => {
      const input = pill.querySelector('input')
      pill.classList.toggle('checked', input.checked)
    })
  })
})

compressBtn.addEventListener('click', compress)

document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
