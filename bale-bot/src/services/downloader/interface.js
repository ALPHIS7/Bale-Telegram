/**
 * Downloader Provider Interface
 * ─────────────────────────────
 * This module acts as a factory that returns the correct provider implementation
 * based on environment configuration.
 *
 * To add a new provider:
 *   1. Create a file in ./providers/{name}.js
 *   2. Export a class implementing { download(url, options): Promise<DownloadResult> }
 *   3. Register it in the PROVIDER_REGISTRY below
 *
 * DownloadResult shape:
 *   { type: 'url',        url, title?, duration?, expiresIn? }
 *   { type: 'pending',    jobId, estimatedSeconds? }
 *   { type: 'media_group', items: [{ url, type }] }
 */

import { HttpProvider }   from './providers/http.js';
import { CobaltProvider } from './providers/cobalt.js';
import { logger }         from '../../utils/logger.js';

// Registry maps provider name → constructor
const PROVIDER_REGISTRY = {
  http:   HttpProvider,
  cobalt: CobaltProvider,
};

/**
 * Returns an instantiated download provider for the given service.
 *
 * @param {object} env         - Cloudflare Worker env bindings
 * @param {'youtube'|'instagram'} service
 * @returns {DownloadProvider | null}
 */
export function createDownloadProvider(env, service) {
  const envKey      = `${service.toUpperCase()}_PROVIDER`;   // e.g. YOUTUBE_PROVIDER
  const providerKey = (env[envKey] ?? '').toLowerCase();

  if (!providerKey) {
    logger.warn('No download provider configured', { service, envKey });
    return null;
  }

  const ProviderClass = PROVIDER_REGISTRY[providerKey];
  if (!ProviderClass) {
    logger.error('Unknown download provider', { service, providerKey });
    return null;
  }

  return new ProviderClass(env, service);
}
