export const IMAGE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>`

export const FILE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>`

export const REMOVE_ICON = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`

export const MIME = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }
export const EXT = { jpeg: '.jpg', png: '.png', webp: '.webp', gif: '.gif' }
export const ACCEPTED_IMAGE = /^image\/(jpeg|png|gif|bmp|webp|svg\+xml)$/i
export const IMAGE_EXT = /\.(jpe?g|png|gif|bmp|webp|svg)$/i
export const MAX_CANVAS = 16384
export const MAX_FILES = 20

export function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

export function escapeHtml(str) {
  const div = document.createElement('div')
  div.textContent = str
  return div.innerHTML
}

export function baseName(name) {
  return name.replace(/\.[^.]+$/, '') || 'image'
}

export function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(`Could not read "${file.name}". It may be corrupted or unsupported.`))
    }
    img.src = url
  })
}

export function loadImageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not load image.'))
    img.src = url
  })
}

export function canvasToBlob(canvas, format, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image.'))),
      MIME[format] || format,
      quality != null ? quality / 100 : undefined
    )
  })
}

export function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}

export function triggerAllDownloads(results) {
  results.forEach((r, i) => {
    setTimeout(() => downloadBlob(r.blob, r.name), i * 250)
  })
}

export function imageToCanvas(img, bg) {
  const canvas = document.createElement('canvas')
  canvas.width = img.naturalWidth || img.width
  canvas.height = img.naturalHeight || img.height
  const ctx = canvas.getContext('2d')
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.drawImage(img, 0, 0)
  return canvas
}

export function bindDropzone(dropzone, fileInput, onFiles) {
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
    onFiles(fileInput.files)
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
  dropzone.addEventListener('drop', (e) => onFiles(e.dataTransfer.files))
}

export function bindPills(containerSelector) {
  const root = document.querySelector(containerSelector)
  if (!root) return
  root.querySelectorAll('input').forEach((radio) => {
    radio.addEventListener('change', () => {
      root.querySelectorAll('.level-pill').forEach((pill) => {
        const inp = pill.querySelector('input')
        pill.classList.toggle('checked', inp.checked)
      })
    })
  })
}

export function filterFiles(fileList, test, invalidMsg, showError, clearError) {
  const all = Array.from(fileList)
  const ok = all.filter(test)
  if (ok.length !== all.length) showError(invalidMsg)
  else clearError()
  return ok
}

export function uniquePush(selected, incoming, max, showError) {
  const names = new Set(selected.map((f) => f.name))
  const unique = incoming.filter((f) => {
    if (names.has(f.name)) {
      showError(`"${f.name}" was skipped because a file with the same name already exists.`)
      return false
    }
    names.add(f.name)
    return true
  })
  const space = max - selected.length
  if (unique.length > space) showError(`Only ${space} more file(s) can be added (max ${max} files).`)
  selected.push(...unique.slice(0, space))
}

export function renderFileRows(el, files, icon, onRemove) {
  el.innerHTML = ''
  files.forEach((file, index) => {
    const row = document.createElement('div')
    row.className = 'file-row'
    row.innerHTML = `
      <span class="file-icon">${icon}</span>
      <div class="file-meta">
        <div class="file-name">${escapeHtml(file.name)}</div>
        <div class="file-size">${fmtSize(file.size)}</div>
      </div>
      <button type="button" class="file-remove" data-index="${index}" aria-label="Remove ${escapeHtml(file.name)}">${REMOVE_ICON}</button>
    `
    el.appendChild(row)
  })
  el.querySelectorAll('.file-remove').forEach((btn) => {
    btn.addEventListener('click', () => onRemove(Number(btn.dataset.index)))
  })
}

export function renderResults(listEl, results, icon, extra) {
  listEl.innerHTML = ''
  results.forEach((r, i) => {
    const extraHtml = extra ? extra(r) : ''
    const li = document.createElement('li')
    li.className = 'result-row'
    li.innerHTML = `
      <span class="file-icon">${icon}</span>
      <div class="result-info">
        <div class="result-name">${escapeHtml(r.name)}</div>
        <div class="result-sizes">
          ${r.originalSizeText} <span class="arrow">→</span> <span class="new-size">${r.newSizeText}</span>
          ${r.meta ? `<span class="result-dims">· ${r.meta}</span>` : ''}
        </div>
      </div>
      ${extraHtml}
      <button type="button" class="btn btn-primary btn-sm" data-index="${i}">Download</button>
    `
    listEl.appendChild(li)
  })
  listEl.querySelectorAll('button[data-index]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const r = results[Number(btn.dataset.index)]
      downloadBlob(r.blob, r.name)
    })
  })
}

export function sizeBadge(r) {
  return `<span class="badge ${r.notSmaller ? 'same' : ''}">${r.notSmaller ? 'Similar size' : r.savedPercent + '% smaller'}</span>`
}

export function makeResult(blob, name, originalSize, meta) {
  const saved = Math.max(0, originalSize - blob.size)
  const percent = originalSize > 0 ? Math.round((saved / originalSize) * 100) : 0
  return {
    blob,
    name,
    originalSize,
    newSize: blob.size,
    originalSizeText: fmtSize(originalSize),
    newSizeText: fmtSize(blob.size),
    savedPercent: percent,
    notSmaller: blob.size >= originalSize,
    meta: meta || ''
  }
}
