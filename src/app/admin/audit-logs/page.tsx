'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Search,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Loader2,
  FileText,
} from 'lucide-react';

interface AuditLogEntry {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  organizationId: string | null;
  action: string;
  resource: string | null;
  resourceId: string | null;
  details: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  totalCount: number;
  totalPages: number;
}

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  'simulation.create': { label: '試算作成', color: 'bg-green-100 text-green-700 border-green-200' },
  'simulation.update': { label: '試算更新', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'simulation.delete': { label: '試算削除', color: 'bg-red-100 text-red-700 border-red-200' },
  'scenario.create': { label: 'シナリオ作成', color: 'bg-green-100 text-green-700 border-green-200' },
  'scenario.delete': { label: 'シナリオ削除', color: 'bg-red-100 text-red-700 border-red-200' },
  'organization.create': { label: '法人作成', color: 'bg-green-100 text-green-700 border-green-200' },
  'organization.update': { label: '法人更新', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'organization.delete': { label: '法人削除', color: 'bg-red-100 text-red-700 border-red-200' },
  'plan.change': { label: 'プラン変更', color: 'bg-amber-100 text-amber-700 border-amber-200' },
  'plan.activate': { label: 'プラン有効化', color: 'bg-green-100 text-green-700 border-green-200' },
  'user.login': { label: 'ログイン', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  'user.logout': { label: 'ログアウト', color: 'bg-gray-100 text-gray-600 border-gray-200' },
  'user.create': { label: 'ユーザー作成', color: 'bg-green-100 text-green-700 border-green-200' },
  'user.update': { label: 'ユーザー更新', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'user.delete': { label: 'ユーザー削除', color: 'bg-red-100 text-red-700 border-red-200' },
  'admin.settings.update': { label: '設定変更', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  'admin.billing.update': { label: '課金変更', color: 'bg-purple-100 text-purple-700 border-purple-200' },
  'company.create': { label: '企業作成', color: 'bg-green-100 text-green-700 border-green-200' },
  'company.update': { label: '企業更新', color: 'bg-blue-100 text-blue-700 border-blue-200' },
  'company.delete': { label: '企業削除', color: 'bg-red-100 text-red-700 border-red-200' },
  'fiscal_period.create': { label: '決算期作成', color: 'bg-green-100 text-green-700 border-green-200' },
  'fiscal_period.update': { label: '決算期更新', color: 'bg-blue-100 text-blue-700 border-blue-200' },
};

export default function AdminAuditLogsPage() {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [pagination, setPagination] = useState<Pagination | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('');
  const [userIdFilter, setUserIdFilter] = useState('');
  const [orgIdFilter, setOrgIdFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('page', page.toString());
      if (actionFilter) params.set('action', actionFilter);
      if (userIdFilter) params.set('userId', userIdFilter);
      if (orgIdFilter) params.set('organizationId', orgIdFilter);
      if (dateFrom) params.set('from', dateFrom);
      if (dateTo) params.set('to', dateTo);

      const res = await fetch(`/api/admin/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.logs || []);
        setPagination(data.pagination || null);
      }
    } catch (e) {
      console.error('Failed to fetch audit logs:', e);
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, userIdFilter, orgIdFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  function handleActionFilterChange(value: string) {
    setActionFilter(value);
    setPage(1);
  }

  function getActionDisplay(action: string) {
    const config = ACTION_LABELS[action];
    if (config) {
      return <Badge className={`${config.color} font-normal text-xs`}>{config.label}</Badge>;
    }
    return <Badge variant="outline" className="font-normal text-xs">{action}</Badge>;
  }

  // アクションタイプの一覧 (フィルター用)
  const actionOptions = Object.entries(ACTION_LABELS).map(([value, { label }]) => ({
    value,
    label,
  }));

  if (loading && logs.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-muted-foreground" />
          <h2 className="text-xl font-bold">監査ログ</h2>
        </div>
        <Button variant="outline" size="sm" onClick={fetchData} disabled={loading}>
          <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
          更新
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>操作履歴</CardTitle>
          <CardDescription>
            システム内の全操作ログを確認できます。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* フィルター */}
          <div className="mb-4 space-y-2">
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <select
                  value={actionFilter}
                  onChange={(e) => handleActionFilterChange(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 text-sm border rounded-md bg-background"
                >
                  <option value="">全てのアクション</option>
                  {actionOptions.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>
              <Input
                placeholder="ユーザーID"
                value={userIdFilter}
                onChange={(e) => { setUserIdFilter(e.target.value); setPage(1); }}
                className="sm:w-48 text-sm"
              />
              <Input
                placeholder="組織ID"
                value={orgIdFilter}
                onChange={(e) => { setOrgIdFilter(e.target.value); setPage(1); }}
                className="sm:w-48 text-sm"
              />
            </div>
            <div className="flex flex-col sm:flex-row gap-2 items-center">
              <label className="text-xs text-muted-foreground whitespace-nowrap">期間:</label>
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => { setDateFrom(e.target.value); setPage(1); }}
                className="sm:w-44 text-sm"
              />
              <span className="text-xs text-muted-foreground">〜</span>
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => { setDateTo(e.target.value); setPage(1); }}
                className="sm:w-44 text-sm"
              />
            </div>
          </div>

          {/* テーブル */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">日時</th>
                  <th className="pb-2 pr-4 font-medium">ユーザー</th>
                  <th className="pb-2 pr-4 font-medium">アクション</th>
                  <th className="pb-2 pr-4 font-medium">リソース</th>
                  <th className="pb-2 font-medium">詳細</th>
                </tr>
              </thead>
              <tbody>
                {logs.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-muted-foreground">
                      監査ログがありません
                    </td>
                  </tr>
                )}
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0">
                    <td className="py-3 pr-4 whitespace-nowrap text-xs">
                      {new Date(log.createdAt).toLocaleString('ja-JP', {
                        year: 'numeric',
                        month: '2-digit',
                        day: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                      })}
                    </td>
                    <td className="py-3 pr-4">
                      <div>
                        <div className="font-medium text-xs">
                          {log.userName || 'システム'}
                        </div>
                        {log.userEmail && (
                          <div className="text-xs text-muted-foreground">
                            {log.userEmail}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {getActionDisplay(log.action)}
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      {log.resource && (
                        <span className="text-muted-foreground">
                          {log.resource}
                          {log.resourceId && (
                            <code className="ml-1 bg-muted px-1 py-0.5 rounded text-[10px]">
                              {log.resourceId.slice(0, 8)}...
                            </code>
                          )}
                        </span>
                      )}
                      {!log.resource && (
                        <span className="text-muted-foreground">-</span>
                      )}
                    </td>
                    <td className="py-3 text-xs">
                      {log.details ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 text-xs px-2"
                          onClick={() =>
                            setExpandedId(expandedId === log.id ? null : log.id)
                          }
                        >
                          {expandedId === log.id ? '閉じる' : '表示'}
                        </Button>
                      ) : (
                        <span className="text-muted-foreground">-</span>
                      )}
                      {expandedId === log.id && log.details && (
                        <pre className="mt-2 p-2 bg-muted rounded text-[10px] max-w-xs overflow-auto whitespace-pre-wrap">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* ページネーション */}
          {pagination && pagination.totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-xs text-muted-foreground">
                全 {pagination.totalCount} 件中 {(pagination.page - 1) * pagination.limit + 1}-
                {Math.min(pagination.page * pagination.limit, pagination.totalCount)} 件
              </div>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={page <= 1}
                  onClick={() => setPage(page - 1)}
                >
                  <ChevronLeft className="h-3 w-3" />
                </Button>
                <span className="text-xs px-2">
                  {page} / {pagination.totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7"
                  disabled={page >= pagination.totalPages}
                  onClick={() => setPage(page + 1)}
                >
                  <ChevronRight className="h-3 w-3" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
