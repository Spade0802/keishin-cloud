const LOG_LEVEL = process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');
const levels = { debug: 0, info: 1, warn: 2, error: 3 };
const currentLevel = levels[LOG_LEVEL as keyof typeof levels] ?? 1;

export const logger = {
  debug: (...args: unknown[]) => currentLevel <= 0 && console.log('[DEBUG]', ...args),
  info: (...args: unknown[]) => currentLevel <= 1 && console.log('[INFO]', ...args),
  warn: (...args: unknown[]) => currentLevel <= 2 && console.warn('[WARN]', ...args),
  error: (...args: unknown[]) => currentLevel <= 3 && console.error('[ERROR]', ...args),
};
