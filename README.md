# 🤖 Bot Platform – Cloudflare Workers

Production-ready dual-bot system running on Cloudflare Workers edge network.

| Bot | Purpose |
|-----|---------|
| `telegram-file-gateway` | Receives files from users on Telegram and forwards them to Bale |
| `bale-main-bot` | Full-featured bot: file inbox, AI chat (Gemini), YouTube/Instagram downloader |

---

## Architecture

```
telegram-bot/                    bale-bot/
├── src/                         ├── src/
│   ├── index.js                 │   ├── index.js
│   ├── handlers/                │   ├── handlers/
│   │   ├── webhook.js           │   │   ├── webhook.js     ← dispatcher
│   │   └── file.js              │   │   ├── file.js        ← Feature 1
│   ├── services/                │   │   ├── ai.js          ← Feature 2
│   │   ├── telegram.js          │   │   ├── youtube.js     ← Feature 3
│   │   └── bale.js              │   │   └── instagram.js   ← Feature 4
│   └── utils/                   │   ├── services/
│       ├── logger.js            │   │   ├── bale.js
│       ├── security.js          │   │   ├── gemini.js
│       └── retry.js             │   │   └── downloader/
├── wrangler.toml                │   │       ├── interface.js
└── package.json                 │   │       └── providers/
                                 │   │           └── http.js
                                 │   └── utils/ (same as telegram)
                                 ├── wrangler.toml
                                 └── package.json
```

---

## Prerequisites

- Node.js 18+
- [Wrangler CLI](https://developers.cloudflare.com/workers/wrangler/install-and-update/): `npm install -g wrangler`
- Cloudflare account (free tier is enough)
- Telegram Bot Token ([@BotFather](https://t.me/BotFather))
- Bale Bot Token ([bale.ai/dev](https://bale.ai/dev))
- Google Gemini API key ([aistudio.google.com](https://aistudio.google.com/app/apikey))

---

## Setup

### 1. Clone & install dependencies

```bash
# Telegram bot
cd telegram-bot && npm install

# Bale bot
cd ../bale-bot && npm install
```

### 2. Authenticate with Cloudflare

```bash
wrangler login
```

### 3. Create KV Namespaces

```bash
# For telegram-bot
cd telegram-bot
wrangler kv:namespace create KV
wrangler kv:namespace create KV --preview

# For bale-bot
cd ../bale-bot
wrangler kv:namespace create KV
wrangler kv:namespace create KV --preview
```

Copy the generated IDs into each `wrangler.toml`:

```toml
[[kv_namespaces]]
binding    = "KV"
id         = "PASTE_ID_HERE"
preview_id = "PASTE_PREVIEW_ID_HERE"
```

### 4. Set Secrets

#### Telegram bot
```bash
cd telegram-bot
wrangler secret put TELEGRAM_BOT_TOKEN
wrangler secret put BALE_BOT_TOKEN
wrangler secret put BALE_TARGET_CHAT_ID
wrangler secret put WEBHOOK_SECRET        # generate: openssl rand -hex 32
```

#### Bale bot
```bash
cd bale-bot
wrangler secret put BALE_BOT_TOKEN
wrangler secret put GEMINI_API_KEY
wrangler secret put WEBHOOK_SECRET        # same or different secret
```

### 5. Deploy

```bash
# Deploy Telegram bot
cd telegram-bot && npm run deploy

# Deploy Bale bot
cd ../bale-bot && npm run deploy
```

Wrangler prints the Worker URL after deployment, e.g.:
```
https://telegram-file-gateway.your-subdomain.workers.dev
https://bale-main-bot.your-subdomain.workers.dev
```

### 6. Register Webhooks

#### Telegram
```bash
cd telegram-bot
TELEGRAM_BOT_TOKEN=xxx \
WEBHOOK_SECRET=yyy \
WORKER_URL=https://telegram-file-gateway.your-subdomain.workers.dev \
node scripts/setup-webhook.mjs
```

#### Bale
```bash
cd bale-bot
BALE_BOT_TOKEN=xxx \
WEBHOOK_SECRET=yyy \
WORKER_URL=https://bale-main-bot.your-subdomain.workers.dev \
node scripts/setup-webhook.mjs
```

---

## Features

### Telegram Bot – File Transfer Gateway

- Accepts **all file types**: documents, images, videos, audio, voice, ZIP/RAR, PDF, DOCX, etc.
- Streams files from Telegram CDN directly to Bale (no full memory buffer)
- Max file size: 20 MB (Telegram Bot API limit)
- Rate limiting: 10 requests / 60 seconds per user
- Responds with success/failure status

### Bale Bot – Feature 1: File Inbox

- Receives files forwarded from the Telegram bot or sent directly
- Validates file size (max 50 MB) and MIME type
- Stores file metadata in KV for 7 days
- Reports file name, size, type, and storage duration

### Bale Bot – Feature 2: AI Chat (Gemini)

- Powered by **Google Gemini 2.0 Flash**
- Maintains per-user conversation history (last 10 turns, 30-minute window)
- Graceful error handling: quota, safety, timeout
- History stored in KV, auto-expires

### Bale Bot – Feature 3: YouTube Downloader (future-ready)

- Detects YouTube URLs automatically
- **Pluggable provider architecture** – plug in any external microservice
- Enable by setting `YOUTUBE_PROVIDER=http` + `DOWNLOADER_API_URL`
- Worker handles only orchestration; no binaries run inside Workers

### Bale Bot – Feature 4: Instagram Downloader

- Detects reels and posts automatically
- Same provider architecture as YouTube
- Enable by setting `INSTAGRAM_PROVIDER=http` + `DOWNLOADER_API_URL`
- Supports carousel (multi-image) posts

---

## Adding a Download Provider

1. Create `bale-bot/src/services/downloader/providers/my-provider.js`
2. Implement `class MyProvider { async download(url, options) { ... } }`
3. Register it in `interface.js`:
   ```js
   import { MyProvider } from './providers/my-provider.js';
   const PROVIDER_REGISTRY = { http: HttpProvider, myprovider: MyProvider };
   ```
4. Set env var: `YOUTUBE_PROVIDER=myprovider`

---

## Development (local)

```bash
# Run telegram bot locally
cd telegram-bot
cp ../.env.example .dev.vars   # add your secrets
npm run dev

# Run bale bot locally
cd bale-bot
cp ../.env.example .dev.vars
npm run dev
```

Use [ngrok](https://ngrok.com) or [cloudflared tunnel](https://developers.cloudflare.com/cloudflare-one/connections/connect-networks/) to expose local ports for webhook testing.

---

## Monitoring & Logs

```bash
# Stream live logs from Telegram bot
cd telegram-bot && npm run tail

# Stream live logs from Bale bot
cd bale-bot && npm run tail
```

---

## Security

| Mechanism | Detail |
|-----------|--------|
| Webhook token | Secret embedded in URL path; checked on every request |
| Rate limiting | Sliding-window counter per user stored in KV |
| Input validation | File IDs, URLs, and MIME types validated before processing |
| Fail-open rate limiter | KV errors never block legitimate users |
| No secrets in code | All credentials via `wrangler secret` or `.dev.vars` |

---

## Environment Variables Reference

| Variable | Bot | Required | Description |
|----------|-----|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Telegram | ✅ | From @BotFather |
| `BALE_BOT_TOKEN` | Both | ✅ | From bale.ai/dev |
| `BALE_TARGET_CHAT_ID` | Telegram | ✅ | Destination chat on Bale |
| `WEBHOOK_SECRET` | Both | ✅ | Random secret for webhook URL |
| `GEMINI_API_KEY` | Bale | ✅ | Google AI Studio API key |
| `GEMINI_MODEL` | Bale | ❌ | Default: `gemini-2.0-flash` |
| `YOUTUBE_PROVIDER` | Bale | ❌ | `http` to enable, empty to disable |
| `INSTAGRAM_PROVIDER` | Bale | ❌ | `http` to enable, empty to disable |
| `DOWNLOADER_API_URL` | Bale | ❌ | External downloader microservice URL |
| `DOWNLOADER_API_KEY` | Bale | ❌ | Bearer token for downloader service |
