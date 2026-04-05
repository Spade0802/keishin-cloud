// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useSubscription } from '../use-subscription';

// ---------------------------------------------------------------------------
// fetch mock
// ---------------------------------------------------------------------------

const originalFetch = globalThis.fetch;

function mockFetchSuccess(data: Record<string, unknown>) {
  globalThis.fetch = vi.fn().mockResolvedValue({
    json: () => Promise.resolve(data),
  });
}

function mockFetchError(message: string) {
  globalThis.fetch = vi.fn().mockRejectedValue(new Error(message));
}

afterEach(() => {
  globalThis.fetch = originalFetch;
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('useSubscription', () => {
  describe('loading state', () => {
    it('starts in loading state', () => {
      // Never-resolving fetch to keep it in loading state
      globalThis.fetch = vi.fn().mockReturnValue(new Promise(() => {}));

      const { result } = renderHook(() => useSubscription());

      expect(result.current.loading).toBe(true);
      expect(result.current.plan).toBe('free');
      expect(result.current.planConfig).toBeNull();
      expect(result.current.subscriptionStatus).toBe('none');
      expect(result.current.error).toBeNull();
      expect(result.current.bypassed).toBe(false);
    });

    it('sets loading to false after fetch completes', async () => {
      mockFetchSuccess({
        plan: 'standard',
        planConfig: { id: 'standard', name: 'Standard' },
        subscriptionStatus: 'active',
        bypassed: false,
      });

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe('fetched subscription data', () => {
    it('populates plan data from API response', async () => {
      const planConfig = {
        id: 'standard',
        name: 'Standard',
        nameJa: 'スタンダード',
        priceMonthly: 9800,
      };

      mockFetchSuccess({
        plan: 'standard',
        planConfig,
        subscriptionStatus: 'active',
        bypassed: false,
      });

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.plan).toBe('standard');
      expect(result.current.planConfig).toEqual(planConfig);
      expect(result.current.subscriptionStatus).toBe('active');
      expect(result.current.bypassed).toBe(false);
    });

    it('isActive is true for active subscriptions', async () => {
      mockFetchSuccess({
        plan: 'standard',
        subscriptionStatus: 'active',
      });

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isActive).toBe(true);
    });

    it('isActive is true for trialing subscriptions', async () => {
      mockFetchSuccess({
        plan: 'standard',
        subscriptionStatus: 'trialing',
      });

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isActive).toBe(true);
    });

    it('isActive is false for canceled subscriptions', async () => {
      mockFetchSuccess({
        plan: 'standard',
        subscriptionStatus: 'canceled',
        bypassed: false,
      });

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isActive).toBe(false);
    });

    it('isPaid is true for non-free plans', async () => {
      mockFetchSuccess({
        plan: 'standard',
        subscriptionStatus: 'active',
      });

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isPaid).toBe(true);
    });

    it('isPaid is false for free plan', async () => {
      mockFetchSuccess({
        plan: 'free',
        subscriptionStatus: 'none',
        bypassed: false,
      });

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isPaid).toBe(false);
    });

    it('defaults to free plan when API returns no plan', async () => {
      mockFetchSuccess({});

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.plan).toBe('free');
      expect(result.current.subscriptionStatus).toBe('none');
    });
  });

  describe('error handling', () => {
    it('sets error message on fetch failure', async () => {
      mockFetchError('Network error');

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.error).toBe('Network error');
    });

    it('preserves default data on error', async () => {
      mockFetchError('Server error');

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      // Data should remain at defaults since no successful fetch occurred
      expect(result.current.plan).toBe('free');
      expect(result.current.planConfig).toBeNull();
      expect(result.current.subscriptionStatus).toBe('none');
    });

    it('clears error on successful refresh', async () => {
      mockFetchError('Temporary error');

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.error).toBe('Temporary error');
      });

      // Now mock a successful response and refresh
      mockFetchSuccess({
        plan: 'standard',
        subscriptionStatus: 'active',
      });

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.error).toBeNull();
      });

      expect(result.current.plan).toBe('standard');
    });
  });

  describe('bypass mode', () => {
    it('isActive is true when bypassed regardless of status', async () => {
      mockFetchSuccess({
        plan: 'free',
        subscriptionStatus: 'none',
        bypassed: true,
      });

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.bypassed).toBe(true);
      expect(result.current.isActive).toBe(true);
    });

    it('isPaid is true when bypassed regardless of plan', async () => {
      mockFetchSuccess({
        plan: 'free',
        subscriptionStatus: 'none',
        bypassed: true,
      });

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.isPaid).toBe(true);
    });
  });

  describe('refresh', () => {
    it('re-fetches subscription data', async () => {
      mockFetchSuccess({
        plan: 'free',
        subscriptionStatus: 'none',
      });

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(result.current.plan).toBe('free');

      // Update mock and refresh
      mockFetchSuccess({
        plan: 'premium',
        subscriptionStatus: 'active',
      });

      act(() => {
        result.current.refresh();
      });

      await waitFor(() => {
        expect(result.current.plan).toBe('premium');
      });

      expect(result.current.isActive).toBe(true);
      // fetch should have been called twice: initial + refresh
      expect(globalThis.fetch).toHaveBeenCalledTimes(1); // only the latest mock counts
    });

    it('calls /api/stripe/subscription endpoint', async () => {
      mockFetchSuccess({ plan: 'free' });

      const { result } = renderHook(() => useSubscription());

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
      });

      expect(globalThis.fetch).toHaveBeenCalledWith('/api/stripe/subscription');
    });
  });
});
