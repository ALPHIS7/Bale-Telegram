import { logger } from './logger.js';

/**
 * Hono middleware – verifies the secret token in the webhook URL path.
 * URL pattern: /webhook/:token
 */
export async function verifyTelegramToken(c, next) {
  const token     = c.req.param('token');
  const expected  = c.env.WEBHOOK_SECRET;

  if (!expected || token !== expected) {
    logger.warn('Webhook token mismatch', { ip: c.req.header('cf-connecting-ip') });
    return c.json({ error: 'forbidden' }, 403);
  }

  await next();
}

/**
 * Sliding-window rate limiter backed by Cloudflare KV.
 *
 * @param {KVNamespace} kv
 * @param {string}      key
 * @param {object}      opts
 * @param {number}      opts.maxRequests   - Max allowed requests per window
 * @param {number}      opts.windowSeconds - Window duration in seconds
 * @returns {Promise<boolean>} true if the request should be blocked
 */
export async function checkRateLimit(kv, key, { maxRequests, windowSeconds }) {
  try {
    const raw   = await kv.get(key, { type: 'json' });
    const now   = Math.floor(Date.now() / 1000);
    const entry = raw ?? { count: 0, start: now };

    if (now - entry.start > windowSeconds) {
      // Window expired – reset
      await kv.put(key, JSON.stringify({ count: 1, start: now }), {
        expirationTtl: windowSeconds,
      });
      return false;
    }

    if (entry.count >= maxRequests) {
      return true; // blocked
    }

    entry.count += 1;
    await kv.put(key, JSON.stringify(entry), { expirationTtl: windowSeconds });
    return false;
  } catch (err) {
    // Fail open – never block legitimate users due to KV issues
    logger.error('Rate limit KV error', { key, error: err.message });
    return false;
  }
}

/**
 * Validates that a string is a plausible Telegram file_id.
 * Telegram file_ids are base64url strings, typically 50–100 chars.
 */
export function isValidFileId(fileId) {
  return typeof fileId === 'string' && /^[A-Za-z0-9_-]{20,200}$/.test(fileId);
}
