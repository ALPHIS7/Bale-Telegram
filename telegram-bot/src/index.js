import { Hono } from 'hono';
import { webhookHandler } from './handlers/webhook.js';
import { verifyTelegramToken } from './utils/security.js';
import { logger } from './utils/logger.js';

const app = new Hono();

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (c) => c.json({ status: 'ok', service: 'telegram-file-gateway' }));

// ── Webhook endpoint ──────────────────────────────────────────────────────────
app.post('/webhook', verifyTelegramToken, webhookHandler);
// ── 404 fallback ──────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'not_found' }, 404));

// ── Global error handler ──────────────────────────────────────────────────────
app.onError((err, c) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  return c.json({ error: 'internal_server_error' }, 500);
});

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
