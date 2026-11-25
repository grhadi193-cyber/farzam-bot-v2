'use strict';
// Two separate keys, two separate jobs. The Pip key never grants Telegram
// access and the Telegram token never grants Pip API access.
const config = require('./config');

function requirePip(req, res, next) {
  if (!config.pipApiKey) return res.status(503).json({ error: 'PIP_BOT_API_KEY is not set on the server' });
  const header = req.headers.authorization || '';
  if (header !== `Bearer ${config.pipApiKey}`) return res.status(401).json({ error: 'Pip API key is missing or wrong' });
  return next();
}
function requireWebhookSecret(req, res, next) {
  if (!config.webhookSecret) {
    console.warn('[auth] TELEGRAM_WEBHOOK_SECRET is not set — webhook calls are not verified');
    return next();
  }
  if (req.headers['x-telegram-bot-api-secret-token'] !== config.webhookSecret) {
    return res.status(401).json({ ok: false, error: 'webhook secret is wrong' });
  }
  return next();
}
module.exports = { requirePip, requireWebhookSecret };
