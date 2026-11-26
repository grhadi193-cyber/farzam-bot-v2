'use strict';
// Minimal .env loader, same pattern as the ERP server: .env never overrides
// variables already set in the real environment.
const fs = require('fs');
const path = require('path');
(function loadEnv() {
  const p = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

function num(name, fallback) {
  const v = Number(process.env[name]);
  return Number.isFinite(v) && v > 0 ? v : fallback;
}

const config = {
  port: num('PORT', 3100),
  telegramToken: process.env.TELEGRAM_BOT_TOKEN || '',
  webhookSecret: process.env.TELEGRAM_WEBHOOK_SECRET || '',
  webhookUrl: process.env.WEBHOOK_URL || '',
  pipApiKey: process.env.PIP_BOT_API_KEY || '',
  // JSON object mapping first-login access codes to {name, role}.
  telegramAccessCodesJson: process.env.TELEGRAM_ACCESS_CODES_JSON || '',
  databaseUrl: process.env.DATABASE_URL || '',
  tursoUrl: process.env.TURSO_DATABASE_URL || '',
  tursoToken: process.env.TURSO_AUTH_TOKEN || '',
  groupWindowSeconds: num('GROUP_WINDOW_SECONDS', 180),
  polling: String(process.env.POLLING || '').toLowerCase() === 'true',
  filesDir: process.env.FILES_DIR || path.join(__dirname, '..', 'data', 'files'),
  whisperPython: process.env.WHISPER_PYTHON || '',
  whisperModel: process.env.WHISPER_MODEL || 'small',
};

if (!config.telegramToken) console.warn('[config] TELEGRAM_BOT_TOKEN is not set — Telegram calls will fail until it is set in .env');
if (!config.pipApiKey) console.warn('[config] PIP_BOT_API_KEY is not set — /api/pip/* will return 503 until it is set in .env');
if (config.polling && config.webhookUrl) console.warn('[config] POLLING and WEBHOOK_URL are both set — webhook wins, polling is disabled');

module.exports = config;
