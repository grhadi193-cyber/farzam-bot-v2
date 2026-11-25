# Farzam Bot v2

A new Telegram bot, built from scratch. It is only a pipe: Telegram in,
Telegram out. Pip talks to it through its own API and does all the finance
work. The bot never extracts an amount, never decides a category, and
never writes a register.

This is the bypass for the broken Muse Telegram connector (instant 404 on
`getMe` / `getUpdates` / `sendMessage` through the connector, while the
same token works directly). Here the token lives in the bot's own
environment, so the bot calls the Bot API directly.

## Run

```bash
cp .env.example .env
# Fill in TELEGRAM_BOT_TOKEN (new bot, new username) and PIP_BOT_API_KEY.
npm install
npm start
```

Or with Docker:

```bash
docker compose up -d
```

Or free on Render for the MVP — see `DEPLOY.md` and `render.yaml`.
On Render Free the database must be Turso (`TURSO_DATABASE_URL` +
`TURSO_AUTH_TOKEN`), because the free disk does not persist.

## Pip API

Base `<bot>/api/pip`, auth `Authorization: Bearer <PIP_BOT_API_KEY>`.

- `GET /api/pip/health`
- `GET /api/pip/events?status=new&limit=50`
- `GET /api/pip/events/:id`
- `GET /api/pip/events/:id/file/:index`
- `POST /api/pip/events/:id/ack` — `{"status": "done" | "needs_review", "note": "..."}`
- `POST /api/pip/send` — `{"chat_id": 123456789, "text": "..."}`, one chat per call, numeric chat id only
- `GET /api/pip/employees`, `POST /api/pip/employees`
- `GET /api/pip/audit`

## Telegram intake

Production: set `WEBHOOK_URL` to `https://<host>/telegram/webhook` and
`TELEGRAM_WEBHOOK_SECRET`. The server sets the webhook at boot.

Local dev: set `POLLING=true` and no `WEBHOOK_URL`. Never run both.

Messages from one sender inside `GROUP_WINDOW_SECONDS` (default 180)
are grouped into one event. Voice is transcribed in Persian with
faster-whisper when a whisper python is available (default
`~/workspace/venvs/whisper/bin/python`, small model, language fa);
otherwise transcription is reported as `not_configured`, never guessed.

## What it does not do

- No amount extraction. The old bot mistook `۱۰ گیگ` for an amount.
- No Drive folder as a database. The database is the source of truth;
  Drive is archive only, and disabled until `DRIVE_ARCHIVE_FOLDER_ID` is set.
- No finance decisions. Those live in the ERP and its agent API.

## Test

```bash
npm test
```

The smoke test starts the server with a throwaway database and no
Telegram token, and checks health, Pip auth, webhook intake, duplicate
suppression, ack, and a send that must fail cleanly.

## Cutover

1. Run v2 with a new bot username and token, in parallel with the old bot.
2. Send test text, voice and receipt to v2, read them back through
   `GET /api/pip/events`, send one test message back with `POST /api/pip/send`.
3. Only then stop the old bot. Two bots must never read the same token.
4. Keep the old Drive tree read-only. Do not migrate old folders into v2.
