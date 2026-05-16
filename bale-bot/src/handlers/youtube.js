import { sendBaleMessage }         from '../services/bale.js';
import { createDownloadProvider }  from '../services/downloader/interface.js';
import { logger }                  from '../utils/logger.js';

/**
 * Feature 3: YouTube Downloader.
 *
 * Architecture: this handler only orchestrates.
 * Actual downloading is delegated to a pluggable provider (external microservice).
 * To swap providers, change the YOUTUBE_PROVIDER env var.
 */
export async function handleYouTube(env, chatId, url) {
  logger.info('YouTube download request', { chatId, url });

  await sendBaleMessage(env, chatId, '▶️ Processing your YouTube link…');

  const provider = createDownloadProvider(env, 'youtube');

  if (!provider) {
    await sendBaleMessage(
      env, chatId,
      '⚙️ YouTube downloader is not configured yet.\n' +
      'Set the <code>YOUTUBE_PROVIDER</code> environment variable.',
    );
    return;
  }

  try {
    const result = await provider.download(url, { quality: 'best', format: 'mp4' });

    if (result.type === 'url') {
      // Provider returned a pre-signed download URL
      await sendBaleMessage(
        env, chatId,
        `✅ <b>Ready to download!</b>\n\n` +
        `🎬 <b>${escapeHtml(result.title ?? 'Video')}</b>\n` +
        `⏱ Duration: ${result.duration ?? 'unknown'}\n` +
        `🔗 <a href="${result.url}">Download Link</a>\n\n` +
        `⚠️ Link expires in ${result.expiresIn ?? '10 minutes'}.`,
      );
    } else if (result.type === 'pending') {
      // Provider works asynchronously – poll or use webhook callback
      await sendBaleMessage(
        env, chatId,
        `⏳ Download queued. You'll receive the file shortly.\n` +
        `📋 Job ID: <code>${result.jobId}</code>`,
      );
    } else {
      throw new Error('Unknown provider result type: ' + result.type);
    }
  } catch (err) {
    logger.error('YouTube download failed', { chatId, url, error: err.message });
    await sendBaleMessage(
      env, chatId,
      '❌ Failed to download the video.\n\n' +
      'Possible reasons:\n' +
      '• Video is age-restricted or private\n' +
      '• Invalid URL\n' +
      '• Download service temporarily unavailable',
    );
  }
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
