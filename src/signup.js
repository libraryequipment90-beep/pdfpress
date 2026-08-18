import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'

const loginPanel = document.getElementById('login-panel')
const accountPanel = document.getElementById('account-panel')
const googleBtn = document.getElementById('google-btn')
const facebookBtn = document.getElementById('facebook-btn')
const authMessage = document.getElementById('auth-message')
const signOutBtn = document.getElementById('sign-out-btn')
const accountName = document.getElementById('account-name')
const accountEmail = document.getElementById('account-email')
const accountAvatar = document.getElementById('account-avatar')

function showMessage(text, isError = false) {
  authMessage.textContent = text
  authMessage.classList.toggle('error', isError)
  authMessage.classList.remove('hidden')
}

function disableProvider(btn, message) {
  btn.disabled = true
  const label = btn.querySelector('.oauth-label')
  if (label) label.textContent = message
}

function applyUser(user) {
  loginPanel.classList.add('hidden')
  accountPanel.classList.remove('hidden')
  accountName.textContent = user.name || 'PDFpress user'
  accountEmail.textContent = user.email || (user.provider === 'google' ? 'Google account' : 'Facebook account')
  if (user.photo) {
    accountAvatar.src = user.photo
    accountAvatar.classList.remove('hidden')
  } else {
    accountAvatar.classList.add('hidden')
  }
}

async function init() {
  const params = new URLSearchParams(window.location.search)
  if (params.get('error')) {
    showMessage('Sign-in failed. Please try again.', true)
  } else if (params.get('success')) {
    showMessage('You are signed in.')
  }

  try {
    const [cfgRes, meRes] = await Promise.all([fetch('/api/auth/config'), fetch('/api/auth/me')])
    const cfg = await cfgRes.json()
    const { user } = await meRes.json()

    if (cfg.google && !cfg.google.enabled) {
      disableProvider(googleBtn, 'Google sign-in not configured')
    }
    if (cfg.facebook && !cfg.facebook.enabled) {
      disableProvider(facebookBtn, 'Facebook sign-in not configured')
    }

    if (user) applyUser(user)
  } catch (e) {
    showMessage('Unable to reach the authentication service. Please try again later.', true)
  }
}

googleBtn.addEventListener('click', () => {
  window.location.href = '/api/auth/google'
})

facebookBtn.addEventListener('click', () => {
  window.location.href = '/api/auth/facebook'
})

signOutBtn.addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch (e) {}
  window.location.reload()
})

document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
init()
