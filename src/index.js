'use strict';
const express = require('express');
const config = require('./config');
const health = require('./routes/health');
const webhook = require('./routes/webhook');
const pip = require('./routes/pip');
const telegram = require('./telegram');
const { startPolling } = require('./polling');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(health);
app.use(webhook);
app.use('/api/pip', pip);
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'internal server error' });
});

if (require.main === module) {
  app.listen(config.port, async () => {
    console.log(`Farzam Bot v2 running at http://localhost:${config.port}`);
    if (config.webhookUrl && config.telegramToken) {
      try {
        await telegram.call('setWebhook', { url: config.webhookUrl, secret_token: config.webhookSecret || undefined });
        await telegram.setMyCommands([{ command: 'start', description: 'شروع و ورود به دستیار' }, { command: 'menu', description: 'نمایش منوی اصلی' }]);
        console.log('[telegram] webhook set:', config.webhookUrl);
      } catch (e) { console.error('[telegram] setWebhook failed:', e.message); }
    } else if (config.polling && config.telegramToken) {
      startPolling().catch((e) => console.error('[polling] failed:', e.message));
    } else {
      console.log('[telegram] no webhook URL and POLLING is false — Telegram intake is off until one is set');
    }
  });
}
module.exports = app;
