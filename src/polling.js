'use strict';
// Long polling, local dev only. Never run polling and a webhook at the
// same time — Telegram delivers each update to only one of them.
const telegram = require('./telegram');
const { handleUpdate } = require('./handlers/updates');
const { db } = require('./db');

let offset = 0;
let running = false;
async function pollOnce() {
  const updates = await telegram.getUpdates(offset, 100, 5);
  for (const update of updates) {
    offset = Math.max(offset, update.update_id + 1);
    try { await handleUpdate(update); } catch (e) { console.error('[polling] handleUpdate failed:', e.message); }
  }
}
async function startPolling() {
  if (running) return;
  running = true;
  // Resume from the highest update already stored, so a restart never
  // reprocesses the whole history.
  try {
    const row = db.prepare('SELECT MAX(telegram_update_id) AS m FROM events').get();
    if (row && row.m) offset = row.m + 1;
  } catch (_) { /* fresh database */ }
  console.log('[polling] long polling started, offset', offset);
  for (;;) {
    try { await pollOnce(); } catch (e) { console.error('[polling] getUpdates failed:', e.message); await new Promise((r) => setTimeout(r, 5000)); }
  }
}
module.exports = { startPolling };
