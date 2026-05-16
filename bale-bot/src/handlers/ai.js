import { sendBaleMessage }          from '../services/bale.js';
import { generateGeminiResponse }    from '../services/gemini.js';
import { logger }                    from '../utils/logger.js';

const HISTORY_TTL  = 30 * 60;      // 30 minutes conversation window
const MAX_HISTORY  = 10;            // Keep last 10 turns (5 exchanges)
const TYPING_CHAR  = '⌛';

/**
 * Feature 2: AI Chat via Google Gemini.
 * Maintains per-user conversation history in KV.
 */
export async function handleAiChat(env, chatId, userId, userText) {
  logger.info('AI chat request', { chatId, userId, textLength: userText.length });

  // Load conversation history
  const historyKey = `chat:history:${userId}`;
  let history = [];
  try {
    const raw = await env.KV.get(historyKey, { type: 'json' });
    if (Array.isArray(raw)) history = raw;
  } catch {
    // Start fresh on KV failure
  }

  // Append user turn
  history.push({ role: 'user', parts: [{ text: userText }] });

  // Trim to max window
  if (history.length > MAX_HISTORY * 2) {
    history = history.slice(-MAX_HISTORY * 2);
  }

  let reply;
  try {
    reply = await generateGeminiResponse(env, history);
  } catch (err) {
    logger.error('Gemini API error', { userId, error: err.message });

    const errMsg = classifyGeminiError(err);
    await sendBaleMessage(env, chatId, errMsg);
    return;
  }

  // Append assistant turn to history
  history.push({ role: 'model', parts: [{ text: reply }] });

  // Persist updated history
  try {
    await env.KV.put(historyKey, JSON.stringify(history), {
      expirationTtl: HISTORY_TTL,
    });
  } catch (err) {
    logger.warn('Failed to persist chat history', { userId, error: err.message });
  }

  await sendBaleMessage(env, chatId, `🤖 ${reply}`);
}

// ── Error classification ───────────────────────────────────────────────────────

function classifyGeminiError(err) {
  const msg = err.message ?? '';
  if (msg.includes('429') || msg.toLowerCase().includes('quota')) {
    return '⚠️ AI quota exceeded. Please try again in a few minutes.';
  }
  if (msg.includes('SAFETY')) {
    return '🚫 The AI declined to answer that question due to safety filters.';
  }
  if (msg.includes('timeout')) {
    return '⏱️ AI response timed out. Please try a shorter message.';
  }
  return '❌ AI service is temporarily unavailable. Please try again later.';
}
