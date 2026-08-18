const express = require('express')
const multer = require('multer')
const archiver = require('archiver')
const { execFile } = require('child_process')
const fs = require('fs')
const os = require('os')
const path = require('path')
const crypto = require('crypto')

const app = express()
const PORT = process.env.PORT || 3001
const MAX_FILE_SIZE = 150 * 1024 * 1024
const SESSION_TTL = 30 * 60 * 1000

const sessions = new Map()

function now() {
  return new Date().toISOString()
}

function log(msg) {
  console.log(`[${now()}] ${msg}`)
}

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, os.tmpdir()),
    filename: (req, file, cb) => cb(null, crypto.randomBytes(16).toString('hex') + '.pdf')
  }),
  limits: { fileSize: MAX_FILE_SIZE, files: 20 },
  fileFilter: (req, file, cb) => {
    const isPdf = file.mimetype === 'application/pdf' || /\.pdf$/i.test(file.originalname)
    if (isPdf) cb(null, true)
    else cb(new Error('Only PDF files are allowed'))
  }
})

const LEVELS = {
  extreme: {
    label: 'Extreme compression',
    settings: '/screen',
    colorImageResolution: 40,
    grayImageResolution: 40,
    monoImageResolution: 100,
    jpegQuality: 50,
    autoFilter: false,
    compatibility: '1.4'
  },
  recommended: {
    label: 'Recommended compression',
    settings: '/ebook',
    colorImageResolution: 110,
    grayImageResolution: 110,
    monoImageResolution: 200,
    jpegQuality: 80,
    autoFilter: true,
    compatibility: '1.5'
  },
  less: {
    label: 'Less compression',
    settings: '/printer',
    colorImageResolution: 200,
    grayImageResolution: 200,
    monoImageResolution: 300,
    jpegQuality: 90,
    autoFilter: true,
    compatibility: '1.7'
  }
}

function buildGsArgs(level, input, output) {
  const opts = LEVELS[level]
  return [
    '-sDEVICE=pdfwrite',
    `-dCompatibilityLevel=${opts.compatibility}`,
    `-dPDFSETTINGS=${opts.settings}`,
    '-dNOPAUSE',
    '-dQUIET',
    '-dBATCH',
    '-dDetectDuplicateImages=true',
    '-dCompressFonts=true',
    '-dSubsetFonts=true',
    '-dEmbedAllFonts=true',
    '-dAutoRotatePages=/All',
    '-dUseCIEColor=false',
    '-dDownsampleColorImages=true',
    `-dColorImageResolution=${opts.colorImageResolution}`,
    '-dDownsampleGrayImages=true',
    `-dGrayImageResolution=${opts.grayImageResolution}`,
    '-dDownsampleMonoImages=true',
    `-dMonoImageResolution=${opts.monoImageResolution}`,
    `-dAutoFilterColorImages=${opts.autoFilter}`,
    '-dColorImageFilter=/DCTEncode',
    `-dJPEGQ=${opts.jpegQuality}`,
    `-sOutputFile=${output}`,
    input
  ]
}

function compressPdf(inputPath, outputPath, level) {
  return new Promise((resolve, reject) => {
    const args = buildGsArgs(level, inputPath, outputPath)
    execFile('gs', args, { timeout: 120000, maxBuffer: 1024 * 1024 }, (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message))
        return
      }
      resolve()
    })
  })
}

function createSession() {
  const sessionId = crypto.randomBytes(12).toString('hex')
  const session = { createdAt: Date.now(), files: [] }
  sessions.set(sessionId, session)
  setTimeout(() => cleanupSession(sessionId), SESSION_TTL)
  return sessionId
}

function cleanupSession(sessionId) {
  const session = sessions.get(sessionId)
  if (!session) return
  for (const f of session.files) {
    for (const p of [f.inputPath, f.outputPath]) {
      fs.promises.unlink(p).catch(() => {})
    }
  }
  sessions.delete(sessionId)
}

function fmtSize(bytes) {
  if (bytes >= 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(2) + ' MB'
  if (bytes >= 1024) return (bytes / 1024).toFixed(0) + ' KB'
  return bytes + ' B'
}

app.use(express.json())

app.get('/api/health', (req, res) => {
  res.json({ ok: true })
})

app.post('/api/compress', upload.array('files', 20), async (req, res) => {
  const level = LEVELS[req.body.level] ? req.body.level : 'recommended'
  const files = req.files || []

  if (files.length === 0) {
    return res.status(400).json({ error: 'No PDF files were uploaded.' })
  }

  const sessionId = createSession()
  const session = sessions.get(sessionId)
  const results = []

  try {
    for (let i = 0; i < files.length; i++) {
      const file = files[i]
      const inputPath = file.path
      const outputPath = path.join(os.tmpdir(), crypto.randomBytes(16).toString('hex') + '.pdf')
      const originalSize = fs.statSync(inputPath).size

      await compressPdf(inputPath, outputPath, level)

      const compressedSize = fs.statSync(outputPath).size
      const originalName = file.originalname.replace(/\.pdf$/i, '') || 'document'

      session.files.push({
        inputPath,
        outputPath,
        originalName: originalName + '.pdf',
        compressedName: originalName + '-compressed.pdf'
      })

      const saved = Math.max(0, originalSize - compressedSize)
      const percent = originalSize > 0 ? Math.round((saved / originalSize) * 100) : 0

      results.push({
        id: i,
        originalName: originalName + '.pdf',
        compressedName: originalName + '-compressed.pdf',
        originalSize,
        compressedSize,
        originalSizeText: fmtSize(originalSize),
        compressedSizeText: fmtSize(compressedSize),
        savedPercent: percent,
        notSmaller: compressedSize >= originalSize
      })
    }

    res.json({ sessionId, level, results })
  } catch (err) {
    log('Compression error: ' + err.message)
    cleanupSession(sessionId)
    res.status(500).json({ error: 'Compression failed: ' + err.message })
  }
})

app.get('/api/download/:sessionId/:index', (req, res) => {
  const session = sessions.get(req.params.sessionId)
  const index = parseInt(req.params.index, 10)
  if (!session || !session.files[index]) {
    return res.status(404).json({ error: 'File not found or session expired.' })
  }
  const f = session.files[index]
  res.download(f.outputPath, f.compressedName, () => {
    setTimeout(() => cleanupSession(req.params.sessionId), 5000)
  })
})

app.get('/api/download-all/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId)
  if (!session || session.files.length === 0) {
    return res.status(404).json({ error: 'Session not found or expired.' })
  }

  res.setHeader('Content-Type', 'application/zip')
  res.setHeader('Content-Disposition', 'attachment; filename="compressed-pdfs.zip"')

  const archive = archiver('zip', { zlib: { level: 9 } })
  archive.on('error', (err) => {
    log('Zip error: ' + err.message)
    res.status(500).end()
  })
  archive.on('end', () => {
    setTimeout(() => cleanupSession(req.params.sessionId), 5000)
  })
  archive.pipe(res)

  for (const f of session.files) {
    archive.file(f.outputPath, { name: f.compressedName })
  }
  archive.finalize()
})

app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    const msg = err.code === 'LIMIT_FILE_SIZE'
      ? 'File is too large. Maximum size is 150 MB.'
      : err.message
    return res.status(400).json({ error: msg })
  }
  if (err && err.message) {
    return res.status(400).json({ error: err.message })
  }
  next(err)
})

app.listen(PORT, () => {
  log(`PDFpress API listening on http://localhost:${PORT}`)
})
