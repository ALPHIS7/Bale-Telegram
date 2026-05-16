import { logger } from '../utils/logger.js';

const GEMINI_API_BASE    = 'https://generativelanguage.googleapis.com/v1beta';
const DEFAULT_MODEL      = 'gemini-2.0-flash';
const REQUEST_TIMEOUT_MS = 25_000; // 25 s – well within Workers 30 s CPU limit

/**
 * Sends a multi-turn conversation history to Gemini and returns the reply text.
 *
 * @param {object}   env     - Cloudflare Worker env bindings
 * @param {Array}    history - Array of { role: 'user'|'model', parts: [{text}] }
 * @returns {Promise<string>}
 */
export async function generateGeminiResponse(env, history) {
  const model   = env.GEMINI_MODEL ?? DEFAULT_MODEL;
  const apiKey  = env.GEMINI_API_KEY;

  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured');

  const url  = `${GEMINI_API_BASE}/models/${model}:generateContent?key=${apiKey}`;
  const body = {
    contents: history,
    generationConfig: {
      temperature:     0.8,
      topP:            0.95,
      maxOutputTokens: 800,
    },
    safetySettings: [
      { category: 'HARM_CATEGORY_HARASSMENT',        threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_HATE_SPEECH',       threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
      { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
    ],
  };

  // AbortController for timeout
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res;
  try {
    res = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body),
      signal:  controller.signal,
    });
  } catch (err) {
    if (err.name === 'AbortError') throw new Error('timeout');
    throw err;
  } finally {
    clearTimeout(timer);
  }

  if (res.status === 429) throw new Error('429 quota exceeded');

  const data = await res.json();

  if (!res.ok) {
    const msg = data?.error?.message ?? `HTTP ${res.status}`;
    logger.error('Gemini API error', { status: res.status, msg });
    throw new Error(msg);
  }

  // Extract text from first candidate
  const candidate = data?.candidates?.[0];
  const finishReason = candidate?.finishReason;

  if (finishReason === 'SAFETY') throw new Error('SAFETY');

  const text = candidate?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';

  if (!text) throw new Error('Empty response from Gemini');

  return text;
}
