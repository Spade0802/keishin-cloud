'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  CreditCard,
  CheckCircle,
  AlertTriangle,
  ExternalLink,
  ArrowUpRight,
  Shield,
} from 'lucide-react';
import { showToast } from '@/components/ui/toast';

interface SubscriptionInfo {
  plan: string;
  planConfig: {
    nameJa: string;
    description: string;
    priceYearly: number;
    priceMonthly: number;
    features: string[];
  };
  subscriptionStatus: string;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  hasStripeCustomer: boolean;
  hasSubscription: boolean;
  bypassed?: boolean;
}

const STATUS_MAP: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  active: { label: '有効', color: 'bg-green-100 text-green-700', icon: CheckCircle },
  trialing: { label: 'トライアル中', color: 'bg-blue-100 text-blue-700', icon: CheckCircle },
  past_due: { label: '支払い遅延', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  canceled: { label: '解約済み', color: 'bg-gray-100 text-gray-600', icon: AlertTriangle },
  unpaid: { label: '未払い', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
  incomplete: { label: '決済未完了', color: 'bg-amber-100 text-amber-700', icon: AlertTriangle },
  none: { label: '未契約', color: 'bg-gray-100 text-gray-600', icon: AlertTriangle },
};

export default function BillingPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const success = searchParams.get('success') === 'true';
  const [sub, setSub] = useState<SubscriptionInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    fetch('/api/stripe/subscription')
      .then((r) => r.json())
      .then(setSub)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  async function openPortal() {
    setPortalLoading(true);
    try {
      const res = await fetch('/api/stripe/create-portal-session', { method: 'POST' });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.bypassed) {
        showToast('テストモード: Stripeポータルは利用できません', 'warning');
      }
    } catch {
      showToast('エラーが発生しました', 'error');
    } finally {
      setPortalLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
        読み込み中...
      </div>
    );
  }

  if (!sub) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-muted-foreground">
        情報を取得できませんでした
      </div>
    );
  }

  const statusInfo = STATUS_MAP[sub.subscriptionStatus] || STATUS_MAP.none;
  const StatusIcon = statusInfo.icon;

  return (
    <div className="max-w-2xl mx-auto px-4 py-10">
      <h1 className="text-2xl font-bold mb-6">プランと請求</h1>

      {success && (
        <div className="mb-6 rounded-lg border border-green-200 bg-green-50 p-4 flex items-center gap-2">
          <CheckCircle className="h-5 w-5 text-green-600" />
          <span className="text-sm text-green-800">
            サブスクリプションが正常に開始されました。
          </span>
        </div>
      )}

      {sub.bypassed && (
        <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center gap-2">
          <Shield className="h-5 w-5 text-amber-600" />
          <span className="text-sm text-amber-800">
            テストモード: 課金機能がバイパスされています。全機能が利用可能です。
          </span>
        </div>
      )}

      {/* Current Plan */}
      <Card className="mb-6">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">現在のプラン</CardTitle>
            <Badge className={statusInfo.color}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {statusInfo.label}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-baseline justify-between">
            <div>
              <h3 className="text-xl font-bold">{sub.planConfig.nameJa}</h3>
              <p className="text-sm text-muted-foreground">{sub.planConfig.description}</p>
            </div>
            {sub.planConfig.priceYearly > 0 && (
              <div className="text-right">
                <span className="text-2xl font-bold">
                  {Math.floor(sub.planConfig.priceYearly / 12).toLocaleString()}
                </span>
                <span className="text-sm text-muted-foreground">円/月</span>
              </div>
            )}
          </div>

          {sub.currentPeriodEnd && (
            <p className="text-sm text-muted-foreground">
              次回更新日: {new Date(sub.currentPeriodEnd).toLocaleDateString('ja-JP')}
            </p>
          )}

          {sub.trialEndsAt && (
            <p className="text-sm text-blue-600">
              トライアル終了: {new Date(sub.trialEndsAt).toLocaleDateString('ja-JP')}
            </p>
          )}

          <Separator />

          <div className="text-sm space-y-1">
            <p className="font-medium mb-2">利用可能な機能:</p>
            {sub.planConfig.features.map((f, i) => (
              <div key={i} className="flex items-center gap-2 text-muted-foreground">
                <CheckCircle className="h-3 w-3 text-green-500" />
                {f}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="space-y-3">
        {sub.plan === 'free' && (
          <Button
            onClick={() => router.push('/pricing')}
            className="w-full bg-blue-600 hover:bg-blue-700"
          >
            <ArrowUpRight className="mr-2 h-4 w-4" />
            有料プランにアップグレード
          </Button>
        )}

        {sub.hasSubscription && !sub.bypassed && (
          <Button
            onClick={openPortal}
            disabled={portalLoading}
            variant="outline"
            className="w-full"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            {portalLoading ? '読み込み中...' : 'サブスクリプション管理'}
            <ExternalLink className="ml-auto h-3 w-3" />
          </Button>
        )}

        <Button
          onClick={() => router.push('/dashboard')}
          variant="ghost"
          className="w-full"
        >
          ダッシュボードに戻る
        </Button>
      </div>

      {/* Stripe badge */}
      <div className="mt-8 text-center text-xs text-muted-foreground">
        <div className="flex items-center justify-center gap-1">
          <Shield className="h-3 w-3" />
          決済はStripeによって安全に処理されます
        </div>
      </div>
    </div>
  );
}
