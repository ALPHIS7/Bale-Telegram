import { logger }    from '../../../utils/logger.js';
import { withRetry } from '../../../utils/retry.js';

/**
 * HttpProvider – delegates download jobs to an external HTTP microservice.
 *
 * The microservice must implement:
 *   POST /download
 *     Body: { url, service, options }
 *     Response: DownloadResult (see interface.js)
 *
 * Configure via env vars:
 *   DOWNLOADER_API_URL   – e.g. https://dl.yourdomain.com
 *   DOWNLOADER_API_KEY   – bearer token for the microservice
 */
export class HttpProvider {
  constructor(env, service) {
    this.env     = env;
    this.service = service;
    this.baseUrl = env.DOWNLOADER_API_URL?.replace(/\/$/, '') ?? '';
    this.apiKey  = env.DOWNLOADER_API_KEY ?? '';
  }

  /**
   * @param {string} url     - Source URL (YouTube/Instagram)
   * @param {object} options - { quality, format, contentType, … }
   * @returns {Promise<DownloadResult>}
   */
  async download(url, options = {}) {
    if (!this.baseUrl) {
      throw new Error('DOWNLOADER_API_URL is not configured');
    }

    const endpoint = `${this.baseUrl}/download`;

    const result = await withRetry(
      async () => {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': `Bearer ${this.apiKey}`,
          },
          body: JSON.stringify({ url, service: this.service, options }),
        });

        if (!res.ok) {
          const text = await res.text();
          throw new Error(`Downloader API [${res.status}]: ${text}`);
        }

        return res.json();
      },
      { attempts: 2, delayMs: 1000 },
    );

    logger.info('HttpProvider download result', { service: this.service, resultType: result.type });
    return result;
  }
}
