import { describe, expect, it } from 'vitest';
import { logger } from '../logger';

describe('logger', () => {
  it('logger オブジェクトが全メソッドを持つ', () => {
    expect(typeof logger.debug).toBe('function');
    expect(typeof logger.info).toBe('function');
    expect(typeof logger.warn).toBe('function');
    expect(typeof logger.error).toBe('function');
  });

  it('debug() が例外を投げない', () => {
    expect(() => logger.debug('test message')).not.toThrow();
  });

  it('info() が例外を投げない', () => {
    expect(() => logger.info('test message', { key: 'value' })).not.toThrow();
  });

  it('warn() が例外を投げない', () => {
    expect(() => logger.warn('warning message')).not.toThrow();
  });

  it('error() が例外を投げない', () => {
    expect(() => logger.error('error message', new Error('test'))).not.toThrow();
  });

  it('複数引数を渡しても例外を投げない', () => {
    expect(() => logger.info('msg', 1, true, null, undefined, { a: 1 })).not.toThrow();
  });
});
