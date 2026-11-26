'use strict';

const { db, audit } = require('../db');
const config = require('../config');
const telegram = require('../telegram');
const ui = require('../ui');
const { extractMessage, handleUpdate } = require('./updates');

function accessEntries() {
  const raw = config.telegramAccessCodesJson;
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Object.entries(parsed).map(([code, value]) => ({
      code: String(code),
      name: typeof value === 'string' ? value : value.name,
      role: typeof value === 'object' && value ? value.role || 'employee' : 'employee',
    })).filter(x => x.code && x.name);
  } catch (e) {
    console.error('[auth] TELEGRAM_ACCESS_CODES_JSON is invalid JSON');
    return [];
  }
}
function employee(userId) {
  return db.prepare('SELECT * FROM employees WHERE telegram_user_id = ? AND active = 1').get(Number(userId));
}
function upsertEmployee(userId, chatId, name, role) {
  const slug = `user-${Number(userId)}`;
  db.prepare(`INSERT INTO employees (telegram_user_id,name,slug,role,chat_id,active)
    VALUES (?,?,?,?,?,1)
    ON CONFLICT(telegram_user_id) DO UPDATE SET name=excluded.name, role=excluded.role, chat_id=excluded.chat_id, active=1`)
    .run(Number(userId), name || slug, slug, role || 'employee', Number(chatId) || Number(userId));
  audit('telegram-auth', 'authorize', 'employees', String(userId));
  return employee(userId);
}
async function send(chatId, text, options = {}) {
  return telegram.sendMessage(chatId, text, { parse_mode: 'HTML', ...options });
}
async function handleConversation(update) {
  if (!update || typeof update.update_id !== 'number') return { ok: false, error: 'invalid update' };
  const m = extractMessage(update);
  if (!m.chatId || !m.userId) return { ok: true, ignored: true };
  const cb = update.callback_query;
  if (cb) {
    const cbFrom = cb.from || {};
    const cbChat = cb.message && cb.message.chat;
    const cbEmployee = employee(cbFrom.id);
    await telegram.answerCallbackQuery(cb.id, cbEmployee ? 'در حال آماده‌سازی…' : 'ابتدا احراز هویت کن', !cbEmployee);
    if (!cbEmployee || !cbChat) return { ok: true, unauthorized: true };
    const menuText = ui.menuResponse(String(cb.data || ''));
    if (menuText) await send(cbChat.id, menuText, { reply_markup: ui.mainMenu() });
    return { ok: true, callback: true };
  }

  await handleUpdate(update);
  const text = String(m.text || '').trim();
  const existing = employee(m.userId);
  if (text === '/start' || text === '/menu') {
    if (existing) await send(m.chatId, ui.welcome(existing.name), { reply_markup: ui.mainMenu() });
    else await send(m.chatId, ui.authPrompt());
    return { ok: true, command: text, authorized: Boolean(existing) };
  }
  if (!existing) {
    const entry = accessEntries().find(x => x.code === text);
    if (entry) {
      const saved = upsertEmployee(m.userId, m.chatId, m.senderName || entry.name, entry.role);
      await send(m.chatId, ui.authSuccess(saved.name), { reply_markup: ui.mainMenu() });
      return { ok: true, authorized: true, first_login: true };
    }
    await send(m.chatId, ui.authPrompt());
    return { ok: true, unauthorized: true };
  }
  const shortcut = ui.menuResponse(text);
  if (shortcut) {
    await send(m.chatId, shortcut, { reply_markup: ui.mainMenu() });
    return { ok: true, menu: true };
  }
  await telegram.sendChatAction(m.chatId, 'typing').catch(() => {});
  const status = await send(m.chatId, ui.processing());
  audit('telegram-user', 'question_received', 'events', String(m.userId));
  return { ok: true, authorized: true, status_message_id: status && status.message_id };
}
module.exports = { handleConversation, accessEntries };
