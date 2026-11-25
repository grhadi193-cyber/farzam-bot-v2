'use strict';
// /api/pip/* — how Pip talks to the bot. Auth is a Bearer key, separate
// from the Telegram token. Every write and every send is audit-logged.
const crypto = require('crypto');
const express = require('express');
const fs = require('fs');
const path = require('path');
const { db, audit, listEvents, getEvent, newId } = require('../db');
const { requirePip } = require('../auth');
const telegram = require('../telegram');
const config = require('../config');
const router = express.Router();
router.use(requirePip);

router.get('/health', (req, res) => {
  let database = false;
  try { db.prepare('SELECT 1').get(); database = true; } catch (_) { database = false; }
  res.json({ ok: database, app: 'farzam-bot-v2', telegram_configured: Boolean(config.telegramToken), database, time: new Date().toISOString() });
});

router.get('/events', (req, res) => {
  const status = req.query.status ? String(req.query.status) : undefined;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  if (status && !['new', 'processing', 'done', 'needs_review'].includes(status)) {
    return res.status(400).json({ error: 'status is invalid' });
  }
  res.json(listEvents(status, limit));
});

router.get('/events/:id', (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'event not found' });
  res.json(ev);
});

router.get('/events/:id/file/:index', (req, res) => {
  const ev = getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'event not found' });
  const file = ev.files[Number(req.params.index)];
  if (!file || !file.path || !fs.existsSync(file.path)) return res.status(404).json({ error: 'file not found' });
  return res.sendFile(path.resolve(file.path));
});

router.post('/events/:id/ack', (req, res) => {
  const status = (req.body || {}).status;
  if (!['done', 'needs_review'].includes(status)) return res.status(400).json({ error: 'status must be done or needs_review' });
  const ev = getEvent(req.params.id);
  if (!ev) return res.status(404).json({ error: 'event not found' });
  db.prepare("UPDATE events SET status = ?, note = ?, updated_at = datetime('now') WHERE id = ?")
    .run(status, (req.body || {}).note || null, req.params.id);
  audit('pip-agent', 'ack', 'events', req.params.id);
  res.json(getEvent(req.params.id));
});

router.post('/send', async (req, res) => {
  const chatId = Number((req.body || {}).chat_id);
  const text = String((req.body || {}).text || '').trim();
  if (!Number.isFinite(chatId) || chatId === 0) return res.status(400).json({ error: 'chat_id must be a numeric Telegram chat id, not a username' });
  if (!text) return res.status(400).json({ error: 'text is required' });
  const deliveryId = newId();
  const textHash = crypto.createHash('sha256').update(`${chatId}:${text}`).digest('hex');
  const attemptedAt = new Date().toISOString();
  // One retry, then failed. Never retried blindly.
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const result = await telegram.sendMessage(chatId, text);
      db.prepare('INSERT INTO deliveries (id, chat_id, text_hash, telegram_message_id, status, attempted_at_iso) VALUES (?,?,?,?,?,?)')
        .run(deliveryId, chatId, textHash, result.message_id || null, 'sent', attemptedAt);
      audit('pip-agent', 'send', 'deliveries', deliveryId);
      return res.json({ ok: true, delivery_id: deliveryId, telegram_message_id: result.message_id || null, chat_id: chatId });
    } catch (e) {
      if (attempt === 2) {
        db.prepare('INSERT INTO deliveries (id, chat_id, text_hash, status, error, attempted_at_iso) VALUES (?,?,?,?,?,?)')
          .run(deliveryId, chatId, textHash, 'failed', e.message, attemptedAt);
        audit('pip-agent', 'send_failed', 'deliveries', deliveryId);
        return res.status(502).json({ ok: false, error: e.message, delivery_id: deliveryId });
      }
    }
  }
  return res.status(502).json({ ok: false, error: 'send failed' });
});

router.get('/employees', (req, res) => {
  res.json(db.prepare('SELECT * FROM employees ORDER BY telegram_user_id ASC LIMIT 500').all());
});

router.post('/employees', (req, res) => {
  const b = req.body || {};
  const userId = Number(b.telegram_user_id);
  if (!Number.isFinite(userId) || userId === 0) return res.status(400).json({ error: 'telegram_user_id must be numeric' });
  if (!b.name) return res.status(400).json({ error: 'name is required' });
  let slug = String(b.slug || b.name).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  // Persian names have no Latin letters, so a cleaned slug can come out
  // empty — fall back to the Telegram id instead of a slug of dashes.
  if (!slug) slug = `user-${userId}`;
  db.prepare(
    `INSERT INTO employees (telegram_user_id, name, slug, role, chat_id, active)
     VALUES (?,?,?,?,?,?) ON CONFLICT(telegram_user_id) DO UPDATE SET name=excluded.name, slug=excluded.slug, role=excluded.role, chat_id=excluded.chat_id, active=excluded.active`
  ).run(userId, String(b.name), slug, b.role || 'employee', Number(b.chat_id) || userId, b.active === false ? 0 : 1);
  audit('pip-agent', 'upsert', 'employees', String(userId));
  res.status(201).json(db.prepare('SELECT * FROM employees WHERE telegram_user_id = ?').get(userId));
});

router.get('/audit', (req, res) => {
  res.json(db.prepare('SELECT * FROM audit_log ORDER BY id DESC LIMIT 200').all());
});

module.exports = router;
