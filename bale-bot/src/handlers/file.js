import { sendBaleMessage } from '../services/bale.js';
import { logger }          from '../utils/logger.js';

const ALLOWED_TYPES = new Set([
  'application/pdf',
  'application/zip',
  'application/x-rar-compressed',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'text/plain',
  'image/jpeg', 'image/png', 'image/gif', 'image/webp',
  'video/mp4', 'video/quicktime',
  'audio/mpeg', 'audio/ogg',
]);

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB

/**
 * Feature 1: Receive and validate files forwarded from Telegram bot (or sent directly).
 * Stores metadata in KV.
 */
export async function handleFileReceive(env, chatId, fileObj, message) {
  const { file_id, file_size, file_name, mime_type } = fileObj;

  logger.info('File received on Bale', { chatId, file_id, file_size, mime_type });

  // Validate size
  if (file_size && file_size > MAX_SIZE) {
    await sendBaleMessage(
      env, chatId,
      `❌ File too large (${(file_size / 1_048_576).toFixed(1)} MB). Max: 50 MB.`,
    );
    return;
  }

  // Validate MIME (allow unlisted types with a warning)
  const knownType = !mime_type || ALLOWED_TYPES.has(mime_type);

  // Build metadata record
  const metadata = {
    file_id,
    file_name:   file_name ?? 'unnamed',
    mime_type:   mime_type ?? 'unknown',
    file_size:   file_size ?? 0,
    chat_id:     chatId,
    from_id:     String(message.from?.id ?? chatId),
    received_at: new Date().toISOString(),
    source:      message.forward_from ? 'telegram_forward' : 'direct_upload',
  };

  // Store in KV: key = file:{chatId}:{file_id}, TTL = 7 days
  const kvKey = `file:${chatId}:${file_id}`;
  try {
    await env.KV.put(kvKey, JSON.stringify(metadata), { expirationTtl: 7 * 24 * 3600 });
  } catch (err) {
    logger.error('KV put failed for file metadata', { kvKey, error: err.message });
  }

  const sizeLabel = file_size ? `${(file_size / 1024).toFixed(1)} KB` : 'unknown size';
  const typeNote  = knownType ? '' : '\n⚠️ Unrecognized file type – stored anyway.';

  await sendBaleMessage(
    env, chatId,
    `✅ <b>File received!</b>\n\n` +
    `📄 <b>Name:</b> ${escapeHtml(metadata.file_name)}\n` +
    `📦 <b>Size:</b> ${sizeLabel}\n` +
    `🗂 <b>Type:</b> ${escapeHtml(metadata.mime_type)}\n` +
    `🕐 <b>Stored until:</b> 7 days` +
    typeNote,
  );
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
