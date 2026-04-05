import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger before importing the module under test
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import { captureException, captureMessage } from '../error-tracking';
import { logger } from '@/lib/logger';

const mockedLogger = logger as unknown as {
  debug: ReturnType<typeof vi.fn>;
  info: ReturnType<typeof vi.fn>;
  warn: ReturnType<typeof vi.fn>;
  error: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('captureException', () => {
  it('logs Error instances at error level with message and stack', () => {
    const err = new Error('something broke');
    captureException(err);

    expect(mockedLogger.error).toHaveBeenCalledTimes(1);
    const [label, payload] = mockedLogger.error.mock.calls[0];
    expect(label).toContain('captureException');
    expect(payload.message).toBe('something broke');
    expect(payload.stack).toBeDefined();
  });

  it('logs non-Error values coerced to string', () => {
    captureException('raw string error');

    expect(mockedLogger.error).toHaveBeenCalledTimes(1);
    const payload = mockedLogger.error.mock.calls[0][1];
    expect(payload.message).toBe('raw string error');
    expect(payload.stack).toBeUndefined();
  });

  it('handles numeric error values', () => {
    captureException(404);

    const payload = mockedLogger.error.mock.calls[0][1];
    expect(payload.message).toBe('404');
    expect(payload.stack).toBeUndefined();
  });

  it('handles null error value', () => {
    captureException(null);

    const payload = mockedLogger.error.mock.calls[0][1];
    expect(payload.message).toBe('null');
    expect(payload.stack).toBeUndefined();
  });

  it('handles undefined error value', () => {
    captureException(undefined);

    const payload = mockedLogger.error.mock.calls[0][1];
    expect(payload.message).toBe('undefined');
    expect(payload.stack).toBeUndefined();
  });

  it('handles object error value', () => {
    captureException({ code: 'ERR_TIMEOUT' });

    const payload = mockedLogger.error.mock.calls[0][1];
    expect(payload.message).toBe('[object Object]');
    expect(payload.stack).toBeUndefined();
  });

  it('handles Error subclasses (TypeError)', () => {
    const err = new TypeError('cannot read property of null');
    captureException(err);

    const payload = mockedLogger.error.mock.calls[0][1];
    expect(payload.message).toBe('cannot read property of null');
    expect(payload.stack).toContain('TypeError');
  });

  it('handles Error subclasses (RangeError)', () => {
    const err = new RangeError('index out of bounds');
    captureException(err);

    const payload = mockedLogger.error.mock.calls[0][1];
    expect(payload.message).toBe('index out of bounds');
    expect(payload.stack).toBeDefined();
  });

  it('works without context (no context arg)', () => {
    captureException(new Error('no ctx'));

    const payload = mockedLogger.error.mock.calls[0][1];
    expect(payload.message).toBe('no ctx');
    // Should not have context keys
    expect(payload.userId).toBeUndefined();
    expect(payload.organizationId).toBeUndefined();
    expect(payload.route).toBeUndefined();
    expect(payload.action).toBeUndefined();
    expect(payload.extra).toBeUndefined();
  });

  it('includes context data when provided', () => {
    captureException(new Error('fail'), {
      userId: 'u-1',
      organizationId: 'org-2',
      route: '/api/test',
      action: 'create',
      extra: { jobId: 'j-99' },
    });

    const payload = mockedLogger.error.mock.calls[0][1];
    expect(payload.userId).toBe('u-1');
    expect(payload.organizationId).toBe('org-2');
    expect(payload.route).toBe('/api/test');
    expect(payload.extra).toEqual({ jobId: 'j-99' });
  });

  it('includes partial context (only extra)', () => {
    captureException(new Error('partial'), { extra: { retries: 3 } });

    const payload = mockedLogger.error.mock.calls[0][1];
    expect(payload.extra).toEqual({ retries: 3 });
    expect(payload.userId).toBeUndefined();
    expect(payload.organizationId).toBeUndefined();
  });

  it('includes partial context (only userId and route)', () => {
    captureException(new Error('partial2'), {
      userId: 'u-42',
      route: '/dashboard',
    });

    const payload = mockedLogger.error.mock.calls[0][1];
    expect(payload.userId).toBe('u-42');
    expect(payload.route).toBe('/dashboard');
    expect(payload.action).toBeUndefined();
    expect(payload.extra).toBeUndefined();
  });
});

describe('captureMessage', () => {
  it('logs at info level by default', () => {
    captureMessage('hello');
    expect(mockedLogger.info).toHaveBeenCalledTimes(1);
  });

  it('logs at error level for "error" severity', () => {
    captureMessage('critical', 'error');
    expect(mockedLogger.error).toHaveBeenCalledTimes(1);
  });

  it('logs at error level for "fatal" severity', () => {
    captureMessage('fatal crash', 'fatal');
    expect(mockedLogger.error).toHaveBeenCalledTimes(1);
  });

  it('logs at warn level for "warning" severity', () => {
    captureMessage('heads up', 'warning');
    expect(mockedLogger.warn).toHaveBeenCalledTimes(1);
  });

  it('logs at debug level for "debug" severity', () => {
    captureMessage('trace info', 'debug');
    expect(mockedLogger.debug).toHaveBeenCalledTimes(1);
  });

  it('includes context data in the log payload', () => {
    captureMessage('event', 'info', { userId: 'u-5', action: 'upload' });
    const payload = mockedLogger.info.mock.calls[0][1];
    expect(payload.userId).toBe('u-5');
    expect(payload.action).toBe('upload');
    expect(payload.message).toBe('event');
    expect(payload.level).toBe('info');
  });

  it('includes level in payload for all severity levels', () => {
    captureMessage('msg-fatal', 'fatal');
    expect(mockedLogger.error.mock.calls[0][1].level).toBe('fatal');

    captureMessage('msg-error', 'error');
    expect(mockedLogger.error.mock.calls[1][1].level).toBe('error');

    captureMessage('msg-warning', 'warning');
    expect(mockedLogger.warn.mock.calls[0][1].level).toBe('warning');

    captureMessage('msg-debug', 'debug');
    expect(mockedLogger.debug.mock.calls[0][1].level).toBe('debug');

    captureMessage('msg-info', 'info');
    expect(mockedLogger.info.mock.calls[0][1].level).toBe('info');
  });

  it('includes message text in payload for error-level severities', () => {
    captureMessage('fatal message', 'fatal');
    expect(mockedLogger.error.mock.calls[0][1].message).toBe('fatal message');

    captureMessage('error message', 'error');
    expect(mockedLogger.error.mock.calls[1][1].message).toBe('error message');
  });

  it('includes message text in payload for warning severity', () => {
    captureMessage('warn message', 'warning');
    expect(mockedLogger.warn.mock.calls[0][1].message).toBe('warn message');
  });

  it('includes message text in payload for debug severity', () => {
    captureMessage('debug message', 'debug');
    expect(mockedLogger.debug.mock.calls[0][1].message).toBe('debug message');
  });

  it('works without context arg', () => {
    captureMessage('no-context');
    const payload = mockedLogger.info.mock.calls[0][1];
    expect(payload.message).toBe('no-context');
    expect(payload.level).toBe('info');
    expect(payload.userId).toBeUndefined();
  });

  it('passes context with extra data for non-info levels', () => {
    captureMessage('warn-ctx', 'warning', {
      organizationId: 'org-10',
      extra: { detail: 'rate-limit' },
    });

    const payload = mockedLogger.warn.mock.calls[0][1];
    expect(payload.organizationId).toBe('org-10');
    expect(payload.extra).toEqual({ detail: 'rate-limit' });
  });

  it('log label contains captureMessage identifier', () => {
    captureMessage('test-label', 'info');
    const label = mockedLogger.info.mock.calls[0][0];
    expect(label).toContain('captureMessage');
  });

  it('log label contains captureMessage for error level', () => {
    captureMessage('test-label-err', 'error');
    const label = mockedLogger.error.mock.calls[0][0];
    expect(label).toContain('captureMessage');
  });
});
