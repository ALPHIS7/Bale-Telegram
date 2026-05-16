import { logger } from '../utils/logger.js';

const BASE = 'https://api.telegram.org';

/**
 * Returns the HTTPS download URL for a given file_id.
 * Calls getFile then constructs the CDN URL.
 */
export async function getTelegramFileUrl(env, fileId) {
  const url = `${BASE}/bot${env.TELEGRAM_BOT_TOKEN}/getFile?file_id=${encodeURIComponent(fileId)}`;
  const res  = await fetch(url);
  const data = await res.json();

  if (!data.ok) {
    throw new Error(`getFile failed: ${data.description ?? 'unknown'}`);
  }

  const filePath = data.result.file_path;
  return `${BASE}/file/bot${env.TELEGRAM_BOT_TOKEN}/${filePath}`;
}

/**
 * Sends a plain-text message to a Telegram chat.
 */
export async function sendTelegramMessage(env, chatId, text, extra = {}) {
  const url  = `${BASE}/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`;
  const body = { chat_id: chatId, text, parse_mode: 'HTML', ...extra };

  try {
    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      logger.warn('sendMessage non-ok response', { chatId, description: data.description });
    }
    return data;
  } catch (err) {
    logger.error('sendMessage fetch failed', { chatId, error: err.message });
  }
}

/**
 * Sets the webhook URL for this bot.
 * Used during deployment / setup.
 */
export async function setTelegramWebhook(env, webhookUrl) {
  const url  = `${BASE}/bot${env.TELEGRAM_BOT_TOKEN}/setWebhook`;
  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url: webhookUrl, max_connections: 100 }),
  });
  return res.json();
}
