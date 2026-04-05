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
});
