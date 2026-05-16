import { processFileTransfer } from './file.js';
import { sendTelegramMessage } from '../services/telegram.js';
import { logger } from '../utils/logger.js';
import { checkRateLimit } from '../utils/security.js';

/**
 * Extracts the file object and type from a Telegram message.
 * Returns null if no supported file is present.
 */
function extractFileFromMessage(message) {
  if (message.document)  return { file: message.document, type: 'document' };
  if (message.video)     return { file: message.video,    type: 'video' };
  if (message.audio)     return { file: message.audio,    type: 'audio' };
  if (message.voice)     return { file: message.voice,    type: 'voice' };
  if (message.animation) return { file: message.animation,type: 'animation' };
  if (message.sticker)   return { file: message.sticker,  type: 'sticker' };
  if (message.video_note)return { file: message.video_note,type:'video_note'};

  // Photos – pick the largest resolution
  if (message.photo?.length) {
    const largest = message.photo.reduce((a, b) =>
      (a.file_size ?? 0) > (b.file_size ?? 0) ? a : b
    );
    return { file: largest, type: 'photo' };
  }

  return null;
}

/**
 * Main Telegram webhook handler.
 * Called after token verification middleware passes.
 */
export async function webhookHandler(c) {
  const env  = c.env;
  let update;

  // ── Parse body ────────────────────────────────────────────────────────────
  try {
    update = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const message = update?.message;
  if (!message) {
    // Telegram sends non-message updates (callback_query, etc.) – ignore safely
    return c.json({ ok: true });
  }

  const chatId = String(message.chat.id);
  const userId = String(message.from?.id ?? chatId);

  logger.info('Incoming Telegram update', { updateId: update.update_id, chatId });

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const limited = await checkRateLimit(env.KV, `tg:rl:${userId}`, {
    maxRequests: 10,
    windowSeconds: 60,
  });
  if (limited) {
    await sendTelegramMessage(env, chatId, '⏳ Too many requests. Please wait a moment.');
    return c.json({ ok: true });
  }

  // ── Command: /start ───────────────────────────────────────────────────────
  if (message.text?.startsWith('/start')) {
    await sendTelegramMessage(
      env,
      chatId,
      '👋 Welcome to the File Transfer Gateway!\n\nSend me any file and I will forward it to Bale.',
    );
    return c.json({ ok: true });
  }

  // ── File handling ─────────────────────────────────────────────────────────
  const extracted = extractFileFromMessage(message);
  if (!extracted) {
    await sendTelegramMessage(
      env,
      chatId,
      '⚠️ Please send a file (document, image, video, audio, etc.).',
    );
    return c.json({ ok: true });
  }

  // Fire-and-forget so Telegram's 5-second ack deadline is met
  c.executionCtx.waitUntil(
    processFileTransfer(env, chatId, extracted.file, extracted.type),
  );

  return c.json({ ok: true });
}
