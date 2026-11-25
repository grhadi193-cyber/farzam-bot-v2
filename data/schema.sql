-- Farzam Bot v2 schema. Applied by src/db.js with CREATE TABLE IF NOT EXISTS.
-- The database is the source of truth. Drive is archive only.
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
