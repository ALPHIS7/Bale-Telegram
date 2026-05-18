import { logger } from '../../../utils/logger.js';

/**
 * CobaltProvider – uses cobalt.tools free public API
 * Supports: YouTube, Instagram (reels, posts)
 * No API key required.
 * Docs: https://cobalt.tools
 */
export class CobaltProvider {
  constructor(env, service) {
    this.env     = env;
    this.service = service;
    this.baseUrl = 'https://api.cobalt.tools';
  }

  async download(url, options = {}) {
    logger.info('CobaltProvider download', { service: this.service, url });

    const res = await fetch(this.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
      },
      body: JSON.stringify({
        url,
        videoQuality:    options.quality === 'audio' ? undefined : '1080',
        filenameStyle:   'basic',
        downloadMode:    options.quality === 'audio' ? 'audio' : 'auto',
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Cobalt API [${res.status}]: ${text}`);
    }

    const data = await res.json();
    logger.info('Cobalt response', { status: data.status });

    // status: "tunnel" or "redirect" → single file
    if (data.status === 'tunnel' || data.status === 'redirect') {
      return {
        type:      'url',
        url:       data.url,
        title:     data.filename ?? 'media',
        expiresIn: '1 hour',
      };
    }

    // status: "picker" → carousel (Instagram multi-image)
    if (data.status === 'picker' && Array.isArray(data.picker)) {
      return {
        type:  'media_group',
        items: data.picker.map((item) => ({
          url:  item.url,
          type: item.type ?? 'photo',
        })),
      };
    }

    // status: "error"
    const errorMsg = data.error?.code ?? data.text ?? 'unknown error';
    throw new Error(`Cobalt error: ${errorMsg}`);
  }
}
