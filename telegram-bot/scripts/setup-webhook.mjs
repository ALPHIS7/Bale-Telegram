#!/usr/bin/env node
/**
 * Telegram Webhook Setup Script
 * Usage: TELEGRAM_BOT_TOKEN=xxx WEBHOOK_SECRET=yyy WORKER_URL=https://... node scripts/setup-webhook.mjs
 */

const { TELEGRAM_BOT_TOKEN, WEBHOOK_SECRET, WORKER_URL } = process.env;

if (!TELEGRAM_BOT_TOKEN || !WEBHOOK_SECRET || !WORKER_URL) {
  console.error('Missing required env vars: TELEGRAM_BOT_TOKEN, WEBHOOK_SECRET, WORKER_URL');
  process.exit(1);
}

const webhookUrl = `${WORKER_URL.replace(/\/$/, '')}/webhook/${WEBHOOK_SECRET}`;

const res  = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify({
    url:             webhookUrl,
    max_connections: 100,
    allowed_updates: ['message'],
  }),
});

const data = await res.json();
console.log('Telegram setWebhook response:', JSON.stringify(data, null, 2));

if (data.ok) {
  console.log('\n✅ Webhook registered successfully!');
  console.log('   URL:', webhookUrl);
} else {
  console.error('\n❌ Failed:', data.description);
  process.exit(1);
}
