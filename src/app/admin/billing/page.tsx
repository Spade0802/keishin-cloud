'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  CreditCard,
  Search,
  CheckCircle,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Users,
  Building2,
  TrendingUp,
  Loader2,
} from 'lucide-react';
import { showToast } from '@/components/ui/toast';

interface OrgBillingInfo {
  id: string;
  name: string;
  permitNumber: string | null;
  plan: string;
  subscriptionStatus: string;
  stripeCustomerId: string | null;
  stripeSubscriptionId: string | null;
  currentPeriodEnd: string | null;
  trialEndsAt: string | null;
  userCount: number;
  createdAt: string;
}

interface BillingStats {
  totalOrgs: number;
  paidOrgs: number;
  trialingOrgs: number;
  freeOrgs: number;
  mrr: number;
  bypassed: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle }> = {
  active: { label: '有効', color: 'bg-green-100 text-green-700 border-green-200', icon: CheckCircle },
  trialing: { label: 'トライアル', color: 'bg-blue-100 text-blue-700 border-blue-200', icon: CheckCircle },
  past_due: { label: '支払い遅延', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  canceled: { label: '解約済み', color: 'bg-gray-100 text-gray-600 border-gray-200', icon: XCircle },
  unpaid: { label: '未払い', color: 'bg-red-100 text-red-700 border-red-200', icon: AlertTriangle },
  incomplete: { label: '未完了', color: 'bg-amber-100 text-amber-700 border-amber-200', icon: AlertTriangle },
  none: { label: '無料', color: 'bg-gray-100 text-gray-500 border-gray-200', icon: XCircle },
};

const PLAN_LABELS: Record<string, string> = {
  free: '無料',
  standard: 'スタンダード',
  premium: 'プレミアム',
};

export default function AdminBillingPage() {
  const [orgs, setOrgs] = useState<OrgBillingInfo[]>([]);
  const [stats, setStats] = useState<BillingStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchData() {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/billing');
      if (res.ok) {
        const data = await res.json();
        setOrgs(data.organizations || []);
        setStats(data.stats || null);
      }
    } catch (e) {
      console.error('Failed to fetch billing data:', e);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  async function handleChangePlan(orgId: string, newPlan: string) {
    setActionLoading(orgId);
    try {
      const res = await fetch('/api/admin/billing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ organizationId: orgId, plan: newPlan, action: 'change_plan' }),
      });
      if (res.ok) {
        await fetchData();
      } else {
        const data = await res.json();
        showToast(data.error || '更新に失敗しました', 'error');
      }
    } catch {
      showToast('エラーが発生しました', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleActivate(orgId: string) {
    setActionLoading(orgId);
    try {
      const res = await fetch('/api/admin/billing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: orgId,
          action: 'activate',
          plan: 'standard',
        }),
      });
      if (res.ok) {
        await fetchData();
      }
    } catch {
      showToast('エラーが発生しました', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  const filtered = orgs.filter(
    (o) =>
      o.name.toLowerCase().includes(search.toLowerCase()) ||
      (o.permitNumber || '').includes(search) ||
      (o.stripeCustomerId || '').includes(search)
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">課金管理</h2>
        <Button variant="outline" size="sm" onClick={fetchData}>
          <RefreshCw className="h-3 w-3 mr-1" />
          更新
        </Button>
      </div>

      {stats?.bypassed && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-center gap-2">
          <AlertTriangle className="h-5 w-5 text-amber-600" />
          <div className="text-sm text-amber-800">
            <strong>課金バイパスモード</strong>: 全法人が全機能を無料で利用できます。
            本番運用時は設定 &gt; 課金(Stripe) でOFFにしてください。
          </div>
        </div>
      )}

      {/* 統計カード */}
      {stats && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">法人数</CardTitle>
              <Building2 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalOrgs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">有料契約</CardTitle>
              <CreditCard className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{stats.paidOrgs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">トライアル中</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">{stats.trialingOrgs}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">MRR (月間売上)</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats.bypassed ? '-' : `¥${stats.mrr.toLocaleString()}`}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* 法人一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>法人別サブスクリプション</CardTitle>
          <CardDescription>
            各法人のプランとサブスクリプション状態を管理します。
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="法人名・許可番号で検索..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">法人名</th>
                  <th className="pb-2 pr-4 font-medium">プラン</th>
                  <th className="pb-2 pr-4 font-medium">ステータス</th>
                  <th className="pb-2 pr-4 font-medium">更新日</th>
                  <th className="pb-2 pr-4 font-medium">Stripe ID</th>
                  <th className="pb-2 font-medium text-right">操作</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-muted-foreground">
                      {search ? '検索条件に一致する法人がありません' : '登録された法人がありません'}
                    </td>
                  </tr>
                )}
                {filtered.map((org) => {
                  const statusCfg = STATUS_CONFIG[org.subscriptionStatus] || STATUS_CONFIG.none;
                  const StatusIcon = statusCfg.icon;

                  return (
                    <tr key={org.id} className="border-b last:border-0">
                      <td className="py-3 pr-4">
                        <div>
                          <div className="font-medium">{org.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {org.permitNumber || '許可番号なし'}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge variant="outline" className="font-normal">
                          {PLAN_LABELS[org.plan] || org.plan}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4">
                        <Badge className={`${statusCfg.color} font-normal gap-1`}>
                          <StatusIcon className="h-3 w-3" />
                          {statusCfg.label}
                        </Badge>
                      </td>
                      <td className="py-3 pr-4 whitespace-nowrap text-xs">
                        {org.currentPeriodEnd
                          ? new Date(org.currentPeriodEnd).toLocaleDateString('ja-JP')
                          : '-'}
                      </td>
                      <td className="py-3 pr-4">
                        {org.stripeCustomerId ? (
                          <code className="text-xs bg-muted px-1.5 py-0.5 rounded">
                            {org.stripeCustomerId.slice(0, 12)}...
                          </code>
                        ) : (
                          <span className="text-xs text-muted-foreground">-</span>
                        )}
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {org.plan === 'free' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleActivate(org.id)}
                              disabled={actionLoading === org.id}
                              className="text-xs h-7"
                            >
                              {actionLoading === org.id ? (
                                <Loader2 className="h-3 w-3 animate-spin" />
                              ) : (
                                'アクティベート'
                              )}
                            </Button>
                          )}
                          {org.plan === 'standard' && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleChangePlan(org.id, 'premium')}
                              disabled={actionLoading === org.id}
                              className="text-xs h-7"
                            >
                              プレミアムへ
                            </Button>
                          )}
                          {org.plan !== 'free' && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleChangePlan(org.id, 'free')}
                              disabled={actionLoading === org.id}
                              className="text-xs h-7 text-destructive"
                            >
                              無料に戻す
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
