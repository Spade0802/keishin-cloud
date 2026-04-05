'use client';

import { useState, useEffect } from 'react';
import type { PlanConfig } from '@/lib/stripe';

interface SubscriptionState {
  plan: string;
  planConfig: PlanConfig | null;
  subscriptionStatus: string;
  isActive: boolean;
  isPaid: boolean;
  loading: boolean;
  error: string | null;
  bypassed: boolean;
  refresh: () => void;
}

/**
 * サブスクリプション状態を取得するフック
 *
 * bypass モード（テスト/開発）では常にアクティブとして扱う。
 */
export function useSubscription(): SubscriptionState {
  const [data, setData] = useState<{
    plan: string;
    planConfig: PlanConfig | null;
    subscriptionStatus: string;
    bypassed: boolean;
  }>({
    plan: 'free',
    planConfig: null,
    subscriptionStatus: 'none',
    bypassed: false,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function fetchSubscription() {
    setLoading(true);
    fetch('/api/stripe/subscription')
      .then((r) => r.json())
      .then((d) => {
        setData({
          plan: d.plan || 'free',
          planConfig: d.planConfig || null,
          subscriptionStatus: d.subscriptionStatus || 'none',
          bypassed: d.bypassed || false,
        });
        setError(null);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    fetchSubscription();
  }, []);

  const isActive =
    data.bypassed ||
    ['active', 'trialing'].includes(data.subscriptionStatus);

  const isPaid =
    data.bypassed ||
    data.plan !== 'free';

  return {
    ...data,
    isActive,
    isPaid,
    loading,
    error,
    refresh: fetchSubscription,
  };
}
