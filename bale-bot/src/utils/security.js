import { logger } from './logger.js';

export async function verifyBaleToken(c, next) {
  const token    = c.req.param('token');
  const expected = c.env.WEBHOOK_SECRET;

  if (!expected || token !== expected) {
    logger.warn('Bale webhook token mismatch', { ip: c.req.header('cf-connecting-ip') });
    return c.json({ error: 'forbidden' }, 403);
  }

  await next();
}

/**
 * Sliding-window rate limiter backed by Cloudflare KV.
 */
export async function checkRateLimit(kv, key, { maxRequests, windowSeconds }) {
  try {
    const raw   = await kv.get(key, { type: 'json' });
    const now   = Math.floor(Date.now() / 1000);
    const entry = raw ?? { count: 0, start: now };

    if (now - entry.start > windowSeconds) {
      await kv.put(key, JSON.stringify({ count: 1, start: now }), {
        expirationTtl: windowSeconds,
      });
      return false;
    }

    if (entry.count >= maxRequests) return true;

    entry.count += 1;
    await kv.put(key, JSON.stringify(entry), { expirationTtl: windowSeconds });
    return false;
  } catch (err) {
    logger.error('Rate limit KV error', { key, error: err.message });
    return false; // fail open
  }
}

/**
 * Basic URL sanitization – rejects obviously malicious patterns.
 */
export function sanitizeUrl(url) {
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error('Invalid protocol');
    }
    return parsed.href;
  } catch {
    return null;
  }
}
