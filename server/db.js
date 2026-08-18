const path = require('path')
const fs = require('fs')
const Database = require('better-sqlite3')

const dataDir = path.join(__dirname, 'data')
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true })
}

const db = new Database(path.join(dataDir, 'users.db'))
db.pragma('journal_mode = WAL')

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    provider TEXT NOT NULL,
    provider_id TEXT NOT NULL,
    name TEXT,
    email TEXT,
    photo TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(provider, provider_id)
  )
`)

const userColumns = db
  .prepare('PRAGMA table_info(users)')
  .all()
  .map((c) => c.name)
if (!userColumns.includes('created_at')) {
  db.exec("ALTER TABLE users ADD COLUMN created_at TEXT NOT NULL DEFAULT ''")
  db.exec("UPDATE users SET created_at = datetime('now') WHERE created_at = ''")
}

const select = 'SELECT id, provider, provider_id, name, email, photo, created_at FROM users'

const findById = db.prepare(`${select} WHERE id = ?`)
const findByProviderId = db.prepare(
  `${select} WHERE provider = ? AND provider_id = ?`
)
const upsert = db.prepare(
  `INSERT INTO users (provider, provider_id, name, email, photo, created_at)
   VALUES (?, ?, ?, ?, ?, datetime('now'))
   ON CONFLICT(provider, provider_id) DO UPDATE SET
     name = excluded.name,
     email = excluded.email,
     photo = excluded.photo`
)

function getUserById(id) {
  return findById.get(id) || null
}

function findOrCreateUser(provider, providerId, name, email, photo) {
  upsert.run(provider, providerId, name, email, photo)
  return findByProviderId.get(provider, providerId)
}

module.exports = { getUserById, findOrCreateUser }
