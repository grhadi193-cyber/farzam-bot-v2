'use strict';
const express = require('express');
const { db } = require('../db');
const config = require('../config');
const router = express.Router();
router.get('/health', (req, res) => {
  let database = false;
  try { db.prepare('SELECT 1').get(); database = true; } catch (_) { database = false; }
  res.json({
    ok: database,
    app: 'farzam-bot-v2',
    telegram_configured: Boolean(config.telegramToken),
    pip_api_configured: Boolean(config.pipApiKey),
    database,
    time: new Date().toISOString(),
  });
});
module.exports = router;
