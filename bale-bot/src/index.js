import { Hono } from 'hono';
import { webhookHandler } from './handlers/webhook.js';
import { verifyBaleToken } from './utils/security.js';
import { logger } from './utils/logger.js';

const app = new Hono();

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (c) => c.json({ status: 'ok', service: 'bale-main-bot' }));

// ── Bale webhook ──────────────────────────────────────────────────────────────
app.post("/webhook/:token", verifyBaleToken, webhookHandler);

// ── 404 / error ───────────────────────────────────────────────────────────────
app.notFound((c) => c.json({ error: 'not_found' }, 404));

app.onError((err, c) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  return c.json({ error: 'internal_server_error' }, 500);
});

export default {
  async fetch(request, env, ctx) {
    return app.fetch(request, env, ctx);
  },
};
