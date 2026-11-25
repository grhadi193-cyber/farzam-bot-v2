# Farzam Bot v2 — clean rebuild spec

Goal: a new Telegram bot, built from scratch, that is only a pipe.
Pip talks to the bot through its own API. The bot never decides finance.

## Principle

- Bot = Telegram in, Telegram out, nothing else.
- Pip / ERP = brain: transcription check, amount extraction, classification,
  registers, ledgers, reports. The bot stores raw events and delivers messages.
- The old bot stays untouched and running until cutover. The new bot uses a
  new BotFather token and a new username until it is proven, then the old
  bot is stopped. Two bots must never poll the same token.

## Stack

- Node 18+, Express, same as the Farzam ERP server, so one team owns both.
- Database: libsql / SQLite locally, Turso in production. The database is
  the source of truth, not Drive folders.
- Transport to Telegram: webhook in production, long polling only for local
  dev. Webhook and polling must never run at the same time.
- Files: store in object storage or local disk with a stable file id, and
  mirror a copy to Google Drive only as an archive. Drive is never the queue.

## File tree

```
farzam-bot-v2/
  package.json
  Dockerfile
  .env.example
  README.md
  src/
    index.js            # entry, starts HTTP server, wires routes
    config.js           # env only, no secrets in code
    telegram.js         # thin Bot API client: sendMessage, getFile, download
    auth.js             # Pip API key check, webhook secret check
    db.js               # libsql client, migrations
    routes/
      webhook.js        # POST /telegram/webhook, ack fast, queue async
      pip.js            # all /api/pip/* endpoints
      health.js         # GET /health
    handlers/
      updates.js        # normalize a Telegram update into one event
      grouping.js       # 180s window per sender, one group = one event
    services/
      transcribe.js     # Persian voice transcription, Whisper, language fa
      files.js          # download from Telegram, store, return file id
      archive.js        # optional Drive mirror, archive only
  data/
    schema.sql          # events, employees, deliveries, audit
  scripts/
    smoke.mjs           # health + auth + one dry send check
```

## Database

- `events`: id uuid, telegram_update_id unique, group_id, telegram_chat_id,
  telegram_user_id, username, kind text/voice/photo/document,
  raw_text, caption, transcript, transcript_status, file_id, file_path,
  received_at_iso, date_shamsi, time_tehran, status new/processing/done/needs_review.
- `employees`: telegram_user_id primary key, name, slug, role, chat_id,
  active. Unknown senders are stored as unknown and flagged, never accepted
  silently.
- `deliveries`: id, event_id, chat_id, text_hash, telegram_message_id,
  status sent/failed, attempted_at_iso. One row per send attempt.
- `audit_log`: actor, action, entity, row id, timestamp. Every Pip write
  and every send is logged.
- Idempotency: `telegram_update_id` is unique. A duplicate update is
  ignored. No watermark file, the database holds it.

## Telegram intake flow

1. Telegram posts an update to `POST /telegram/webhook`.
2. The bot answers 200 immediately and queues the update.
3. The worker normalizes it, groups messages from the same sender inside
   180 seconds into one `group_id`, downloads voice/photo files, transcribes
   voice in Persian, and inserts one `events` row with status new.
4. The bot does not extract the amount, does not decide the category, and
   does not move anything to processed. It only flags: missing text,
   missing receipt, unknown employee, transcription failed.
5. Pip polls the Pip API, reads the event, and decides everything else.

## Pip API — this is how Pip talks to the bot

Base: `<bot>/api/pip`, auth: `Authorization: Bearer <PIP_BOT_API_KEY>`.
The Pip key is separate from `TELEGRAM_BOT_TOKEN` and from the ERP key.

- `GET /api/pip/health` — bot up, Telegram reachable, database reachable.
- `GET /api/pip/events?status=new&limit=50` — new events, oldest first.
  Each event carries raw text, caption, transcript, file ids and file
  download URLs, sender, chat id, Jalali date and Tehran time.
- `GET /api/pip/events/:id` — one event with all its files.
- `GET /api/pip/events/:id/file/:file_id` — download one attached file.
- `POST /api/pip/events/:id/ack` — Pip marks an event done or needs_review.
  Body: `{"status": "done" | "needs_review", "note": "..."}`.
- `POST /api/pip/send` — Pip asks the bot to send a message.
  Body: `{"chat_id": 123456789, "text": "..."}`. Returns the Telegram
  message id and a delivery row. One chat per call.
- `GET /api/pip/employees` and `POST /api/pip/employees` — Pip manages the
  employee registry. Send needs a numeric `chat_id`, never a username.
- `GET /api/pip/audit` — latest audit rows.

Rules: every send is logged, a failed send is retried once and then marked
failed, never retried blindly. A send with an unknown chat id returns 400
and sends nothing.

## What the bot must not do

- No amount extraction as truth. The old bot mistook `۱۰ گیگ` for an amount.
  The bot stores raw text only.
- No Drive folder as a database, no empty record folders, no folder name
  as an id.
- No finance decision, no register write, no ledger write. Those live in
  the ERP and its agent API.
- No hardcoded token, no token in logs, no token in Drive, no token in chat.
  `TELEGRAM_BOT_TOKEN`, `PIP_BOT_API_KEY` and `TELEGRAM_WEBHOOK_SECRET`
  come from environment only.

## Dates, money, language

- Timezone always Asia/Tehran. Dates Jalali, format `۱۴۰۵/۰۹/۰۱`.
- Money is always integer Rial. The bot never stores Toman.
- Human text is Persian with Persian digits. File and folder names are
  safe English only.

## Deployment

- One repo, one service, `docker compose up -d` or Vercel/railway with a
  public HTTPS URL for the webhook.
- Env: `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`,
  `PIP_BOT_API_KEY`, `DATABASE_URL`, `PORT`, `GROUP_WINDOW_SECONDS=180`.
- Health check on `GET /health`. Structured JSON logs, no token in logs.
- To revoke Pip: change `PIP_BOT_API_KEY` and restart. To revoke Telegram:
  rotate the token in BotFather and update the env.

## Cutover

1. Build v2 with a new bot username and token, run it in parallel.
2. Send test text, voice and receipt to v2, check the Pip API returns
   them, send one test message back through `POST /api/pip/send`.
3. Only then stop the old bot, move the token if the username must stay,
   and point Pip at v2.
4. Keep the old Drive tree read-only. Do not migrate old folders into v2.
