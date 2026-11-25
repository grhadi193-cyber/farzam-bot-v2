'use strict';
// Messages from one sender inside GROUP_WINDOW_SECONDS belong to one event.
// A photo caption counts as the description of that event.
const { db, newId } = require('../db');
const config = require('../config');

function findOpenGroup(telegramUserId, nowIso) {
  const windowStart = new Date(new Date(nowIso).getTime() - config.groupWindowSeconds * 1000).toISOString();
  const row = db.prepare(
    "SELECT group_id FROM events WHERE telegram_user_id = ? AND status = 'new' AND received_at_iso >= ? ORDER BY received_at_iso DESC LIMIT 1"
  ).get(telegramUserId, windowStart);
  return row ? row.group_id : null;
}
function newGroup() { return newId(); }
module.exports = { findOpenGroup, newGroup };
