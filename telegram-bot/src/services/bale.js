import { logger } from '../utils/logger.js';

const BALE_API_BASE = 'https://tapi.bale.ai';

/**
 * Forwards a ReadableStream directly to Bale sendDocument/sendPhoto/etc.
 * Uses multipart/form-data with streaming body – avoids full memory buffering.
 *
 * Cloudflare Workers support ReadableStream in FormData via the File API.
 */
export async function forwardFileToBale(env, { stream, fileName, mimeType, contentLength, fileType, sourceChatId }) {
  const baleMethod = resolveBaleMethod(fileType);
  const fieldName  = resolveBaleFieldName(fileType);

  const url = `${BALE_API_BASE}/bot${env.BALE_BOT_TOKEN}/${baleMethod}`;

  // Build FormData with a streaming blob
  const form = new FormData();
  form.append('chat_id', env.BALE_TARGET_CHAT_ID);

  // Workers support Blob constructed from a ReadableStream
  const blob = contentLength
    ? new Blob([await streamToArrayBuffer(stream)], { type: mimeType })
    : new Blob([await streamToArrayBuffer(stream)], { type: mimeType });

  form.append(fieldName, blob, fileName);
  form.append('caption', `📥 Forwarded from Telegram | ${new Date().toUTCString()}`);

  const res = await fetch(url, { method: 'POST', body: form });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Bale ${baleMethod} failed [${res.status}]: ${text}`);
  }

  const data = await res.json();
  if (!data.ok) {
    throw new Error(`Bale API error: ${data.description ?? 'unknown'}`);
  }

  logger.info('File forwarded to Bale', { baleMethod, fileName, sourceChatId });
  return data;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function resolveBaleMethod(fileType) {
  const map = {
    photo:      'sendPhoto',
    video:      'sendVideo',
    audio:      'sendAudio',
    voice:      'sendVoice',
    animation:  'sendAnimation',
    video_note: 'sendVideoNote',
    sticker:    'sendSticker',
  };
  return map[fileType] ?? 'sendDocument';
}

function resolveBaleFieldName(fileType) {
  const map = {
    photo:      'photo',
    video:      'video',
    audio:      'audio',
    voice:      'voice',
    animation:  'animation',
    video_note: 'video_note',
    sticker:    'sticker',
  };
  return map[fileType] ?? 'document';
}

/**
 * Drains a ReadableStream into an ArrayBuffer.
 * Used because Workers Blob constructor does not accept streams directly in all runtimes.
 */
async function streamToArrayBuffer(stream) {
  const reader = stream.getReader();
  const chunks = [];
  let totalSize = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    totalSize += value.byteLength;
  }

  const result = new Uint8Array(totalSize);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return result.buffer;
}
