'use strict';
// Normalize one Telegram update into one event row. The bot stores raw
// text only — it never extracts an amount, a category, or a finance
// decision. Those are Pip's job, through the Pip API.
const { db, newId, publicEvent } = require('../db');
const { findOpenGroup, newGroup } = require('./grouping');
const { todayJalali, timeTehran } = require('../dates');
const filesService = require('../services/files');
const { transcribeVoice } = require('../services/transcribe');

function extractMessage(update) {
  const msg = update.message || update.edited_message || {};
  const from = msg.from || {};
  const chat = msg.chat || {};
  let kind = 'text';
  let fileId = null;
  let fileName = null;
  if (msg.voice) { kind = 'voice'; fileId = msg.voice.file_id; fileName = 'voice.ogg'; }
  else if (Array.isArray(msg.photo) && msg.photo.length) { kind = 'photo'; fileId = msg.photo[msg.photo.length - 1].file_id; fileName = 'receipt.jpg'; }
  else if (msg.document) { kind = 'document'; fileId = msg.document.file_id; fileName = msg.document.file_name || 'document'; }
  return {
    updateId: update.update_id,
    messageId: msg.message_id,
    chatId: chat.id || null,
    userId: from.id || null,
    username: from.username || null,
    senderName: [from.first_name, from.last_name].filter(Boolean).join(' ') || from.username || null,
    kind, fileId, fileName,
    text: msg.text || '',
    caption: msg.caption || '',
  };
}

async function handleUpdate(update) {
  if (!update || typeof update.update_id !== 'number') return { ok: false, error: 'invalid update' };
  const m = extractMessage(update);
  // Idempotency: a re-delivered update_id is ignored, never a second event.
  const dup = db.prepare('SELECT id FROM events WHERE telegram_update_id = ?').get(m.updateId);
  if (dup) return { ok: true, duplicate: true, event_id: dup.id };
  const now = new Date();
  const receivedAt = now.toISOString();
  const groupId = findOpenGroup(m.userId, receivedAt) || newGroup();
  const flags = [];
  if (!m.text && !m.caption && m.kind === 'text') flags.push('missing_description');
  if (m.kind === 'voice' || m.kind === 'photo' || m.kind === 'document') flags.push('has_attachment');
  const existing = db.prepare('SELECT * FROM events WHERE group_id = ?').get(groupId);
  let eventId;
  if (existing) {
    const ev = publicEvent(existing);
    const files = ev.files;
    const messageIds = ev.message_ids;
    if (m.messageId && messageIds.includes(m.messageId)) return { ok: true, duplicate: true, event_id: ev.id };
    if (m.messageId && !messageIds.includes(m.messageId)) messageIds.push(m.messageId);
    const rawText = [ev.raw_text, m.text || m.caption].filter(Boolean).join('\n');
    db.prepare("UPDATE events SET raw_text = ?, caption = ?, message_ids = ?, flags = ?, updated_at = datetime('now') WHERE id = ?")
      .run(rawText, m.caption || ev.caption, JSON.stringify(messageIds), JSON.stringify([...new Set([...ev.flags, ...flags])]), ev.id);
    eventId = ev.id;
  } else {
    eventId = newId();
    db.prepare(
      `INSERT INTO events (id, telegram_update_id, group_id, telegram_chat_id, telegram_user_id, username, sender_name, kind, raw_text, caption, files, message_ids, flags, status, received_at_iso, date_shamsi, time_tehran)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    ).run(
      eventId, m.updateId, groupId, m.chatId, m.userId, m.username, m.senderName, m.kind,
      m.text || m.caption, m.caption, '[]', JSON.stringify(m.messageId ? [m.messageId] : []),
      JSON.stringify(flags), 'new', receivedAt, todayJalali(now), timeTehran(now)
    );
  }
  // Files and transcription run in the background, after the event exists,
  // so a slow download never blocks the webhook ack.
  if (m.fileId) {
    setImmediate(async () => {
      try {
        const stored = await filesService.storeTelegramFile(m.fileId, eventId, m.fileName);
        const ev = publicEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(eventId));
        if (!ev) return;
        const files = [...ev.files, stored];
        db.prepare("UPDATE events SET files = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(files), eventId);
        if (m.kind === 'voice') {
          const t = await transcribeVoice(stored.path);
          db.prepare("UPDATE events SET transcript = ?, transcript_status = ?, updated_at = datetime('now') WHERE id = ?")
            .run(t.transcript, t.status, eventId);
        }
      } catch (e) {
        const ev = publicEvent(db.prepare('SELECT * FROM events WHERE id = ?').get(eventId));
        if (!ev) return;
        const flags = [...new Set([...ev.flags, 'file_download_failed'])];
        db.prepare("UPDATE events SET flags = ?, updated_at = datetime('now') WHERE id = ?").run(JSON.stringify(flags), eventId);
      }
    });
  }
  return { ok: true, event_id: eventId, group_id: groupId };
}

module.exports = { extractMessage, handleUpdate };
