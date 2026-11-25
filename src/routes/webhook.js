'use strict';
// POST /telegram/webhook — Telegram pushes an update, we ack 200 fast and
// process it in the background. A slow download or transcription must
// never block the ack, or Telegram will re-deliver the update.
const express = require('express');
const { requireWebhookSecret } = require('../auth');
const { handleUpdate } = require('../handlers/updates');
const router = express.Router();
router.post('/telegram/webhook', requireWebhookSecret, (req, res) => {
  const update = req.body || {};
  res.json({ ok: true });
  setImmediate(async () => {
    try { await handleUpdate(update); } catch (e) { console.error('[webhook] handleUpdate failed:', e.message); }
  });
});
module.exports = router;
