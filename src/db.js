'use strict';
// libsql, same pattern as the ERP server. The database is the source of
// truth — not Drive folders, not a watermark file.
const fs = require('fs');
const path = require('path');
const { randomUUID } = require('crypto');
const Database = require('libsql');
const config = require('./config');

let db;
if (config.tursoUrl) {
  db = new Database(config.tursoUrl, { authToken: config.tursoToken || '' });
} else {
  const dbPath = config.databaseUrl || path.join(__dirname, '..', 'data', 'bot.db');
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  db = new Database(dbPath);
  try { db.pragma('journal_mode = WAL'); } catch (_) { /* not supported everywhere */ }
}
try { db.pragma('foreign_keys = ON'); } catch (_) {
  try { db.exec('PRAGMA foreign_keys = ON'); } catch (_) { /* ignore */ }
}

db.exec(`
CREATE TABLE IF NOT EXISTS events (
  id TEXT PRIMARY KEY,
  telegram_update_id INTEGER UNIQUE,
  group_id TEXT NOT NULL,
  telegram_chat_id INTEGER,
  telegram_user_id INTEGER,
  username TEXT,
  sender_name TEXT,
  kind TEXT NOT NULL DEFAULT 'text',
  raw_text TEXT,
  caption TEXT,
  transcript TEXT,
  transcript_status TEXT,
  files TEXT NOT NULL DEFAULT '[]',
  message_ids TEXT NOT NULL DEFAULT '[]',
  flags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'new',
  note TEXT,
  received_at_iso TEXT NOT NULL,
  date_shamsi TEXT,
  time_tehran TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS employees (
  telegram_user_id INTEGER PRIMARY KEY,
  name TEXT,
  slug TEXT,
  role TEXT,
  chat_id INTEGER,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS deliveries (
  id TEXT PRIMARY KEY,
  event_id TEXT,
  chat_id INTEGER NOT NULL,
  text_hash TEXT,
  telegram_message_id INTEGER,
  status TEXT NOT NULL DEFAULT 'sent',
  error TEXT,
  attempted_at_iso TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS audit_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  actor TEXT NOT NULL,
  action TEXT NOT NULL,
  entity TEXT,
  entity_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

function audit(actor, action, entity, entityId) {
  db.prepare('INSERT INTO audit_log (actor, action, entity, entity_id) VALUES (?,?,?,?)')
    .run(actor, action, entity || null, entityId || null);
}
function parseJson(s, fallback) {
  try { return s ? JSON.parse(s) : fallback; } catch (_) { return fallback; }
}
function publicEvent(row) {
  if (!row) return null;
  return {
    ...row,
    files: parseJson(row.files, []),
    message_ids: parseJson(row.message_ids, []),
    flags: parseJson(row.flags, []),
  };
}
function listEvents(status, limit = 50) {
  const rows = status
    ? db.prepare('SELECT * FROM events WHERE status = ? ORDER BY id ASC LIMIT ?').all(status, limit)
    : db.prepare('SELECT * FROM events ORDER BY id ASC LIMIT ?').all(limit);
  return rows.map(publicEvent);
}
function getEvent(id) {
  return publicEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(id));
}
function newId() { return randomUUID(); }

module.exports = { db, audit, parseJson, publicEvent, listEvents, getEvent, newId };
