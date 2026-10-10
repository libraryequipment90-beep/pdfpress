export const TOOL_NAV = `
      <a class="brand" href="/">
        <span class="brand-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
            <polyline points="14 2 14 8 20 8"></polyline>
            <line x1="8" y1="13" x2="16" y2="13"></line>
            <line x1="8" y1="17" x2="16" y2="17"></line>
          </svg>
        </span>
        <span class="brand-name">PDF<em>press</em></span>
      </a>
      <nav class="nav-links" id="nav-links">
        <a href="/#tool">Compress PDF</a>
        <div class="nav-dropdown">
          <a href="/tools" class="nav-drop-toggle">Image Tools</a>
          <div class="nav-dropdown-menu">
            <span class="drop-label">Image</span>
            <a href="/resize">Image Resizer</a>
            <a href="/compress-image">Compressor</a>
            <a href="/crop">Crop Image</a>
            <a href="/flip">Flip Image</a>
            <a href="/rotate">Rotate Image</a>
            <a href="/enlarge">Enlarger</a>
            <a href="/color-picker">Color Picker</a>
            <a href="/meme">Meme Generator</a>
            <span class="drop-label">Convert</span>
            <a href="/convert">Image Converter</a>
            <a href="/pdf-to-jpg">PDF to JPG</a>
            <a href="/heic-to-jpg">HEIC to JPG</a>
            <a href="/svg-converter">SVG Converter</a>
            <a href="/pdf-to-png">PDF to PNG</a>
            <a href="/png-to-svg">PNG to SVG</a>
            <a href="/image-to-pdf">Image to PDF</a>
            <a href="/pdf-to-gif">PDF to GIF</a>
          </div>
        </div>
        <a href="/edit-pdf">Edit PDF</a>
        <a href="/tools">All tools</a>
        <a id="nav-profile-btn" href="/profile" class="nav-profile-link hidden">Profile</a>
      </nav>
      <div class="nav-actions">
        <a id="nav-login-btn" href="/signup" class="btn btn-outline btn-sm">Log in</a>
        <a id="nav-auth-btn" href="/signup" class="btn btn-primary btn-sm">Sign up</a>
        <button type="button" id="nav-toggle" class="nav-toggle" aria-label="Toggle menu">
          <span></span><span></span><span></span>
        </button>
      </div>
`

export function injectNav() {
  const inner = document.querySelector('.nav-inner')
  if (inner) inner.innerHTML = TOOL_NAV
}
