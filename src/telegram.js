'use strict';
// Thin Telegram Bot API client. One job: call api.telegram.org.
// The token never appears in a log, an error message, or a return value.
const fs = require('fs');
const path = require('path');
const config = require('./config');

function botUrl(method) {
  return `https://api.telegram.org/bot${config.telegramToken}/${method}`;
}
function fileUrl(filePath) {
  return `https://api.telegram.org/file/bot${config.telegramToken}/${filePath}`;
}
async function call(method, params = {}) {
  if (!config.telegramToken) throw new Error('TELEGRAM_BOT_TOKEN is not set');
  const res = await fetch(botUrl(method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.ok === false) {
    throw new Error(`Telegram ${method} failed: HTTP ${res.status} ${body.description || body.error || ''}`.trim());
  }
  return body.result;
}
async function sendMessage(chatId, text) {
  return call('sendMessage', { chat_id: Number(chatId), text: String(text) });
}
async function getMe() { return call('getMe', {}); }
async function getUpdates(offset, limit = 100, timeout = 30) {
  return call('getUpdates', { offset, limit, timeout });
}
async function downloadFile(fileId, destDir, fileName) {
  const file = await call('getFile', { file_id: fileId });
  if (!file.file_path) throw new Error('Telegram returned no file_path');
  const res = await fetch(fileUrl(file.file_path));
  if (!res.ok) throw new Error(`Telegram file download failed: HTTP ${res.status}`);
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, fileName);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest, buf);
  return { dest, filePath: file.file_path, size: buf.length };
}
module.exports = { call, sendMessage, getMe, getUpdates, downloadFile };
