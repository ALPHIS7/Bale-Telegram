import { Hono } from 'hono';
import { webhookHandler } from './handlers/webhook.js';
import { verifyBaleToken } from './utils/security.js';
import { logger } from './utils/logger.js';

const app = new Hono();

// ── Health check ──────────────────────────────────────────────────────────────
// بررسی وضعیت زنده بودن ورکر (برای تست با مرورگر)
app.get('/', (c) => c.json({ status: 'ok', service: 'bale-main-bot' }));

// ── Bale webhook (Production) ─────────────────────────────────────────────────
// استفاده از میدل‌ور verifyBaleToken برای امنیت، و سپس پاس دادن به هندلر اصلی
app.post("/webhook/:token", verifyBaleToken, async (c) => {
  logger.info("=== Valid Webhook Hit from Bale ===");
  
  try {
    // صدا زدن هندلر اصلی که پردازش پیام‌ها و اتصال به کبالت/جمینای در آن قرار دارد
    return await webhookHandler(c);
  } catch (error) {
    logger.error("Error executing webhookHandler:", { 
      message: error.message, 
      stack: error.stack 
    });
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

// ── 404 / Error Handlers ──────────────────────────────────────────────────────
app.notFound((c) => {
  logger.warn(`Route not found: ${c.req.method} ${c.req.url}`);
  return c.json({ error: 'not_found' }, 404);
});

app.onError((err, c) => {
  logger.error('Unhandled top-level error', { 
    error: err.message, 
    stack: err.stack 
  });
  return c.json({ error: 'internal_server_error' }, 500);
});

// ── Export Worker ─────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    // پاس دادن env و ctx به هونو به صورت استاندارد
    return app.fetch(request, env, ctx);
  },
};
