const http = require('http')
const { URL } = require('url')

process.env.PORT = '3100'
process.env.PUBLIC_URL = ''
process.env.SESSION_SECRET = 'test-session-secret'
process.env.GOOGLE_CLIENT_ID = 'test-google-client-id'
process.env.GOOGLE_CLIENT_SECRET = 'test-google-client-secret'
process.env.FACEBOOK_APP_ID = 'test-facebook-app-id'
process.env.FACEBOOK_APP_SECRET = 'test-facebook-app-secret'
process.env.GOOGLE_AUTHORIZATION_URL = 'http://localhost:3200/google/authorize'
process.env.GOOGLE_TOKEN_URL = 'http://localhost:3200/google/token'
process.env.GOOGLE_USER_PROFILE_URL = 'http://localhost:3200/google/userinfo'
process.env.FACEBOOK_AUTHORIZATION_URL = 'http://localhost:3200/facebook/authorize'
process.env.FACEBOOK_TOKEN_URL = 'http://localhost:3200/facebook/token'
process.env.FACEBOOK_USER_PROFILE_URL = 'http://localhost:3200/facebook/me'

require('../server/server.js')

const APP_PORT = 3100
const MOCK_PORT = 3200
let failures = 0

function pass(name) {
  console.log(`  PASS  ${name}`)
}

function fail(name, detail) {
  failures++
  console.error(`  FAIL  ${name}: ${detail}`)
}

function assert(cond, name, detail) {
  if (cond) pass(name)
  else fail(name, detail)
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = ''
    req.on('data', (c) => (data += c))
    req.on('end', () => resolve(data))
  })
}

const mock = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${MOCK_PORT}`)
  const path = url.pathname
  res.setHeader('Content-Type', 'application/json')

  if (path === '/google/authorize' || path === '/facebook/authorize') {
    const redirectUri = url.searchParams.get('redirect_uri')
    const state = url.searchParams.get('state')
    const code = path.startsWith('/google') ? 'GOOGLE_TEST_CODE' : 'FACEBOOK_TEST_CODE'
    const sep = redirectUri.includes('?') ? '&' : '?'
    res.statusCode = 302
    res.setHeader('Location', `${redirectUri}${sep}code=${code}&state=${state}`)
    return res.end()
  }

  if (path === '/google/token' || path === '/facebook/token') {
    await readBody(req)
    return res.end(JSON.stringify({ access_token: 'test-access-token', expires_in: 3600 }))
  }

  if (path === '/google/userinfo') {
    return res.end(
      JSON.stringify({
        sub: 'google-sub-123',
        name: 'Google Test User',
        given_name: 'Google',
        family_name: 'Test',
        email: 'googleuser@gmail.com',
        email_verified: true,
        picture: 'https://mock.test/google/photo.png'
      })
    )
  }

  if (path === '/facebook/me') {
    return res.end(
      JSON.stringify({
        id: 'facebook-id-456',
        name: 'Facebook Test User',
        email: 'fbuser@facebook.com',
        picture: { data: { url: 'https://mock.test/facebook/photo.png' } }
      })
    )
  }

  res.statusCode = 404
  res.end(JSON.stringify({ error: 'mock route not found' }))
})

function cookieFromSetCookie(res) {
  const raw = res.headers.get('set-cookie')
  if (!raw) return ''
  const cookies = Array.isArray(raw) ? raw : [raw]
  return cookies
    .map((c) => c.split(';')[0])
    .filter((c) => !/^connect\.sid=;/.test(c))
    .join('; ')
}

function mergeCookie(prev, res) {
  const newCookie = cookieFromSetCookie(res)
  if (!newCookie) return prev
  return newCookie
}

async function get(url, cookie) {
  const headers = cookie ? { cookie } : {}
  const res = await fetch(url, { headers, redirect: 'manual' })
  return { res, cookie: mergeCookie(cookie, res), location: res.headers.get('location') }
}

async function post(url, cookie) {
  const res = await fetch(url, {
    method: 'POST',
    headers: cookie ? { cookie } : {},
    redirect: 'manual'
  })
  return { res, cookie: mergeCookie(cookie, res) }
}

async function runGoogleFlow() {
  console.log('\nGoogle OAuth flow:')

  let r = await get(`http://localhost:${APP_PORT}/api/auth/google`)
  assert(r.res.status === 302, 'GET /api/auth/google redirects to provider', `got ${r.res.status}`)
  assert(
    r.location && r.location.startsWith('http://localhost:3200/google/authorize'),
    'redirect targets mock Google authorize URL',
    r.location
  )
  assert(r.location.includes('client_id=test-google-client-id'), 'client_id passed', r.location)
  assert(
    r.location.includes(
      `redirect_uri=${encodeURIComponent(`http://localhost:${APP_PORT}/api/auth/google/callback`)}`
    ),
    'callbackURL built from request host',
    r.location
  )
  assert(r.location.includes('state='), 'state parameter present', r.location)

  r = await get(r.location, r.cookie)
  assert(r.res.status === 302, 'provider redirects back to app callback', `got ${r.res.status}`)
  assert(
    r.location && r.location.includes('code=GOOGLE_TEST_CODE'),
    'callback carries authorization code',
    r.location
  )

  r = await get(r.location, r.cookie)
  assert(r.res.status === 302, 'callback redirects after login', `got ${r.res.status}`)
  assert(r.location.includes('/signup?success=1'), 'successRedirect to /signup', r.location)

  const me = await get(`http://localhost:${APP_PORT}/api/auth/me`, r.cookie)
  const body = JSON.parse(await me.res.text())
  assert(me.res.status === 200 && body.user, 'session persists - /me returns user', JSON.stringify(body))
  assert(body.user.provider === 'google', 'provider = google', body.user.provider)
  assert(body.user.name === 'Google Test User', 'name stored', body.user.name)
  assert(body.user.email === 'googleuser@gmail.com', 'email stored', body.user.email)
  assert(body.user.photo === 'https://mock.test/google/photo.png', 'photo stored', body.user.photo)
  assert(typeof body.user.id === 'number', 'internal user id stored', body.user.id)
  assert(body.user.provider_id === 'google-sub-123', 'provider id stored', body.user.provider_id)
  assert(!('accessToken' in body.user), 'access token NOT stored', JSON.stringify(body.user))

  const loggedInCookie = me.cookie
  const anon = await get(`http://localhost:${APP_PORT}/api/auth/me`)
  const anonBody = JSON.parse(await anon.res.text())
  assert(anonBody.user === null, 'fresh request without cookie is anonymous', JSON.stringify(anonBody))

  const stillLoggedIn = await get(`http://localhost:${APP_PORT}/api/auth/me`, loggedInCookie)
  const stillLoggedInBody = JSON.parse(await stillLoggedIn.res.text())
  assert(
    stillLoggedInBody.user && stillLoggedInBody.user.provider === 'google',
    'logged-in cookie still authenticates (session persistence)',
    JSON.stringify(stillLoggedInBody)
  )

  const out = await post(`http://localhost:${APP_PORT}/api/auth/logout`, loggedInCookie)
  const outBody = JSON.parse(await out.res.text())
  assert(out.res.status === 200 && outBody.ok, 'logout succeeds', JSON.stringify(outBody))

  const me2 = await get(`http://localhost:${APP_PORT}/api/auth/me`, out.cookie)
  const body2 = JSON.parse(await me2.res.text())
  assert(body2.user === null, 'session cleared after logout', JSON.stringify(body2))

  let r2 = await get(`http://localhost:${APP_PORT}/api/auth/google`)
  r2 = await get(r2.location, r2.cookie)
  r2 = await get(r2.location, r2.cookie)
  const meAgain = await get(`http://localhost:${APP_PORT}/api/auth/me`, r2.cookie)
  const bodyAgain = JSON.parse(await meAgain.res.text())
  assert(
    bodyAgain.user && bodyAgain.user.id === body.user.id,
    'second login reuses existing profile (same id)',
    JSON.stringify(bodyAgain.user)
  )
  await post(`http://localhost:${APP_PORT}/api/auth/logout`, meAgain.cookie)
}

async function runFacebookFlow() {
  console.log('\nFacebook OAuth flow:')

  let r = await get(`http://localhost:${APP_PORT}/api/auth/facebook`)
  assert(r.res.status === 302, 'GET /api/auth/facebook redirects to provider', `got ${r.res.status}`)
  assert(
    r.location && r.location.startsWith('http://localhost:3200/facebook/authorize'),
    'redirect targets mock Facebook authorize URL',
    r.location
  )
  assert(r.location.includes('client_id=test-facebook-app-id'), 'client_id passed', r.location)

  r = await get(r.location, r.cookie)
  assert(r.res.status === 302, 'provider redirects back to app callback', `got ${r.res.status}`)
  assert(
    r.location && r.location.includes('code=FACEBOOK_TEST_CODE'),
    'callback carries authorization code',
    r.location
  )

  r = await get(r.location, r.cookie)
  assert(r.res.status === 302, 'callback redirects after login', `got ${r.res.status}`)

  const me = await get(`http://localhost:${APP_PORT}/api/auth/me`, r.cookie)
  const body = JSON.parse(await me.res.text())
  assert(me.res.status === 200 && body.user, 'session persists - /me returns user', JSON.stringify(body))
  assert(body.user.provider === 'facebook', 'provider = facebook', body.user.provider)
  assert(body.user.name === 'Facebook Test User', 'name stored', body.user.name)
  assert(body.user.email === 'fbuser@facebook.com', 'email stored', body.user.email)
  assert(body.user.photo === 'https://mock.test/facebook/photo.png', 'photo stored', body.user.photo)
  assert(typeof body.user.id === 'number', 'internal user id stored', body.user.id)
  assert(body.user.provider_id === 'facebook-id-456', 'provider id stored', body.user.provider_id)

  const out = await post(`http://localhost:${APP_PORT}/api/auth/logout`, me.cookie)
  const me2 = await get(`http://localhost:${APP_PORT}/api/auth/me`, out.cookie)
  const body2 = JSON.parse(await me2.res.text())
  assert(body2.user === null, 'session cleared after logout', JSON.stringify(body2))

  return me.cookie
}

async function runAnonymousChecks() {
  console.log('\nUnauthenticated state:')

  const me = await get(`http://localhost:${APP_PORT}/api/auth/me`)
  const body = JSON.parse(await me.res.text())
  assert(body.user === null, '/me returns null for anonymous user', JSON.stringify(body))

  const cfg = await get(`http://localhost:${APP_PORT}/api/auth/config`)
  const cfgBody = JSON.parse(await cfg.res.text())
  assert(
    cfgBody.google.enabled && cfgBody.facebook.enabled,
    '/config reports providers configured',
    JSON.stringify(cfgBody)
  )
}

async function main() {
  await new Promise((resolve) => mock.listen(MOCK_PORT, resolve))
  console.log(`Mock OAuth provider on :${MOCK_PORT}, app on :${APP_PORT}`)

  await runAnonymousChecks()
  await runGoogleFlow()
  await runFacebookFlow()

  console.log('\nAll OAuth flows verified.')

  mock.close()
  process.exit(failures === 0 ? 0 : 1)
}

main().catch((err) => {
  console.error('Test crashed:', err)
  process.exit(1)
})
