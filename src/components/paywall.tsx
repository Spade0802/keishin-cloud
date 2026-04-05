'use client';

import { useRouter } from 'next/navigation';
import { useSubscription } from '@/lib/hooks/use-subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Lock, ArrowUpRight } from 'lucide-react';

interface PaywallProps {
  /** 必要なプラン ('standard' | 'premium') */
  requiredPlan?: 'standard' | 'premium';
  /** 機能名（表示用） */
  featureName?: string;
  /** 子要素（有料プランなら表示） */
  children: React.ReactNode;
  /** フォールバック（無料プランの場合に表示、指定なければデフォルトカード表示） */
  fallback?: React.ReactNode;
}

/**
 * 有料プランが必要な機能をラップするコンポーネント
 *
 * テストモード/bypass時は常に子要素を表示する。
 */
export function Paywall({
  requiredPlan = 'standard',
  featureName,
  children,
  fallback,
}: PaywallProps) {
  const router = useRouter();
  const { plan, isActive, loading, bypassed } = useSubscription();

  // ローディング中はスケルトン
  if (loading) {
    return <div className="animate-pulse h-20 bg-muted rounded-lg" />;
  }

  // バイパスモードまたはアクティブな有料プラン
  if (bypassed || (isActive && isPlanSufficient(plan, requiredPlan))) {
    return <>{children}</>;
  }

  // フォールバックが指定されている場合
  if (fallback) {
    return <>{fallback}</>;
  }

  // デフォルトのアップグレード促進カード
  return (
    <Card className="border-dashed border-amber-300 bg-amber-50/50">
      <CardContent className="py-6 text-center space-y-3">
        <Lock className="h-8 w-8 mx-auto text-amber-500" />
        <h3 className="font-medium">
          {featureName || 'この機能'}は有料プランで利用できます
        </h3>
        <p className="text-sm text-muted-foreground">
          スタンダードプラン以上にアップグレードして、
          全機能をご活用ください。
        </p>
        <Button
          onClick={() => router.push('/pricing')}
          className="bg-blue-600 hover:bg-blue-700"
        >
          <ArrowUpRight className="mr-1 h-4 w-4" />
          プランを見る
        </Button>
      </CardContent>
    </Card>
  );
}

function isPlanSufficient(current: string, required: string): boolean {
  const order = { free: 0, standard: 1, premium: 2 };
  return (order[current as keyof typeof order] ?? 0) >= (order[required as keyof typeof order] ?? 0);
}
