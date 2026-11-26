'use strict';
// Thin Telegram Bot API client. Keeps presentation concerns in one place.
// Secrets never appear in logs, errors, or return values.
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
async function sendMessage(chatId, text, options = {}) {
  const params = {
    chat_id: Number(chatId),
    text: String(text),
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: options.disable_web_page_preview !== false,
  };
  if (options.reply_markup) params.reply_markup = options.reply_markup;
  if (options.reply_to_message_id) params.reply_parameters = { message_id: Number(options.reply_to_message_id) };
  return call('sendMessage', params);
}
async function editMessageText(chatId, messageId, text, options = {}) {
  const params = {
    chat_id: Number(chatId),
    message_id: Number(messageId),
    text: String(text),
    parse_mode: options.parse_mode || 'HTML',
    disable_web_page_preview: options.disable_web_page_preview !== false,
  };
  if (options.reply_markup) params.reply_markup = options.reply_markup;
  return call('editMessageText', params);
}
async function answerCallbackQuery(callbackQueryId, text, showAlert = false) {
  return call('answerCallbackQuery', { callback_query_id: String(callbackQueryId), text: text ? String(text) : undefined, show_alert: Boolean(showAlert) });
}
async function sendChatAction(chatId, action = 'typing') {
  return call('sendChatAction', { chat_id: Number(chatId), action });
}
async function setMyCommands(commands) {
  return call('setMyCommands', { commands });
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
module.exports = { call, sendMessage, editMessageText, answerCallbackQuery, sendChatAction, setMyCommands, getMe, getUpdates, downloadFile };
