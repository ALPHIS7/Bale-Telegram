import { Hono } from 'hono';
import { webhookHandler } from './handlers/webhook.js';
import { verifyBaleToken } from './utils/security.js';
import { logger } from './utils/logger.js';

const app = new Hono();

// ── Health check ──────────────────────────────────────────────────────────────
app.get('/', (c) => c.json({ status: 'ok', service: 'bale-main-bot' }));

// ── Bale webhook ──────────────────────────────────────────────────────────────
app.post("/webhook/:token", async (c) => {
 استفاده می‌کنید:
    ```javascript
    const provider = await import(`./providers/${name}.js`);
    ```
    این کار در Cloudflare Workers (بدون تنظیمات خاص در `wrangler.toml`) می‌تواند باعث شکست در روتینگ شود. بهتر است ایمپورت‌ها را در ابتدای فایل و به صورت Static انجام دهید.

### ۴. چک‌لیست نهایی برای فیکس کردن
*   [ ] **بررسی متغیرهای محیطی:** آیا `YOUTUBE_PROVIDER` دقیقاً در فایل `wrangler.toml` یا داشبورد تعریف شده؟
*   [ ] **حذف موقت Cobalt:** به صورت آزمایشی بخش Cobalt را در کد کامنت کنید و ببینید وب‌هوک برمی‌گردد یا خیر. اگر برگشت، مشکل در نحوه Export کردن کلاس/شیء در فایل `cobalt.js` است.
*   [ ] **خطای ۴۰۴ ب  console.log("Webhook hit!"); // این باید در logs نمایش داده شود
  const token = c.req.param('token');
  returnله:** بله وقتی وب‌هوک را ست می‌کنید، اگر سرور شما در آن لحظه با تاخیر پاسخ دهد یا خطای ۵۰۰ بده c.json({ status: "received", token });
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
