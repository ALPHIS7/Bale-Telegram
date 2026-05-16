import { logger } from './logger.js';

/**
 * Executes an async function with exponential-backoff retries.
 *
 * @param {() => Promise<T>} fn
 * @param {{ attempts: number, delayMs: number }} opts
 * @returns {Promise<T>}
 */
export async function withRetry(fn, { attempts = 3, delayMs = 500 } = {}) {
  let lastError;

  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;
      if (attempt < attempts) {
        const wait = delayMs * 2 ** (attempt - 1);
        logger.warn('Retry attempt failed, backing off', {
          attempt,
          maxAttempts: attempts,
          waitMs: wait,
          error: err.message,
        });
        await new Promise((r) => setTimeout(r, wait));
      }
    }
  }

  throw lastError;
}
