export function copyCanvas(src) {
  const canvas = document.createElement('canvas')
  canvas.width = src.width
  canvas.height = src.height
  canvas.getContext('2d').drawImage(src, 0, 0)
  return canvas
}

export function fromImage(img, bg) {
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

export function eachPixel(canvas, fn) {
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  for (let i = 0; i < d.length; i += 4) fn(d, i)
  ctx.putImageData(img, 0, 0)
  return canvas
}

export function grayscale(canvas) {
  return eachPixel(canvas, (d, i) => {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = d[i + 1] = d[i + 2] = g
  })
}

export function invert(canvas) {
  return eachPixel(canvas, (d, i) => {
    d[i] = 255 - d[i]
    d[i + 1] = 255 - d[i + 1]
    d[i + 2] = 255 - d[i + 2]
  })
}

export function sepia(canvas) {
  return eachPixel(canvas, (d, i) => {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    d[i] = Math.min(255, r * 0.393 + g * 0.769 + b * 0.189)
    d[i + 1] = Math.min(255, r * 0.349 + g * 0.686 + b * 0.168)
    d[i + 2] = Math.min(255, r * 0.272 + g * 0.534 + b * 0.131)
  })
}

export function solarize(canvas) {
  return eachPixel(canvas, (d, i) => {
    if (d[i] > 128) d[i] = 255 - d[i]
    if (d[i + 1] > 128) d[i + 1] = 255 - d[i + 1]
    if (d[i + 2] > 128) d[i + 2] = 255 - d[i + 2]
  })
}

export function threshold(canvas, level = 128) {
  return eachPixel(canvas, (d, i) => {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    const v = g >= level ? 255 : 0
    d[i] = d[i + 1] = d[i + 2] = v
  })
}

export function posterize(canvas, levels = 4) {
  const step = 255 / Math.max(2, levels - 1)
  return eachPixel(canvas, (d, i) => {
    d[i] = Math.round(d[i] / step) * step
    d[i + 1] = Math.round(d[i + 1] / step) * step
    d[i + 2] = Math.round(d[i + 2] / step) * step
  })
}

export function noise(canvas, amount = 30) {
  return eachPixel(canvas, (d, i) => {
    const n = (Math.random() - 0.5) * amount * 2
    d[i] = Math.max(0, Math.min(255, d[i] + n))
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n))
  })
}

export function hueRotate(canvas, deg = 90) {
  const a = (deg * Math.PI) / 180
  const cos = Math.cos(a)
  const sin = Math.sin(a)
  return eachPixel(canvas, (d, i) => {
    const r = d[i]
    const g = d[i + 1]
    const b = d[i + 2]
    d[i] = Math.max(0, Math.min(255, r * (0.213 + cos * 0.787 - sin * 0.213) + g * (0.715 - cos * 0.715 - sin * 0.715) + b * (0.072 - cos * 0.072 + sin * 0.928)))
    d[i + 1] = Math.max(0, Math.min(255, r * (0.213 - cos * 0.213 + sin * 0.143) + g * (0.715 + cos * 0.285 + sin * 0.14) + b * (0.072 - cos * 0.072 - sin * 0.283)))
    d[i + 2] = Math.max(0, Math.min(255, r * (0.213 - cos * 0.213 - sin * 0.787) + g * (0.715 - cos * 0.715 + sin * 0.715) + b * (0.072 + cos * 0.928 + sin * 0.072)))
  })
}

export function temperature(canvas, amount = 30) {
  return eachPixel(canvas, (d, i) => {
    d[i] = Math.max(0, Math.min(255, d[i] + amount))
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] - amount))
  })
}

export function gamma(canvas, g = 0.6) {
  const table = new Uint8Array(256)
  for (let i = 0; i < 256; i++) table[i] = Math.max(0, Math.min(255, 255 * Math.pow(i / 255, g)))
  return eachPixel(canvas, (d, i) => {
    d[i] = table[d[i]]
    d[i + 1] = table[d[i + 1]]
    d[i + 2] = table[d[i + 2]]
  })
}

export function autoContrast(canvas) {
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  let min = 255
  let max = 0
  for (let i = 0; i < d.length; i += 4) {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    if (g < min) min = g
    if (g > max) max = g
  }
  const range = Math.max(1, max - min)
  for (let i = 0; i < d.length; i += 4) {
    d[i] = (d[i] - min) * 255 / range
    d[i + 1] = (d[i + 1] - min) * 255 / range
    d[i + 2] = (d[i + 2] - min) * 255 / range
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

export function colorize(canvas, hex = '#ff4b55', mix = 0.45) {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return eachPixel(canvas, (d, i) => {
    const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = gray * (1 - mix) + r * mix
    d[i + 1] = gray * (1 - mix) + g * mix
    d[i + 2] = gray * (1 - mix) + b * mix
  })
}

export function duotone(canvas, dark = '#1a1a2e', light = '#e94560') {
  const dr = parseInt(dark.slice(1, 3), 16)
  const dg = parseInt(dark.slice(3, 5), 16)
  const db = parseInt(dark.slice(5, 7), 16)
  const lr = parseInt(light.slice(1, 3), 16)
  const lg = parseInt(light.slice(3, 5), 16)
  const lb = parseInt(light.slice(5, 7), 16)
  return eachPixel(canvas, (d, i) => {
    const t = (0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]) / 255
    d[i] = dr + (lr - dr) * t
    d[i + 1] = dg + (lg - dg) * t
    d[i + 2] = db + (lb - db) * t
  })
}

export function falseColor(canvas) {
  return eachPixel(canvas, (d, i) => {
    const g = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
    d[i] = Math.min(255, g * 1.4)
    d[i + 1] = Math.abs(128 - g) * 2
    d[i + 2] = 255 - g
  })
}

export function adjust(canvas, { brightness = 0, contrast = 0, saturation = 0 } = {}) {
  const b = brightness
  const c = (259 * (contrast + 255)) / (255 * (259 - contrast))
  const s = saturation / 100
  return eachPixel(canvas, (d, i) => {
    let r = c * (d[i] - 128) + 128 + b
    let g = c * (d[i + 1] - 128) + 128 + b
    let bl = c * (d[i + 2] - 128) + 128 + b
    const gray = 0.299 * r + 0.587 * g + 0.114 * bl
    r = gray + (r - gray) * (1 + s)
    g = gray + (g - gray) * (1 + s)
    bl = gray + (bl - gray) * (1 + s)
    d[i] = Math.max(0, Math.min(255, r))
    d[i + 1] = Math.max(0, Math.min(255, g))
    d[i + 2] = Math.max(0, Math.min(255, bl))
  })
}

export function convolve(canvas, kernel, divisor) {
  const ctx = canvas.getContext('2d')
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const out = ctx.createImageData(src)
  const w = canvas.width
  const h = canvas.height
  const d = src.data
  const o = out.data
  const k = kernel
  const div = divisor || k.reduce((a, b) => a + b, 0) || 1
  const side = Math.sqrt(k.length) | 0
  const half = (side / 2) | 0
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r = 0
      let g = 0
      let b = 0
      for (let ky = 0; ky < side; ky++) {
        for (let kx = 0; kx < side; kx++) {
          const ix = Math.min(w - 1, Math.max(0, x + kx - half))
          const iy = Math.min(h - 1, Math.max(0, y + ky - half))
          const idx = (iy * w + ix) * 4
          const kv = k[ky * side + kx]
          r += d[idx] * kv
          g += d[idx + 1] * kv
          b += d[idx + 2] * kv
        }
      }
      const i = (y * w + x) * 4
      o[i] = Math.max(0, Math.min(255, r / div + 128 * (div === 0 ? 1 : 0)))
      o[i + 1] = Math.max(0, Math.min(255, g / div + 128 * (div === 0 ? 1 : 0)))
      o[i + 2] = Math.max(0, Math.min(255, b / div + 128 * (div === 0 ? 1 : 0)))
      o[i + 3] = d[i + 3]
    }
  }
  if (div === 0) {
    for (let i = 0; i < o.length; i += 4) {
      o[i] = Math.max(0, Math.min(255, o[i]))
      o[i + 1] = Math.max(0, Math.min(255, o[i + 1]))
      o[i + 2] = Math.max(0, Math.min(255, o[i + 2]))
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

export function blur(canvas, radius = 2) {
  const tmp = copyCanvas(canvas)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.filter = `blur(${radius}px)`
  ctx.drawImage(tmp, 0, 0)
  ctx.filter = 'none'
  return canvas
}

export function sharpen(canvas) {
  return convolve(canvas, [0, -1, 0, -1, 5, -1, 0, -1, 0], 1)
}

export function emboss(canvas) {
  return convolve(canvas, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 1)
}

export function edgeDetect(canvas) {
  return convolve(canvas, [-1, -1, -1, -1, 8, -1, -1, -1, -1], 1)
}

export function median(canvas) {
  const ctx = canvas.getContext('2d')
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const out = ctx.createImageData(src)
  const w = canvas.width
  const h = canvas.height
  const d = src.data
  const o = out.data
  const rs = []
  const gs = []
  const bs = []
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      rs.length = 0
      gs.length = 0
      bs.length = 0
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const idx = ((y + dy) * w + (x + dx)) * 4
          rs.push(d[idx])
          gs.push(d[idx + 1])
          bs.push(d[idx + 2])
        }
      }
      rs.sort((a, b) => a - b)
      gs.sort((a, b) => a - b)
      bs.sort((a, b) => a - b)
      const i = (y * w + x) * 4
      o[i] = rs[4]
      o[i + 1] = gs[4]
      o[i + 2] = bs[4]
      o[i + 3] = d[i + 3]
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

export function pixelate(canvas, size = 12) {
  const w = canvas.width
  const h = canvas.height
  const ctx = canvas.getContext('2d')
  const sw = Math.max(1, Math.round(w / size))
  const sh = Math.max(1, Math.round(h / size))
  ctx.imageSmoothingEnabled = false
  const tmp = document.createElement('canvas')
  tmp.width = sw
  tmp.height = sh
  tmp.getContext('2d').drawImage(canvas, 0, 0, sw, sh)
  ctx.clearRect(0, 0, w, h)
  ctx.drawImage(tmp, 0, 0, w, h)
  ctx.imageSmoothingEnabled = true
  return canvas
}

export function pixelArt(canvas, scale = 8) {
  return pixelate(canvas, scale)
}

export function dither(canvas) {
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  const w = canvas.width
  const h = canvas.height
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4
      const old = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2]
      const neu = old < 128 ? 0 : 255
      const err = old - neu
      d[i] = d[i + 1] = d[i + 2] = neu
      const spread = (dx, dy, f) => {
        const nx = x + dx
        const ny = y + dy
        if (nx < 0 || nx >= w || ny < 0 || ny >= h) return
        const j = (ny * w + nx) * 4
        const add = err * f
        d[j] = Math.max(0, Math.min(255, d[j] + add))
        d[j + 1] = Math.max(0, Math.min(255, d[j + 1] + add))
        d[j + 2] = Math.max(0, Math.min(255, d[j + 2] + add))
      }
      spread(1, 0, 7 / 16)
      spread(-1, 1, 3 / 16)
      spread(0, 1, 5 / 16)
      spread(1, 1, 1 / 16)
    }
  }
  ctx.putImageData(img, 0, 0)
  return canvas
}

export function vignette(canvas, strength = 0.55) {
  const ctx = canvas.getContext('2d')
  const g = ctx.createRadialGradient(canvas.width / 2, canvas.height / 2, canvas.width * 0.2, canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.7)
  g.addColorStop(0, 'rgba(0,0,0,0)')
  g.addColorStop(1, `rgba(0,0,0,${strength})`)
  ctx.fillStyle = g
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  return canvas
}

export function sketch(canvas) {
  grayscale(canvas)
  const inv = copyCanvas(canvas)
  invert(inv)
  blur(inv, 4)
  const ctx = canvas.getContext('2d')
  ctx.globalCompositeOperation = 'color-dodge'
  ctx.drawImage(inv, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

export function cartoon(canvas) {
  const edges = copyCanvas(canvas)
  grayscale(edges)
  edgeDetect(edges)
  invert(edges)
  threshold(edges, 200)
  median(canvas)
  posterize(canvas, 6)
  const ctx = canvas.getContext('2d')
  ctx.globalCompositeOperation = 'multiply'
  ctx.drawImage(edges, 0, 0)
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

export function glow(canvas) {
  const soft = copyCanvas(canvas)
  blur(soft, 8)
  const ctx = canvas.getContext('2d')
  ctx.globalCompositeOperation = 'screen'
  ctx.globalAlpha = 0.65
  ctx.drawImage(soft, 0, 0)
  ctx.globalAlpha = 1
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

export function scanlines(canvas) {
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = 'rgba(0,0,0,0.28)'
  for (let y = 0; y < canvas.height; y += 3) ctx.fillRect(0, y, canvas.width, 1)
  return canvas
}

export function glitch(canvas) {
  const ctx = canvas.getContext('2d')
  const slices = 12
  for (let i = 0; i < slices; i++) {
    const y = Math.random() * canvas.height
    const h = 8 + Math.random() * 24
    const dx = (Math.random() - 0.5) * 40
    ctx.drawImage(canvas, 0, y, canvas.width, h, dx, y, canvas.width, h)
  }
  ctx.globalCompositeOperation = 'screen'
  ctx.fillStyle = 'rgba(255,0,80,0.12)'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'source-over'
  return canvas
}

export function chromatic(canvas, offset = 4) {
  const src = copyCanvas(canvas)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.globalCompositeOperation = 'lighter'
  ctx.drawImage(src, -offset, 0)
  const r = ctx.getImageData(0, 0, canvas.width, canvas.height)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(src, 0, 0)
  const g = ctx.getImageData(0, 0, canvas.width, canvas.height)
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  ctx.drawImage(src, offset, 0)
  const b = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const out = ctx.createImageData(canvas.width, canvas.height)
  for (let i = 0; i < out.data.length; i += 4) {
    out.data[i] = r.data[i]
    out.data[i + 1] = g.data[i + 1]
    out.data[i + 2] = b.data[i + 2]
    out.data[i + 3] = 255
  }
  ctx.globalCompositeOperation = 'source-over'
  ctx.putImageData(out, 0, 0)
  return canvas
}

export function anaglyph(canvas) {
  return chromatic(canvas, 8)
}

export function kaleidoscope(canvas) {
  const size = Math.min(canvas.width, canvas.height)
  const src = copyCanvas(canvas)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.save()
  ctx.translate(canvas.width / 2, canvas.height / 2)
  for (let i = 0; i < 8; i++) {
    ctx.save()
    ctx.rotate((Math.PI / 4) * i)
    ctx.drawImage(src, 0, 0, size / 2, size / 2, 0, 0, size / 2, size / 2)
    ctx.scale(-1, 1)
    ctx.drawImage(src, 0, 0, size / 2, size / 2, 0, 0, size / 2, size / 2)
    ctx.restore()
  }
  ctx.restore()
  return canvas
}

export function mosaic(canvas, size = 16) {
  return pixelate(canvas, size)
}

export function halftone(canvas, cell = 10) {
  const src = copyCanvas(canvas)
  grayscale(src)
  const sctx = src.getContext('2d')
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.fillStyle = '#000'
  for (let y = 0; y < canvas.height; y += cell) {
    for (let x = 0; x < canvas.width; x += cell) {
      const p = sctx.getImageData(x, y, 1, 1).data[0]
      const r = ((255 - p) / 255) * (cell / 2)
      ctx.beginPath()
      ctx.arc(x + cell / 2, y + cell / 2, r, 0, Math.PI * 2)
      ctx.fill()
    }
  }
  return canvas
}

export function wave(canvas, amp = 12) {
  const src = copyCanvas(canvas)
  const ctx = canvas.getContext('2d')
  ctx.clearRect(0, 0, canvas.width, canvas.height)
  for (let y = 0; y < canvas.height; y++) {
    const dx = Math.sin(y / 18) * amp
    ctx.drawImage(src, 0, y, canvas.width, 1, dx, y, canvas.width, 1)
  }
  return canvas
}

export function twirl(canvas, strength = 2.2) {
  const ctx = canvas.getContext('2d')
  const src = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const out = ctx.createImageData(src)
  const w = canvas.width
  const h = canvas.height
  const cx = w / 2
  const cy = h / 2
  const maxR = Math.min(cx, cy)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = x - cx
      const dy = y - cy
      const r = Math.sqrt(dx * dx + dy * dy)
      let sx = x
      let sy = y
      if (r < maxR) {
        const a = Math.atan2(dy, dx) + (1 - r / maxR) * strength
        sx = cx + Math.cos(a) * r
        sy = cy + Math.sin(a) * r
      }
      const si = ((Math.max(0, Math.min(h - 1, sy | 0)) * w + Math.max(0, Math.min(w - 1, sx | 0))) * 4)
      const i = (y * w + x) * 4
      out.data[i] = src.data[si]
      out.data[i + 1] = src.data[si + 1]
      out.data[i + 2] = src.data[si + 2]
      out.data[i + 3] = src.data[si + 3]
    }
  }
  ctx.putImageData(out, 0, 0)
  return canvas
}

export function addBorder(canvas, width = 24, color = '#ffffff') {
  const out = document.createElement('canvas')
  out.width = canvas.width + width * 2
  out.height = canvas.height + width * 2
  const ctx = out.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas, width, width)
  return out
}

export function addPadding(canvas, pad = 40, color = '#ffffff') {
  return addBorder(canvas, pad, color)
}

export function rounded(canvas, radius = 48) {
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext('2d')
  const r = Math.min(radius, canvas.width / 2, canvas.height / 2)
  ctx.beginPath()
  ctx.moveTo(r, 0)
  ctx.arcTo(canvas.width, 0, canvas.width, canvas.height, r)
  ctx.arcTo(canvas.width, canvas.height, 0, canvas.height, r)
  ctx.arcTo(0, canvas.height, 0, 0, r)
  ctx.arcTo(0, 0, canvas.width, 0, r)
  ctx.closePath()
  ctx.clip()
  ctx.drawImage(canvas, 0, 0)
  return out
}

export function circleCrop(canvas) {
  const size = Math.min(canvas.width, canvas.height)
  const out = document.createElement('canvas')
  out.width = size
  out.height = size
  const ctx = out.getContext('2d')
  ctx.beginPath()
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2)
  ctx.clip()
  const sx = (canvas.width - size) / 2
  const sy = (canvas.height - size) / 2
  ctx.drawImage(canvas, sx, sy, size, size, 0, 0, size, size)
  return out
}

export function dropShadow(canvas, blurAmt = 18, color = 'rgba(0,0,0,0.35)') {
  const pad = blurAmt * 2
  const out = document.createElement('canvas')
  out.width = canvas.width + pad * 2
  out.height = canvas.height + pad * 2
  const ctx = out.getContext('2d')
  ctx.shadowColor = color
  ctx.shadowBlur = blurAmt
  ctx.shadowOffsetY = blurAmt / 2
  ctx.drawImage(canvas, pad, pad)
  return out
}

export function reflection(canvas, heightPct = 0.4) {
  const rh = Math.round(canvas.height * heightPct)
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height + rh
  const ctx = out.getContext('2d')
  ctx.drawImage(canvas, 0, 0)
  ctx.save()
  ctx.translate(0, canvas.height * 2)
  ctx.scale(1, -1)
  ctx.drawImage(canvas, 0, 0)
  ctx.restore()
  const g = ctx.createLinearGradient(0, canvas.height, 0, out.height)
  g.addColorStop(0, 'rgba(255,255,255,0.45)')
  g.addColorStop(1, 'rgba(255,255,255,1)')
  ctx.globalCompositeOperation = 'destination-out'
  ctx.fillStyle = g
  ctx.fillRect(0, canvas.height, canvas.width, rh)
  ctx.globalCompositeOperation = 'source-over'
  return out
}

export function polaroid(canvas) {
  const padX = Math.round(canvas.width * 0.06)
  const padTop = padX
  const padBot = Math.round(canvas.width * 0.18)
  const out = document.createElement('canvas')
  out.width = canvas.width + padX * 2
  out.height = canvas.height + padTop + padBot
  const ctx = out.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas, padX, padTop)
  return out
}

export function outline(canvas, width = 8, color = '#111111') {
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext('2d')
  ctx.shadowColor = color
  ctx.shadowBlur = width
  for (let i = 0; i < 8; i++) ctx.drawImage(canvas, 0, 0)
  ctx.shadowBlur = 0
  ctx.drawImage(canvas, 0, 0)
  return out
}

export function letterbox(canvas, tw, th, color = '#000000') {
  const out = document.createElement('canvas')
  out.width = tw
  out.height = th
  const ctx = out.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, tw, th)
  const scale = Math.min(tw / canvas.width, th / canvas.height)
  const dw = canvas.width * scale
  const dh = canvas.height * scale
  ctx.drawImage(canvas, (tw - dw) / 2, (th - dh) / 2, dw, dh)
  return out
}

export function trimWhitespace(canvas, limit = 245) {
  const ctx = canvas.getContext('2d')
  const img = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const d = img.data
  let top = 0
  let left = 0
  let right = canvas.width - 1
  let bottom = canvas.height - 1
  const empty = (i) => d[i] >= limit && d[i + 1] >= limit && d[i + 2] >= limit
  scan:
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) if (!empty((y * canvas.width + x) * 4)) { top = y; break scan }
  }
  scan2:
  for (let y = canvas.height - 1; y >= 0; y--) {
    for (let x = 0; x < canvas.width; x++) if (!empty((y * canvas.width + x) * 4)) { bottom = y; break scan2 }
  }
  scan3:
  for (let x = 0; x < canvas.width; x++) {
    for (let y = 0; y < canvas.height; y++) if (!empty((y * canvas.width + x) * 4)) { left = x; break scan3 }
  }
  scan4:
  for (let x = canvas.width - 1; x >= 0; x--) {
    for (let y = 0; y < canvas.height; y++) if (!empty((y * canvas.width + x) * 4)) { right = x; break scan4 }
  }
  const w = Math.max(1, right - left + 1)
  const h = Math.max(1, bottom - top + 1)
  const out = document.createElement('canvas')
  out.width = w
  out.height = h
  out.getContext('2d').drawImage(canvas, left, top, w, h, 0, 0, w, h)
  return out
}

export function makeTransparent(canvas, hex, tolerance = 40) {
  const tr = parseInt(hex.slice(1, 3), 16)
  const tg = parseInt(hex.slice(3, 5), 16)
  const tb = parseInt(hex.slice(5, 7), 16)
  return eachPixel(canvas, (d, i) => {
    if (Math.abs(d[i] - tr) + Math.abs(d[i + 1] - tg) + Math.abs(d[i + 2] - tb) <= tolerance * 3) d[i + 3] = 0
  })
}

export function replaceColor(canvas, from, to, tolerance = 40) {
  const fr = parseInt(from.slice(1, 3), 16)
  const fg = parseInt(from.slice(3, 5), 16)
  const fb = parseInt(from.slice(5, 7), 16)
  const tr = parseInt(to.slice(1, 3), 16)
  const tg = parseInt(to.slice(3, 5), 16)
  const tb = parseInt(to.slice(5, 7), 16)
  return eachPixel(canvas, (d, i) => {
    if (Math.abs(d[i] - fr) + Math.abs(d[i + 1] - fg) + Math.abs(d[i + 2] - fb) <= tolerance * 3) {
      d[i] = tr
      d[i + 1] = tg
      d[i + 2] = tb
    }
  })
}

export function changeBackground(canvas, color = '#ffffff') {
  const out = document.createElement('canvas')
  out.width = canvas.width
  out.height = canvas.height
  const ctx = out.getContext('2d')
  ctx.fillStyle = color
  ctx.fillRect(0, 0, out.width, out.height)
  ctx.drawImage(canvas, 0, 0)
  return out
}

export function gradientOverlay(canvas, c1 = '#ff4b55', c2 = '#ff7a3d', alpha = 0.35) {
  const ctx = canvas.getContext('2d')
  const g = ctx.createLinearGradient(0, 0, canvas.width, canvas.height)
  g.addColorStop(0, c1)
  g.addColorStop(1, c2)
  ctx.globalAlpha = alpha
  ctx.fillStyle = g
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.globalAlpha = 1
  return canvas
}

export function thumbnail(canvas, max = 256) {
  const scale = Math.min(1, max / Math.max(canvas.width, canvas.height))
  const out = document.createElement('canvas')
  out.width = Math.max(1, Math.round(canvas.width * scale))
  out.height = Math.max(1, Math.round(canvas.height * scale))
  const ctx = out.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(canvas, 0, 0, out.width, out.height)
  return out
}

export function applyPreset(canvas, name) {
  if (name === 'vintage') { sepia(canvas); adjust(canvas, { contrast: 10, saturation: -20 }); vignette(canvas, 0.4) }
  else if (name === 'cool') hueRotate(canvas, 200)
  else if (name === 'warm') temperature(canvas, 28)
  else if (name === 'dramatic') { adjust(canvas, { contrast: 40, saturation: 15, brightness: -10 }); vignette(canvas, 0.5) }
  else if (name === 'fade') adjust(canvas, { contrast: -25, saturation: -30, brightness: 20 })
  else if (name === 'noir') { grayscale(canvas); adjust(canvas, { contrast: 35 }) }
  return canvas
}
