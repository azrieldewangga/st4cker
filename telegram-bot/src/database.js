import Database from 'better-sqlite3';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { existsSync, mkdirSync } from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Use persistent volume path on Railway, fallback to local for development
const isDev = process.env.NODE_ENV !== 'production';
const dbDir = isDev ? __dirname : '/data';
const dbPath = join(dbDir, 'telegram-bot.db');

// Ensure data directory exists
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

console.log(`[DB] Using database at: ${dbPath}`);
const db = new Database(dbPath);

// Enable foreign keys and WAL mode for better performance
db.pragma('foreign_keys = ON');
db.pragma('journal_mode = WAL');

// Initialize schemas
function initDatabase() {
  // Sessions table (persistent across restarts)
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      session_token TEXT PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      device_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      last_activity INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pairing_codes (
      code TEXT PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL,
      used INTEGER DEFAULT 0,
      attempts INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS user_data (
      telegram_user_id TEXT PRIMARY KEY,
      data TEXT,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS pending_events (
      event_id TEXT PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      event_type TEXT NOT NULL,
      event_data TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      delivered INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS devices (
      device_id TEXT PRIMARY KEY,
      telegram_user_id TEXT NOT NULL,
      device_name TEXT,
      first_paired_at INTEGER NOT NULL,
      last_paired_at INTEGER NOT NULL,
      last_seen INTEGER NOT NULL,
      enabled INTEGER DEFAULT 1
    );

    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(telegram_user_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at);
    CREATE INDEX IF NOT EXISTS idx_pairing_user ON pairing_codes(telegram_user_id);
    CREATE INDEX IF NOT EXISTS idx_pairing_expires ON pairing_codes(expires_at);
    CREATE INDEX IF NOT EXISTS idx_pending_user ON pending_events(telegram_user_id);
    CREATE INDEX IF NOT EXISTS idx_devices_user ON devices(telegram_user_id);
    CREATE INDEX IF NOT EXISTS idx_devices_enabled ON devices(enabled) WHERE enabled = 1;
  `);

  console.log('[DB] Database initialized successfully');
}

// Cleanup expired entries
function cleanupExpired() {
  const now = Date.now();

  // Delete expired sessions
  const sessionsDeleted = db.prepare(
    'DELETE FROM sessions WHERE expires_at < ?'
  ).run(now);

  // Delete expired pairing codes
  const codesDeleted = db.prepare(
    'DELETE FROM pairing_codes WHERE expires_at < ?'
  ).run(now);

  if (sessionsDeleted.changes > 0 || codesDeleted.changes > 0) {
    console.log(`[DB] Cleanup: ${sessionsDeleted.changes} sessions, ${codesDeleted.changes} codes`);
  }
}

// Run cleanup every hour
setInterval(cleanupExpired, 60 * 60 * 1000);

// Initialize on module load
initDatabase();

export default db;
