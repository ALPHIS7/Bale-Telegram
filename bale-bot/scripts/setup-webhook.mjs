#!/usr/bin/env node
/**
 * Bale Webhook Setup Script
 * Usage: BALE_BOT_TOKEN=xxx WEBHOOK_SECRET=yyy WORKER_URL=https://... node scripts/setup-webhook.mjs
 */

const { BALE_BOT_TOKEN, WEBHOOK_SECRET, WORKER_URL } = process.env;

if (!BALE_BOT_TOKEN || !WEBHOOK_SECRET || !WORKER_URL) {
  console.error('Missing required env vars: BALE_BOT_TOKEN, WEBHOOK_SECRET, WORKER_URL');
  process.exit(1);
}

const webhookUrl = `${WORKER_URL.replace(/\/$/, '')}/webhook/${WEBHOOK_SECRET}`;

const res  = await fetch(`https://tapi.bale.ai/bot${BALE_BOT_TOKEN}/setWebhook`, {
  method:  'POST',
  headers: { 'Content-Type': 'application/json' },
  body:    JSON.stringify({ url: webhookUrl }),
});

const data = await res.json();
console.log('Bale setWebhook response:', JSON.stringify(data, null, 2));

if (data.ok) {
  console.log('\n✅ Bale webhook registered successfully!');
  console.log('   URL:', webhookUrl);
} else {
  console.error('\n❌ Failed:', data.description);
  process.exit(1);
}
