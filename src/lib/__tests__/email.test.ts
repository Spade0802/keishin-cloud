import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock the logger so tests don't produce console output
vi.mock('@/lib/logger', () => ({
  logger: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

import {
  sendWelcomeEmail,
  sendTrialExpiringEmail,
  sendSubscriptionConfirmEmail,
} from '../email';
import { logger } from '@/lib/logger';

const mockedLogger = logger as unknown as {
  info: ReturnType<typeof vi.fn>;
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('sendWelcomeEmail', () => {
  it('does not throw and logs the call', async () => {
    await expect(
      sendWelcomeEmail({ to: 'a@b.com', name: 'Alice' }),
    ).resolves.toBeUndefined();

    expect(mockedLogger.info).toHaveBeenCalledTimes(1);
    const [label, payload] = mockedLogger.info.mock.calls[0];
    expect(label).toContain('sendWelcomeEmail');
    expect(payload.to).toBe('a@b.com');
    expect(payload.name).toBe('Alice');
  });

  it('passes organizationName when provided', async () => {
    await sendWelcomeEmail({
      to: 'a@b.com',
      name: 'Bob',
      organizationName: 'Acme',
    });

    const payload = mockedLogger.info.mock.calls[0][1];
    expect(payload.organizationName).toBe('Acme');
  });

  it('logs organizationName as undefined when omitted', async () => {
    await sendWelcomeEmail({ to: 'a@b.com', name: 'Alice' });

    const payload = mockedLogger.info.mock.calls[0][1];
    expect(payload.organizationName).toBeUndefined();
  });

  it('handles empty string name and email', async () => {
    await expect(
      sendWelcomeEmail({ to: '', name: '' }),
    ).resolves.toBeUndefined();

    const payload = mockedLogger.info.mock.calls[0][1];
    expect(payload.to).toBe('');
    expect(payload.name).toBe('');
  });
});

describe('sendTrialExpiringEmail', () => {
  it('does not throw with valid parameters', async () => {
    const trialEndsAt = new Date('2026-05-01T00:00:00Z');
    await expect(
      sendTrialExpiringEmail({
        to: 'c@d.com',
        name: 'Carol',
        trialEndsAt,
        daysRemaining: 3,
        upgradeUrl: 'https://example.com/upgrade',
      }),
    ).resolves.toBeUndefined();

    const payload = mockedLogger.info.mock.calls[0][1];
    expect(payload.daysRemaining).toBe(3);
    expect(payload.trialEndsAt).toBe(trialEndsAt.toISOString());
  });

  it('handles 0 days remaining', async () => {
    await sendTrialExpiringEmail({
      to: 'x@y.com',
      name: 'Dave',
      trialEndsAt: new Date(),
      daysRemaining: 0,
      upgradeUrl: 'https://example.com/upgrade',
    });

    const payload = mockedLogger.info.mock.calls[0][1];
    expect(payload.daysRemaining).toBe(0);
  });

  it('handles negative daysRemaining', async () => {
    await expect(
      sendTrialExpiringEmail({
        to: 'x@y.com',
        name: 'Dave',
        trialEndsAt: new Date('2026-03-01T00:00:00Z'),
        daysRemaining: -5,
        upgradeUrl: 'https://example.com/upgrade',
      }),
    ).resolves.toBeUndefined();

    const payload = mockedLogger.info.mock.calls[0][1];
    expect(payload.daysRemaining).toBe(-5);
  });

  it('does not log upgradeUrl in the payload', async () => {
    await sendTrialExpiringEmail({
      to: 'c@d.com',
      name: 'Carol',
      trialEndsAt: new Date('2026-05-01T00:00:00Z'),
      daysRemaining: 3,
      upgradeUrl: 'https://example.com/upgrade',
    });

    const payload = mockedLogger.info.mock.calls[0][1];
    // upgradeUrl is accepted as input but not included in the log payload
    expect(payload).not.toHaveProperty('upgradeUrl');
  });
});

describe('sendSubscriptionConfirmEmail', () => {
  it('does not throw and logs plan info', async () => {
    await expect(
      sendSubscriptionConfirmEmail({
        to: 'e@f.com',
        name: 'Eve',
        plan: 'pro',
        amount: 2980,
        nextBillingDate: new Date('2026-05-06T00:00:00Z'),
      }),
    ).resolves.toBeUndefined();

    const payload = mockedLogger.info.mock.calls[0][1];
    expect(payload.plan).toBe('pro');
    expect(payload.amount).toBe(2980);
    expect(payload.nextBillingDate).toBe('2026-05-06T00:00:00.000Z');
  });

  it('handles optional fields being omitted', async () => {
    await sendSubscriptionConfirmEmail({
      to: 'g@h.com',
      name: 'Grace',
      plan: 'free',
    });

    const payload = mockedLogger.info.mock.calls[0][1];
    expect(payload.plan).toBe('free');
    expect(payload.amount).toBeUndefined();
    expect(payload.nextBillingDate).toBeUndefined();
  });

  it('handles amount of 0', async () => {
    await sendSubscriptionConfirmEmail({
      to: 'g@h.com',
      name: 'Grace',
      plan: 'free',
      amount: 0,
    });

    const payload = mockedLogger.info.mock.calls[0][1];
    expect(payload.amount).toBe(0);
  });

  it('logs the correct label', async () => {
    await sendSubscriptionConfirmEmail({
      to: 'a@b.com',
      name: 'Test',
      plan: 'pro',
    });

    const label = mockedLogger.info.mock.calls[0][0];
    expect(label).toContain('sendSubscriptionConfirmEmail');
  });
});

// ---------------------------------------------------------------------------
// Cross-cutting concerns
// ---------------------------------------------------------------------------

describe('logger isolation between calls', () => {
  it('each function call logs exactly once', async () => {
    await sendWelcomeEmail({ to: 'a@b.com', name: 'A' });
    await sendTrialExpiringEmail({
      to: 'b@c.com',
      name: 'B',
      trialEndsAt: new Date(),
      daysRemaining: 7,
      upgradeUrl: 'https://example.com/upgrade',
    });
    await sendSubscriptionConfirmEmail({
      to: 'c@d.com',
      name: 'C',
      plan: 'pro',
    });

    expect(mockedLogger.info).toHaveBeenCalledTimes(3);

    const labels = mockedLogger.info.mock.calls.map(
      (call: unknown[]) => call[0] as string,
    );
    expect(labels[0]).toContain('sendWelcomeEmail');
    expect(labels[1]).toContain('sendTrialExpiringEmail');
    expect(labels[2]).toContain('sendSubscriptionConfirmEmail');
  });
});
