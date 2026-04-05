import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';

beforeEach(() => {
  vi.spyOn(console, 'log').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
});

describe('logger (basic)', () => {
  it('logger オブジェクトが全メソッドを持つ', async () => {
    const { logger } = await import('../logger');
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('debug() が例外を投げない', async () => {
    const { logger } = await import('../logger');
    expect(() => logger.debug('test message')).not.toThrow();
  });

  it('info() が例外を投げない', async () => {
    const { logger } = await import('../logger');
    expect(() => logger.info('test message', { key: 'value' })).not.toThrow();
  });

  it('warn() が例外を投げない', async () => {
    const { logger } = await import('../logger');
    expect(() => logger.warn('warning message')).not.toThrow();
  });

  it('error() が例外を投げない', async () => {
    const { logger } = await import('../logger');
    expect(() => logger.error('error message', new Error('test'))).not.toThrow();
  });

  it('複数引数を渡しても例外を投げない', async () => {
    const { logger } = await import('../logger');
    expect(() => logger.info('msg', 1, true, null, undefined, { a: 1 })).not.toThrow();
  });
});

describe('logger (output prefixes)', () => {
  it('debug outputs [DEBUG] prefix via console.log', async () => {
    const { logger } = await import('../logger');
    logger.debug('test message');
    expect(console.log).toHaveBeenCalledWith('[DEBUG]', 'test message');
  });

  it('info outputs [INFO] prefix via console.log', async () => {
    const { logger } = await import('../logger');
    logger.info('info msg');
    expect(console.log).toHaveBeenCalledWith('[INFO]', 'info msg');
  });

  it('warn outputs [WARN] prefix via console.warn', async () => {
    const { logger } = await import('../logger');
    logger.warn('warn msg');
    expect(console.warn).toHaveBeenCalledWith('[WARN]', 'warn msg');
  });

  it('error outputs [ERROR] prefix via console.error', async () => {
    const { logger } = await import('../logger');
    logger.error('error msg');
    expect(console.error).toHaveBeenCalledWith('[ERROR]', 'error msg');
  });

  it('handles multiple arguments of various types', async () => {
    const { logger } = await import('../logger');
    const obj = { key: 'val' };
    logger.info('msg', 42, obj);
    expect(console.log).toHaveBeenCalledWith('[INFO]', 'msg', 42, obj);
  });
});

describe('logger (production mode - suppresses debug and info)', () => {
  it('suppresses debug and info in production', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origLogLevel = process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'production';
    delete process.env.LOG_LEVEL;

    try {
      vi.resetModules();
      const { logger } = await import('../logger');

      logger.debug('should not appear');
      logger.info('should not appear');
      expect(console.log).not.toHaveBeenCalled();

      logger.warn('warning');
      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'warning');

      logger.error('error');
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'error');
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      if (origLogLevel !== undefined) {
        process.env.LOG_LEVEL = origLogLevel;
      } else {
        delete process.env.LOG_LEVEL;
      }
    }
  });

  it('respects explicit LOG_LEVEL=error even in development', async () => {
    const origNodeEnv = process.env.NODE_ENV;
    const origLogLevel = process.env.LOG_LEVEL;
    process.env.NODE_ENV = 'development';
    process.env.LOG_LEVEL = 'error';

    try {
      vi.resetModules();
      const { logger } = await import('../logger');

      logger.debug('no');
      logger.info('no');
      logger.warn('no');
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      logger.error('yes');
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'yes');
    } finally {
      process.env.NODE_ENV = origNodeEnv;
      if (origLogLevel !== undefined) {
        process.env.LOG_LEVEL = origLogLevel;
      } else {
        delete process.env.LOG_LEVEL;
      }
    }
  });
});
