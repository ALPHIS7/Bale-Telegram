const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 };

function log(level, message, meta = {}) {
  // In production Workers, console output is captured by Cloudflare Logpush
  const entry = {
    ts:      new Date().toISOString(),
    level,
    message,
    ...meta,
  };
  const fn = level === 'error' ? console.error
           : level === 'warn'  ? console.warn
           : console.log;
  fn(JSON.stringify(entry));
}

export const logger = {
  debug: (msg, meta) => log('debug', msg, meta),
  info:  (msg, meta) => log('info',  msg, meta),
  warn:  (msg, meta) => log('warn',  msg, meta),
  error: (msg, meta) => log('error', msg, meta),
};
