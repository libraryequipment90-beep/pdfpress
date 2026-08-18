const express = require('express')
const session = require('express-session')
const passport = require('passport')
const GoogleStrategy = require('passport-google-oauth20').Strategy
const FacebookStrategy = require('passport-facebook').Strategy
const { getUserById, findOrCreateUser } = require('./db')

const router = express.Router()

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || ''
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || ''
const FACEBOOK_APP_ID = process.env.FACEBOOK_APP_ID || ''
const FACEBOOK_APP_SECRET = process.env.FACEBOOK_APP_SECRET || ''
const PUBLIC_URL = (process.env.PUBLIC_URL || '').replace(/\/$/, '')
const SESSION_SECRET =
  process.env.SESSION_SECRET || 'pdfpress-session-secret-change-in-production'

function callbackURL(req, provider) {
  if (PUBLIC_URL) return `${PUBLIC_URL}/api/auth/${provider}/callback`
  const forwardedHost = String(req.get('x-forwarded-host') || '')
    .split(',')[0]
    .trim()
  const proto = req.get('x-forwarded-proto') || req.protocol
  const host = forwardedHost || req.get('host') || 'localhost'
  return `${proto}://${host}/api/auth/${provider}/callback`
}

function normalizeUser(profile, provider) {
  const email = profile.emails && profile.emails[0] ? profile.emails[0].value : null
  let name = profile.displayName
  if (!name && profile.name) {
    name = [profile.name.givenName, profile.name.familyName].filter(Boolean).join(' ')
  }
  name = name || email || profile.id || provider
  const photo = profile.photos && profile.photos[0] ? profile.photos[0].value : null
  return { providerId: profile.id, provider, name, email, photo }
}

router.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: { httpOnly: true, sameSite: 'lax', maxAge: 7 * 24 * 60 * 60 * 1000 }
  })
)
router.use(passport.initialize())
router.use(passport.session())

passport.serializeUser((user, done) => done(null, user.id))
passport.deserializeUser((id, done) => {
  done(null, getUserById(id))
})

if (GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) {
  passport.use(
    'google',
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        authorizationURL:
          process.env.GOOGLE_AUTHORIZATION_URL ||
          'https://accounts.google.com/o/oauth2/v2/auth',
        tokenURL:
          process.env.GOOGLE_TOKEN_URL || 'https://www.googleapis.com/oauth2/v4/token',
        userProfileURL:
          process.env.GOOGLE_USER_PROFILE_URL ||
          'https://www.googleapis.com/oauth2/v3/userinfo',
        state: true
      },
      (accessToken, refreshToken, profile, done) => {
        const { providerId, provider, name, email, photo } = normalizeUser(profile, 'google')
        try {
          done(null, findOrCreateUser(provider, providerId, name, email, photo))
        } catch (err) {
          done(err)
        }
      }
    )
  )
}

if (FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) {
  passport.use(
    'facebook',
    new FacebookStrategy(
      {
        clientID: FACEBOOK_APP_ID,
        clientSecret: FACEBOOK_APP_SECRET,
        authorizationURL:
          process.env.FACEBOOK_AUTHORIZATION_URL || 'https://www.facebook.com/v3.2/dialog/oauth',
        tokenURL:
          process.env.FACEBOOK_TOKEN_URL || 'https://graph.facebook.com/v3.2/oauth/access_token',
        profileURL:
          process.env.FACEBOOK_USER_PROFILE_URL || 'https://graph.facebook.com/v3.2/me',
        profileFields: ['id', 'displayName', 'name', 'emails', 'photos'],
        enableProof: false,
        state: true
      },
      (accessToken, refreshToken, profile, done) => {
        const { providerId, provider, name, email, photo } = normalizeUser(profile, 'facebook')
        try {
          done(null, findOrCreateUser(provider, providerId, name, email, photo))
        } catch (err) {
          done(err)
        }
      }
    )
  )
}

router.get('/config', (req, res) => {
  res.json({
    google: { enabled: !!(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET) },
    facebook: { enabled: !!(FACEBOOK_APP_ID && FACEBOOK_APP_SECRET) }
  })
})

router.get('/me', (req, res) => {
  res.json({ user: req.user || null })
})

router.post('/logout', (req, res) => {
  req.logout(() => {
    res.json({ ok: true })
  })
})

router.get('/google', (req, res, next) => {
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    return res.status(503).json({ error: 'Google sign-in is not configured on the server.' })
  }
  passport.authenticate('google', {
    scope: ['profile', 'email'],
    callbackURL: callbackURL(req, 'google')
  })(req, res, next)
})

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', {
    successRedirect: '/signup?success=1',
    failureRedirect: '/signup?error=1',
    callbackURL: callbackURL(req, 'google')
  })(req, res, next)
})

router.get('/facebook', (req, res, next) => {
  if (!FACEBOOK_APP_ID || !FACEBOOK_APP_SECRET) {
    return res.status(503).json({ error: 'Facebook sign-in is not configured on the server.' })
  }
  passport.authenticate('facebook', {
    scope: ['email'],
    authType: 'rerequest',
    callbackURL: callbackURL(req, 'facebook')
  })(req, res, next)
})

router.get('/facebook/callback', (req, res, next) => {
  passport.authenticate('facebook', {
    successRedirect: '/signup?success=1',
    failureRedirect: '/signup?error=1',
    callbackURL: callbackURL(req, 'facebook')
  })(req, res, next)
})

module.exports = router
