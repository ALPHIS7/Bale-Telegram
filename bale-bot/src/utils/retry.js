import { logger } from './logger.js';

export async function withRetry(fn, { attempts = 3, delayMs = 500 } = {}) {
  let lastError;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (i < attempts) {
        const wait = delayMs * 2 ** (i - 1);
        logger.warn('Retry', { attempt: i, waitMs: wait, error: err.message });
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }
  throw lastError;
}
