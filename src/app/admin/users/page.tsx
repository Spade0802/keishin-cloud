'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2 } from 'lucide-react';
import { showToast } from '@/components/ui/toast';
import type { AdminUser } from '@/lib/admin/types';

export default function UsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  async function fetchUsers() {
    try {
      const res = await fetch('/api/admin/users');
      if (!res.ok) throw new Error('取得に失敗しました');
      const data = await res.json();
      setUsers(data.users);
    } catch {
      showToast('ユーザー一覧の取得に失敗しました', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchUsers();
  }, []);

  async function handleRoleChange(userId: string, newRole: 'admin' | 'member') {
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'changeRole', role: newRole }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || 'ロール変更に失敗しました', 'error');
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u)),
      );
      showToast(`ロールを${newRole === 'admin' ? '管理者' : 'メンバー'}に変更しました`, 'success');
    } catch {
      showToast('エラーが発生しました', 'error');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleToggleDisabled(userId: string, currentlyDisabled: boolean) {
    setActionLoading(userId);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId, action: 'toggleDisabled' }),
      });
      if (!res.ok) {
        const data = await res.json();
        showToast(data.error || '状態変更に失敗しました', 'error');
        return;
      }
      const data = await res.json();
      setUsers((prev) =>
        prev.map((u) =>
          u.id === userId ? { ...u, disabledAt: data.disabledAt } : u,
        ),
      );
      showToast(
        currentlyDisabled ? 'ユーザーを有効化しました' : 'ユーザーを無効化しました',
        'success',
      );
    } catch {
      showToast('エラーが発生しました', 'error');
    } finally {
      setActionLoading(null);
    }
  }

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
        <h2 className="text-xl font-bold">ユーザー一覧</h2>
        <Badge variant="secondary">{users.length} ユーザー</Badge>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">名前</th>
                  <th className="pb-2 pr-4 font-medium">メール</th>
                  <th className="pb-2 pr-4 font-medium">所属法人</th>
                  <th className="pb-2 pr-4 font-medium">ロール</th>
                  <th className="pb-2 pr-4 font-medium">状態</th>
                  <th className="pb-2 font-medium">最終ログイン</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => {
                  const isDisabled = !!user.disabledAt;
                  const isLoading = actionLoading === user.id;

                  return (
                    <tr
                      key={user.id}
                      className={`border-b last:border-0 ${isDisabled ? 'opacity-50' : ''}`}
                    >
                      <td className="py-2.5 pr-4 font-medium">{user.name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="py-2.5 pr-4">{user.organizationName}</td>
                      <td className="py-2.5 pr-4">
                        <select
                          value={user.role}
                          onChange={(e) =>
                            handleRoleChange(
                              user.id,
                              e.target.value as 'admin' | 'member',
                            )
                          }
                          disabled={isLoading}
                          className="h-7 text-xs border rounded px-2 bg-background cursor-pointer disabled:cursor-not-allowed"
                        >
                          <option value="member">メンバー</option>
                          <option value="admin">管理者</option>
                        </select>
                      </td>
                      <td className="py-2.5 pr-4">
                        <button
                          type="button"
                          role="switch"
                          aria-checked={!isDisabled}
                          disabled={isLoading}
                          onClick={() => handleToggleDisabled(user.id, isDisabled)}
                          className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed ${
                            !isDisabled ? 'bg-green-500' : 'bg-gray-300'
                          }`}
                        >
                          <span
                            className={`pointer-events-none inline-block h-4 w-4 rounded-full bg-white shadow-lg transition-transform ${
                              !isDisabled ? 'translate-x-4' : 'translate-x-0'
                            }`}
                          />
                        </button>
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString(
                              'ja-JP',
                            )
                          : '-'}
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
