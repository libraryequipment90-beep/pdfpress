import './style.css'
import { initNavAuth, initNavToggle } from './nav-auth.js'

const loginPanel = document.getElementById('profile-login')
const profilePanel = document.getElementById('profile-panel')
const avatar = document.getElementById('profile-avatar')
const nameEl = document.getElementById('profile-name')
const emailEl = document.getElementById('profile-email')
const providerEl = document.getElementById('profile-provider')
const createdEl = document.getElementById('profile-created')
const signOutBtn = document.getElementById('sign-out-btn')

function titleCase(str) {
  return str ? str.charAt(0).toUpperCase() + str.slice(1) : ''
}

function formatDate(sqliteDate) {
  if (!sqliteDate) return '—'
  const d = new Date(sqliteDate.replace(' ', 'T') + 'Z')
  if (Number.isNaN(d.getTime())) return sqliteDate
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
}

function showProfile(user) {
  loginPanel.classList.add('hidden')
  profilePanel.classList.remove('hidden')
  nameEl.textContent = user.name || 'PDFpress user'
  emailEl.textContent = user.email || 'No email available'
  providerEl.textContent = titleCase(user.provider || 'Unknown')
  createdEl.textContent = formatDate(user.created_at)
  if (user.photo) {
    avatar.src = user.photo
    avatar.classList.remove('hidden')
  } else {
    avatar.classList.add('hidden')
  }
}

async function init() {
  try {
    const res = await fetch('/api/auth/me')
    const { user } = await res.json()
    if (user) showProfile(user)
    else loginPanel.classList.remove('hidden')
  } catch (e) {
    loginPanel.classList.remove('hidden')
  }
}

signOutBtn.addEventListener('click', async () => {
  try {
    await fetch('/api/auth/logout', { method: 'POST' })
  } catch (e) {}
  window.location.href = '/'
})

document.getElementById('year').textContent = new Date().getFullYear()
initNavToggle()
initNavAuth()
init()
