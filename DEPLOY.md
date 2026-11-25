# Deploy Farzam Bot v2

The bot is a long-running server, not a serverless function. It needs a
persistent disk for its database and files, and a public HTTPS URL for
the Telegram webhook.

## Do not use Vercel for this bot

Vercel is where the ERP panel lives, but it is the wrong host for the bot:

- The filesystem is read-only and ephemeral, so the local database and
  downloaded files reset on cold starts, exactly like the ERP wipe on
  2026-11-24.
- Webhook calls and voice transcription can outlast a serverless timeout.
- There is no faster-whisper on Vercel, so voice transcription is off.

On a proper host, transcription is also off unless a whisper python is
installed there. That is fine: Pip transcribes voice itself with its own
faster-whisper venv when it reads the file through the Pip API.

## Free for the MVP — Render (chosen 2026-11-25)

Render Free is the MVP host: 750 instance hours a month, 512 MB RAM, no
card required. It sleeps after 15 minutes idle and takes about a minute
to wake, which is fine for a webhook bot — Telegram retries a webhook
that arrives while the service is waking.

Two Render-free facts change the setup, and the code already handles both:

- Its disk is not persistent on the free tier, so the database must be
  Turso. Set `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` in Render. Without
  them the bot falls back to a local file that resets on redeploy.
- Downloaded receipt and voice files also live on that ephemeral disk.
  Pip must fetch each file promptly through `GET /api/pip/events/:id/file/:index`
  and keep its own copy. Do not treat Render as long-term file storage.

Steps:

1. Push this folder to a private GitHub repo.
2. Create a free Turso database (`turso db create farzam-bot-v2`, then
   `turso db show --url` and `turso db tokens create`). Keep the URL and
   token for step 4.
3. In Render Dashboard, New -> Blueprint, pick the repo. Render reads
   `render.yaml` and creates the `farzam-bot-v2` web service on the free plan.
4. In the service, Environment, fill in the secrets from `render.yaml`:
   `TELEGRAM_BOT_TOKEN` (new BotFather bot), `TELEGRAM_WEBHOOK_SECRET`
   and `PIP_BOT_API_KEY` (each `openssl rand -hex 32` on your own machine),
   `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`. Leave `WEBHOOK_URL` empty
   for the first deploy.
5. Deploy. When Render shows the domain, usually
   `https://farzam-bot-v2.onrender.com`, set `WEBHOOK_URL` to
   `https://farzam-bot-v2.onrender.com/telegram/webhook` and redeploy
   once, so the bot registers the webhook at boot.
6. Test: `GET https://farzam-bot-v2.onrender.com/health` must return
   `ok: true`, then `GET /api/pip/health` with the Pip key must return
   `telegram_configured: true`.

Other free options, not chosen: Google Cloud Run is the most generous
always-free option (2 million requests, 180,000 vCPU-seconds a month,
scales to zero) but needs a Google Cloud billing account, same Turso
note as Render. Oracle Cloud Always Free is the only $0 always-on
machine (2 OCPU / 12 GB ARM, 200 GB disk, no expiry) but setup is
heavier and ARM capacity is often out of stock. Railway is not free
beyond its 30-day $5 trial, then $5 a month. Fly.io has no free tier
for new accounts, only a short trial.

## Recommended host: Railway

1. Push this folder to a private GitHub repo.
2. In Railway, create a project from that repo. Railway builds the
   Dockerfile automatically.
3. Add a Volume and mount it at `/app/data`. Without it, the database
   resets on every redeploy.
4. Set the environment variables below in Railway, not in a committed file.
5. Railway gives the service a public domain, for example
   `https://farzam-bot-v2.up.railway.app`. Set `WEBHOOK_URL` to
   `https://<that-domain>/telegram/webhook` and redeploy once, so the bot
   registers the webhook at boot.
6. Test: `GET https://<domain>/health` must return `ok: true`, then
   `GET https://<domain>/api/pip/health` with the Pip key must return
   `telegram_configured: true`.

## Alternative host: a VPS with Docker

```bash
git clone <private-repo-url> farzam-bot-v2
cd farzam-bot-v2
cp .env.example .env
# Fill in .env on the server. Never commit .env, never paste it in chat.
docker compose up -d
```

Put a reverse proxy with HTTPS in front of port 3100, for example Caddy
or nginx, and set `WEBHOOK_URL` to
`https://<your-domain>/telegram/webhook`. The compose file already mounts
`./data` as a volume, so the database survives restarts.

## Environment variables

| Variable | Required | Where it comes from |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | Yes | BotFather, `/newbot`, for the new v2 bot. Set it in the host dashboard or the server `.env`. Never in chat. |
| `PIP_BOT_API_KEY` | Yes | Generate on the host with `openssl rand -hex 32`. Pip needs this same value through its secure connection flow to call `/api/pip/*`. Never in chat. |
| `TELEGRAM_WEBHOOK_SECRET` | Yes | Generate on the host with `openssl rand -hex 32`. Telegram sends it back on every webhook call. |
| `WEBHOOK_URL` | Yes | `https://<host-domain>/telegram/webhook`. The bot registers it at boot. |
| `PORT` | No | Default 3100. Railway sets its own `PORT`; the bot respects it. |
| `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN` | No | Only if the database should live in Turso instead of the mounted volume. If both are unset, the bot uses the local file `data/bot.db`. |
| `GROUP_WINDOW_SECONDS` | No | Default 180. |
| `WHISPER_PYTHON`, `WHISPER_MODEL` | No | Only if the host has faster-whisper. Leave unset and Pip transcribes voice. |

## Cutover checklist

1. New bot username and token exist, old bot `@Frzmaccbot` is still running.
2. v2 is deployed and `/health` returns `ok: true`.
3. Send a test text, a voice note and a receipt photo to the v2 bot.
4. Read them back through `GET /api/pip/events?status=new`.
5. Send one test message back through `POST /api/pip/send`.
6. Only then stop the old bot. Two bots must never read the same token.
7. Keep the old Drive tree read-only. Do not migrate old folders into v2.
