'use strict';
// Download a Telegram file into data/files/<event-id>/ with a safe name.
// Returns the stored record; the file id is stable, the folder name is not.
const path = require('path');
const telegram = require('../telegram');
const config = require('../config');

function safeName(fileId, fallback) {
  const base = String(fallback || fileId).replace(/[^a-zA-Z0-9._-]/g, '_');
  return base || 'file';
}
async function storeTelegramFile(fileId, eventId, fallbackName) {
  const destDir = path.join(config.filesDir, eventId);
  const name = safeName(fileId, fallbackName);
  const saved = await telegram.downloadFile(fileId, destDir, name);
  return { file_id: fileId, name, path: saved.dest, size: saved.size };
}
module.exports = { storeTelegramFile };
