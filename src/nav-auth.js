export async function initNavAuth() {
  const navBtn = document.getElementById('nav-auth-btn')
  const loginBtn = document.getElementById('nav-login-btn')
  const profileBtn = document.getElementById('nav-profile-btn')

  try {
    const res = await fetch('/api/auth/me')
    const { user } = await res.json()

    if (user) {
      if (loginBtn) loginBtn.classList.add('hidden')
      if (navBtn) navBtn.classList.add('hidden')
      if (profileBtn) profileBtn.classList.remove('hidden')
    }
  } catch (e) {
    // leave navbar as-is when auth service is unavailable
  }
}

export function initNavToggle() {
  const toggle = document.getElementById('nav-toggle')
  const links = document.getElementById('nav-links')
  if (!toggle || !links) return
  toggle.addEventListener('click', () => {
    links.classList.toggle('open')
  })
  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) {
      links.classList.remove('open')
    }
  })
}
