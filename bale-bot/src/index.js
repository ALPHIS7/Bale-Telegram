import { Hono } from 'hono';
import { webhookHandler } from './handlers/webhook.js';
import { verifyBaleToken } from './utils/security.js';
import { logger } from './utils/logger.js';

const app = new Hono();

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (c) => c.json({ status: 'ok', service: 'bale-main-bot' }));

// ── Bale webhook ──────────────────────────────────────────────────────────────
app.post("/webhook/:token", async (c) => {
  // این لاگ برای اینه که توی wrangler tail ببینی ریکوئست بله می‌رسه یا نه
  console.log("=== Webhook Hit! ===");
  
  const token = c.req.param('token');
  console.log("Received Token:", token);

  try {
    // اینجا می‌تونی بقیه منطق یا مپ کردن دانلودرها (مثل کبالت) رو بیاری
    // فعلاً برای تست روتینگ، فقط یه پاسخ موفقیت‌آمیز برمی‌گردونیم
    return c.json({ 
      status: "received", 
      token: token,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error in webhook handler:", error);
    return c.json({ error: "Internal Server Error" }, 500);
  }
});

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
