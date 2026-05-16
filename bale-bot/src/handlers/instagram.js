import { sendBaleMessage }        from '../services/bale.js';
import { createDownloadProvider } from '../services/downloader/interface.js';
import { logger }                 from '../utils/logger.js';

// Supported Instagram URL shapes
const PATTERNS = {
  reel: /instagram\.com\/(?:reel|reels)\/([\w-]+)/i,
  post: /instagram\.com\/p\/([\w-]+)/i,
};

/**
 * Feature 4: Instagram Downloader.
 *
 * Detects the content type (reel / post), delegates to provider.
 */
export async function handleInstagram(env, chatId, url) {
  logger.info('Instagram download request', { chatId, url });

  const contentType = detectInstagramType(url);
  if (!contentType) {
    await sendBaleMessage(env, chatId, '❌ Could not recognize this Instagram URL. Only reels and posts are supported.');
    return;
  }

  await sendBaleMessage(env, chatId, `📸 Processing Instagram ${contentType}…`);

  const provider = createDownloadProvider(env, 'instagram');

  if (!provider) {
    await sendBaleMessage(
      env, chatId,
      '⚙️ Instagram downloader is not configured yet.\n' +
      'Set the <code>INSTAGRAM_PROVIDER</code> environment variable.',
    );
    return;
  }

  try {
    const result = await provider.download(url, { contentType });

    if (result.type === 'url') {
      const icon = contentType === 'reel' ? '🎬' : '🖼';
      await sendBaleMessage(
        env, chatId,
        `✅ <b>Ready!</b>\n\n` +
        `${icon} <b>${escapeHtml(result.title ?? contentType)}</b>\n` +
        `🔗 <a href="${result.url}">Download</a>\n\n` +
        `⚠️ Link expires in ${result.expiresIn ?? '10 minutes'}.`,
      );
    } else if (result.type === 'media_group' && Array.isArray(result.items)) {
      // Carousel posts – list each media item
      const links = result.items
        .map((item, i) => `${i + 1}. <a href="${item.url}">${item.type ?? 'Media'}</a>`)
        .join('\n');
      await sendBaleMessage(env, chatId, `✅ <b>Post media (${result.items.length} items)</b>\n\n${links}`);
    } else {
      throw new Error('Unknown provider result type: ' + result.type);
    }
  } catch (err) {
    logger.error('Instagram download failed', { chatId, url, error: err.message });
    await sendBaleMessage(
      env, chatId,
      '❌ Failed to download.\n\nPossible reasons:\n' +
      '• Account is private\n• Invalid or expired URL\n• Service unavailable',
    );
  }
}

function detectInstagramType(url) {
  if (PATTERNS.reel.test(url)) return 'reel';
  if (PATTERNS.post.test(url)) return 'post';
  return null;
}

function escapeHtml(str) {
  return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
