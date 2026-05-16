import { getTelegramFileUrl, sendTelegramMessage } from '../services/telegram.js';
import { forwardFileToBale } from '../services/bale.js';
import { logger } from '../utils/logger.js';
import { withRetry } from '../utils/retry.js';

const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20 MB – Telegram Bot API limit

/**
 * Orchestrates the full file-transfer pipeline:
 *   1. Resolve file_id → download URL
 *   2. Stream file from Telegram CDN → Bale upload API
 *   3. Notify user of result
 */
export async function processFileTransfer(env, chatId, fileObj, fileType) {
  const { file_id, file_size, file_name, mime_type } = fileObj;

  logger.info('Starting file transfer', { chatId, fileType, file_id, file_size });

  // Guard: reject oversized files early
  if (file_size && file_size > MAX_FILE_SIZE) {
    await sendTelegramMessage(
      env,
      chatId,
      `❌ File too large (${(file_size / 1_048_576).toFixed(1)} MB). Max allowed: 20 MB.`,
    );
    return;
  }

  await sendTelegramMessage(env, chatId, '⏳ Transferring your file to Bale…');

  try {
    // Step 1: Resolve file path
    const downloadUrl = await withRetry(() => getTelegramFileUrl(env, file_id), {
      attempts: 3,
      delayMs: 500,
    });

    // Step 2: Fetch file as a ReadableStream – never buffer full body
    const fileResponse = await withRetry(() => fetch(downloadUrl), {
      attempts: 3,
      delayMs: 500,
    });

    if (!fileResponse.ok) {
      throw new Error(`Telegram CDN responded ${fileResponse.status}`);
    }

    const contentLength = fileResponse.headers.get('content-length');
    const resolvedMime  = mime_type ?? fileResponse.headers.get('content-type') ?? 'application/octet-stream';
    const resolvedName  = file_name ?? `${fileType}_${Date.now()}`;

    // Step 3: Forward stream → Bale
    await withRetry(
      () =>
        forwardFileToBale(env, {
          stream:        fileResponse.body,
          fileName:      resolvedName,
          mimeType:      resolvedMime,
          contentLength: contentLength ? parseInt(contentLength, 10) : undefined,
          fileType,
          sourceChatId:  chatId,
        }),
      { attempts: 2, delayMs: 1000 },
    );

    logger.info('File transfer complete', { chatId, file_id });
    await sendTelegramMessage(env, chatId, '✅ File successfully forwarded to Bale!');
  } catch (err) {
    logger.error('File transfer failed', { chatId, file_id, error: err.message });
    await sendTelegramMessage(
      env,
      chatId,
      '❌ Failed to transfer your file. Please try again later.',
    );
  }
}
