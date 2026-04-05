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

/**
 * Helper: temporarily override env vars, reset modules, import logger,
 * run assertions, then restore env vars.
 */
async function withEnv(
  env: { NODE_ENV?: string; LOG_LEVEL?: string },
  fn: (logger: Awaited<ReturnType<typeof importLogger>>) => void,
) {
  const origNodeEnv = process.env.NODE_ENV;
  const origLogLevel = process.env.LOG_LEVEL;

  if (env.NODE_ENV !== undefined) {
    (process.env as Record<string, string | undefined>).NODE_ENV = env.NODE_ENV;
  }
  if (env.LOG_LEVEL !== undefined) {
    process.env.LOG_LEVEL = env.LOG_LEVEL;
  } else {
    delete process.env.LOG_LEVEL;
  }

  try {
    vi.resetModules();
    const { logger } = await import('../logger');
    fn(logger);
  } finally {
    (process.env as Record<string, string | undefined>).NODE_ENV = origNodeEnv;
    if (origLogLevel !== undefined) {
      process.env.LOG_LEVEL = origLogLevel;
    } else {
      delete process.env.LOG_LEVEL;
    }
  }
}

type Logger = { debug: (...a: unknown[]) => void; info: (...a: unknown[]) => void; warn: (...a: unknown[]) => void; error: (...a: unknown[]) => void };
async function importLogger() {
  return (await import('../logger')).logger;
}

describe('logger (production mode - suppresses debug and info)', () => {
  it('suppresses debug and info in production', async () => {
    await withEnv({ NODE_ENV: 'production' }, (logger) => {
      logger.debug('should not appear');
      logger.info('should not appear');
      expect(console.log).not.toHaveBeenCalled();

      logger.warn('warning');
      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'warning');

      logger.error('error');
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'error');
    });
  });

  it('respects explicit LOG_LEVEL=error even in development', async () => {
    await withEnv({ NODE_ENV: 'development', LOG_LEVEL: 'error' }, (logger) => {
      logger.debug('no');
      logger.info('no');
      logger.warn('no');
      expect(console.log).not.toHaveBeenCalled();
      expect(console.warn).not.toHaveBeenCalled();

      logger.error('yes');
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'yes');
    });
  });
});

describe('logger (LOG_LEVEL filtering for each level)', () => {
  it('LOG_LEVEL=debug outputs all levels', async () => {
    await withEnv({ LOG_LEVEL: 'debug' }, (logger) => {
      logger.debug('d');
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', 'd');

      logger.info('i');
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'i');

      logger.warn('w');
      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'w');

      logger.error('e');
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'e');
    });
  });

  it('LOG_LEVEL=info suppresses debug, outputs info/warn/error', async () => {
    await withEnv({ LOG_LEVEL: 'info' }, (logger) => {
      logger.debug('hidden');
      // debug uses console.log; info also uses console.log so check no call yet
      expect(console.log).not.toHaveBeenCalled();

      logger.info('visible');
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'visible');

      logger.warn('visible');
      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'visible');

      logger.error('visible');
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'visible');
    });
  });

  it('LOG_LEVEL=warn suppresses debug and info, outputs warn/error', async () => {
    await withEnv({ LOG_LEVEL: 'warn' }, (logger) => {
      logger.debug('hidden');
      logger.info('hidden');
      expect(console.log).not.toHaveBeenCalled();

      logger.warn('visible');
      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'visible');

      logger.error('visible');
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'visible');
    });
  });

  it('LOG_LEVEL=error suppresses debug, info, and warn', async () => {
    await withEnv({ LOG_LEVEL: 'error' }, (logger) => {
      logger.debug('hidden');
      logger.info('hidden');
      expect(console.log).not.toHaveBeenCalled();

      logger.warn('hidden');
      expect(console.warn).not.toHaveBeenCalled();

      logger.error('visible');
      expect(console.error).toHaveBeenCalledWith('[ERROR]', 'visible');
    });
  });
});

describe('logger (environment-based default level)', () => {
  it('defaults to debug in development when LOG_LEVEL is unset', async () => {
    await withEnv({ NODE_ENV: 'development' }, (logger) => {
      logger.debug('dev debug');
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', 'dev debug');
    });
  });

  it('defaults to warn in production when LOG_LEVEL is unset', async () => {
    await withEnv({ NODE_ENV: 'production' }, (logger) => {
      logger.debug('hidden');
      logger.info('hidden');
      expect(console.log).not.toHaveBeenCalled();

      logger.warn('prod warn');
      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'prod warn');
    });
  });

  it('explicit LOG_LEVEL overrides NODE_ENV default', async () => {
    await withEnv({ NODE_ENV: 'production', LOG_LEVEL: 'debug' }, (logger) => {
      logger.debug('forced debug in prod');
      expect(console.log).toHaveBeenCalledWith('[DEBUG]', 'forced debug in prod');
    });
  });

  it('unknown LOG_LEVEL falls back to info', async () => {
    await withEnv({ NODE_ENV: 'development', LOG_LEVEL: 'verbose' as string }, (logger) => {
      // Unknown level triggers `levels[...] ?? 1` => info (level 1)
      logger.debug('hidden');
      expect(console.log).not.toHaveBeenCalled();

      logger.info('visible at info');
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'visible at info');
    });
  });
});

describe('logger (structured data and multiple arguments)', () => {
  it('passes structured objects through to console', async () => {
    await withEnv({ LOG_LEVEL: 'debug' }, (logger) => {
      const data = { jobId: 'abc-123', duration: 42, nested: { a: 1 } };
      logger.info('ジョブ完了', data);
      expect(console.log).toHaveBeenCalledWith('[INFO]', 'ジョブ完了', data);
    });
  });

  it('passes Error objects through to console.error', async () => {
    await withEnv({ LOG_LEVEL: 'debug' }, (logger) => {
      const err = new Error('something broke');
      logger.error('処理失敗', err);
      expect(console.error).toHaveBeenCalledWith('[ERROR]', '処理失敗', err);
    });
  });

  it('handles many arguments of mixed types', async () => {
    await withEnv({ LOG_LEVEL: 'debug' }, (logger) => {
      logger.debug('mix', 1, true, null, undefined, [1, 2], { k: 'v' });
      expect(console.log).toHaveBeenCalledWith(
        '[DEBUG]', 'mix', 1, true, null, undefined, [1, 2], { k: 'v' },
      );
    });
  });

  it('handles zero extra arguments (message only)', async () => {
    await withEnv({ LOG_LEVEL: 'debug' }, (logger) => {
      logger.warn('bare warning');
      expect(console.warn).toHaveBeenCalledWith('[WARN]', 'bare warning');
    });
  });

  it('handles no arguments at all', async () => {
    await withEnv({ LOG_LEVEL: 'debug' }, (logger) => {
      logger.info();
      expect(console.log).toHaveBeenCalledWith('[INFO]');
    });
  });
});
