// Smoke test for Farzam Bot v2. Starts the server on a test port with a
// throwaway database and a test Pip key, then checks health, Pip auth,
// webhook intake, event read/ack, and a send that must fail cleanly
// (no Telegram token in test, so no message is ever delivered).
// Usage: npm test
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'farzam-bot-v2-'));
const dbPath = path.join(dir, 'bot.db');
const port = 3199;
const key = 'test-pip-key';
const base = `http://127.0.0.1:${port}`;
let failures = 0;
function check(name, ok, extra = '') {
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!ok) failures += 1;
}
async function req(p, opts = {}) {
  const res = await fetch(base + p, opts);
  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (_) { /* not JSON */ }
  return { status: res.status, json, text };
}
const server = spawn('node', ['src/index.js'], {
  cwd: new URL('..', import.meta.url).pathname,
  env: { ...process.env, PORT: String(port), DATABASE_URL: dbPath, PIP_BOT_API_KEY: key, POLLING: 'false' },
  stdio: 'pipe',
});
let out = '';
server.stdout.on('data', (d) => { out += d; });
server.stderr.on('data', (d) => { out += d; });
try {
  // Wait for health.
  let up = false;
  for (let i = 0; i < 50; i += 1) {
    try { const r = await req('/health'); if (r.status === 200) { up = true; break; } } catch (_) { /* not up yet */ }
    await new Promise((r) => setTimeout(r, 200));
  }
  check('health', up);
  const h = await req('/health');
  check('health reports database ok', h.json && h.json.database === true, JSON.stringify(h.json));
  check('health reports telegram not configured in test', h.json && h.json.telegram_configured === false);

  const noAuth = await req('/api/pip/events');
  check('Pip API without key is 401 or 503', [401, 503].includes(noAuth.status), String(noAuth.status));
  const auth = { headers: { Authorization: `Bearer ${key}` } };
  const events0 = await req('/api/pip/events', auth);
  check('Pip events list is empty at start', events0.status === 200 && Array.isArray(events0.json) && events0.json.length === 0);

  // Webhook intake: a text update, no secret configured in test.
  const wh = await req('/telegram/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_id: 900001, message: { message_id: 11, from: { id: 123, first_name: 'Test', username: 'tester' }, chat: { id: 123 }, text: 'خرید کاغذ ۲۵۰۰۰۰۰ ریال', date: 1790000000 } }),
  });
  check('webhook acks 200 fast', wh.status === 200 && wh.json && wh.json.ok === true);
  await new Promise((r) => setTimeout(r, 500));
  const events1 = await req('/api/pip/events', auth);
  check('webhook created one event', events1.status === 200 && events1.json.length === 1, JSON.stringify(events1.json));
  const ev = events1.json[0];
  check('event keeps raw text, no amount extraction', ev && ev.raw_text === 'خرید کاغذ ۲۵۰۰۰۰۰ ریال');
  check('event has Jalali date', Boolean(ev && ev.date_shamsi));

  // Duplicate delivery of the same update must not create a second event.
  await req('/telegram/webhook', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ update_id: 900001, message: { message_id: 11, from: { id: 123, first_name: 'Test', username: 'tester' }, chat: { id: 123 }, text: 'خرید کاغذ ۲۵۰۰۰۰۰ ریال', date: 1790000000 } }),
  });
  await new Promise((r) => setTimeout(r, 500));
  const events2 = await req('/api/pip/events', auth);
  check('duplicate update is ignored', events2.json.length === 1);

  const ack = await req(`/api/pip/events/${ev.id}/ack`, {
    method: 'POST', headers: { ...auth.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'done', note: 'smoke' }),
  });
  check('ack marks event done', ack.status === 200 && ack.json && ack.json.status === 'done');

  const badSend = await req('/api/pip/send', {
    method: 'POST', headers: { ...auth.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 'not-a-number', text: 'hi' }),
  });
  check('send with a username-like chat_id is 400 and sends nothing', badSend.status === 400);

  const noTokenSend = await req('/api/pip/send', {
    method: 'POST', headers: { ...auth.headers, 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: 123, text: 'hi' }),
  });
  check('send without a Telegram token fails cleanly (502) and logs a delivery', noTokenSend.status === 502, String(noTokenSend.status));
} finally {
  server.kill();
  fs.rmSync(dir, { recursive: true, force: true });
}
console.log(failures === 0 ? 'smoke: all passed' : `smoke: ${failures} failure(s)`);
process.exit(failures === 0 ? 0 : 1);
