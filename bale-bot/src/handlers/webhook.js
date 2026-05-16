import { handleFileReceive } from './file.js';
import { handleAiChat }      from './ai.js';
import { handleYouTube }     from './youtube.js';
import { handleInstagram }   from './instagram.js';
import { sendBaleMessage }   from '../services/bale.js';
import { checkRateLimit }    from '../utils/security.js';
import { logger }            from '../utils/logger.js';

// URL detectors
const YT_RE    = /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|shorts\/))([\w-]{11})/i;
const IG_RE    = /instagram\.com\/(p|reel|reels)\//i;

/**
 * Main Bale webhook dispatcher.
 */
export async function webhookHandler(c) {
  const env = c.env;
  let update;

  try {
    update = await c.req.json();
  } catch {
    return c.json({ error: 'invalid_json' }, 400);
  }

  const message = update?.message;
  if (!message) return c.json({ ok: true });

  const chatId  = String(message.chat.id);
  const userId  = String(message.from?.id ?? chatId);
  const text    = message.text?.trim() ?? '';

  logger.info('Bale update', { updateId: update.update_id, chatId, hasFile: !!getFile(message) });

  // ── Rate limiting ─────────────────────────────────────────────────────────
  const limited = await checkRateLimit(env.KV, `bale:rl:${userId}`, {
    maxRequests: 20,
    windowSeconds: 60,
  });
  if (limited) {
    await sendBaleMessage(env, chatId, '⏳ Too many requests. Please slow down.');
    return c.json({ ok: true });
  }

  // ── /start ────────────────────────────────────────────────────────────────
  if (text.startsWith('/start')) {
    await sendBaleMessage(env, chatId, buildWelcomeMessage());
    return c.json({ ok: true });
  }

  // ── /help ─────────────────────────────────────────────────────────────────
  if (text.startsWith('/help')) {
    await sendBaleMessage(env, chatId, buildHelpMessage());
    return c.json({ ok: true });
  }

  // ── File received ─────────────────────────────────────────────────────────
  const file = getFile(message);
  if (file) {
    c.executionCtx.waitUntil(handleFileReceive(env, chatId, file, message));
    return c.json({ ok: true });
  }

  // ── Text routing ──────────────────────────────────────────────────────────
  if (text) {
    if (YT_RE.test(text)) {
      c.executionCtx.waitUntil(handleYouTube(env, chatId, text));
      return c.json({ ok: true });
    }

    if (IG_RE.test(text)) {
      c.executionCtx.waitUntil(handleInstagram(env, chatId, text));
      return c.json({ ok: true });
    }

    // Default: AI chat
    c.executionCtx.waitUntil(handleAiChat(env, chatId, userId, text));
    return c.json({ ok: true });
  }

  await sendBaleMessage(env, chatId, '❓ Please send a file, a YouTube/Instagram link, or ask me anything!');
  return c.json({ ok: true });
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getFile(message) {
  return (
    message.document   ||
    message.video      ||
    message.audio      ||
    message.voice      ||
    message.animation  ||
    message.sticker    ||
    message.video_note ||
    (message.photo?.length
      ? message.photo.reduce((a, b) => ((a.file_size ?? 0) > (b.file_size ?? 0) ? a : b))
      : null)
  );
}

function buildWelcomeMessage() {
  return (
    '👋 <b>Welcome to Bale Bot!</b>\n\n' +
    'I can help you with:\n' +
    '📁 <b>Files</b> – Send any file and I will store it\n' +
    '🤖 <b>AI Chat</b> – Ask me anything\n' +
    '▶️ <b>YouTube</b> – Send a YouTube link to download\n' +
    '📸 <b>Instagram</b> – Send a reel/post link to download\n\n' +
    'Type /help for full command list.'
  );
}

function buildHelpMessage() {
  return (
    '📖 <b>Commands</b>\n\n' +
    '/start – Welcome message\n' +
    '/help – This message\n\n' +
    '<b>Features:</b>\n' +
    '• Send a file → stored &amp; confirmed\n' +
    '• Send text → AI chat (Gemini)\n' +
    '• Send YouTube URL → download\n' +
    '• Send Instagram URL → download reel/post'
  );
}
