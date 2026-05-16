import { logger } from '../utils/logger.js';

const BALE_API_BASE = 'https://tapi.bale.ai';

/**
 * Sends a plain-text (HTML-formatted) message via Bale Bot API.
 */
export async function sendBaleMessage(env, chatId, text, extra = {}) {
  const url  = `${BALE_API_BASE}/bot${env.BALE_BOT_TOKEN}/sendMessage`;
  const body = { chat_id: chatId, text, parse_mode: 'HTML', ...extra };

  try {
    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
    });
    const data = await res.json();
    if (!data.ok) {
      logger.warn('sendMessage non-ok', { chatId, description: data.description });
    }
    return data;
  } catch (err) {
    logger.error('sendMessage fetch failed', { chatId, error: err.message });
  }
}

/**
 * Sends a document (file) via Bale Bot API using a URL source.
 */
export async function sendBaleDocument(env, chatId, fileUrl, caption = '') {
  const url  = `${BALE_API_BASE}/bot${env.BALE_BOT_TOKEN}/sendDocument`;
  const body = { chat_id: chatId, document: fileUrl, caption, parse_mode: 'HTML' };

  const res  = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  });
  return res.json();
}

/**
 * Uploads a file stream to Bale using multipart/form-data.
 */
export async function uploadFileToBale(env, chatId, { stream, fileName, mimeType, method = 'sendDocument', fieldName = 'document' }) {
  const url = `${BALE_API_BASE}/bot${env.BALE_BOT_TOKEN}/${method}`;

  const chunks = [];
  const reader = stream.getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const totalSize = chunks.reduce((acc, c) => acc + c.byteLength, 0);
  const merged    = new Uint8Array(totalSize);
  let offset = 0;
  for (const c of chunks) { merged.set(c, offset); offset += c.byteLength; }

  const blob = new Blob([merged.buffer], { type: mimeType });
  const form = new FormData();
  form.append('chat_id', chatId);
  form.append(fieldName, blob, fileName);

  const res = await fetch(url, { method: 'POST', body: form });
  return res.json();
}

/**
 * Sets the Bale webhook.
 */
export async function setBaleWebhook(env, webhookUrl) {
  const url = `${BALE_API_BASE}/bot${env.BALE_BOT_TOKEN}/setWebhook`;
  const res = await fetch(url, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url: webhookUrl }),
  });
  return res.json();
}
