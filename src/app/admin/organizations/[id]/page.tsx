import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import {
  getOrganization,
  getUsersByOrganization,
  getSimulationsByOrganization,
} from '@/lib/admin/data';

export default async function OrganizationDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const org = await getOrganization(id);

  if (!org) {
    notFound();
  }

  const members = await getUsersByOrganization(org.name);
  const simulations = await getSimulationsByOrganization(org.name);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/organizations">
          <Button variant="ghost" size="icon-sm">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h2 className="text-xl font-bold">{org.name}</h2>
          <p className="text-sm text-muted-foreground">{org.permitNumber}</p>
        </div>
      </div>

      {/* サマリカード */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-muted-foreground">登録日</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="font-medium">
              {new Date(org.registeredAt).toLocaleDateString('ja-JP')}
            </p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-muted-foreground">
              メンバー数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{members.length}</p>
          </CardContent>
        </Card>
        <Card size="sm">
          <CardHeader>
            <CardTitle className="text-muted-foreground">試算回数</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{org.simulationCount}</p>
          </CardContent>
        </Card>
      </div>

      {/* メンバー一覧 */}
      <Card>
        <CardHeader>
          <CardTitle>メンバー一覧</CardTitle>
        </CardHeader>
        <CardContent>
          {members.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              メンバーがいません。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">名前</th>
                    <th className="pb-2 pr-4 font-medium">メール</th>
                    <th className="pb-2 pr-4 font-medium">ロール</th>
                    <th className="pb-2 font-medium">最終ログイン</th>
                  </tr>
                </thead>
                <tbody>
                  {members.map((user) => (
                    <tr key={user.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 font-medium">{user.name}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {user.email}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge
                          variant={
                            user.role === 'admin' ? 'default' : 'secondary'
                          }
                        >
                          {user.role === 'admin' ? '管理者' : 'メンバー'}
                        </Badge>
                      </td>
                      <td className="py-2.5 whitespace-nowrap">
                        {user.lastLoginAt
                          ? new Date(user.lastLoginAt).toLocaleDateString(
                              'ja-JP',
                            )
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 試算履歴 */}
      <Card>
        <CardHeader>
          <CardTitle>試算履歴</CardTitle>
        </CardHeader>
        <CardContent>
          {simulations.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              試算履歴がありません。
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-muted-foreground">
                    <th className="pb-2 pr-4 font-medium">日時</th>
                    <th className="pb-2 pr-4 font-medium">期</th>
                    <th className="pb-2 pr-4 font-medium">主力業種</th>
                    <th className="pb-2 font-medium text-right">P点</th>
                  </tr>
                </thead>
                <tbody>
                  {simulations.map((sim) => (
                    <tr key={sim.id} className="border-b last:border-0">
                      <td className="py-2.5 pr-4 whitespace-nowrap">
                        {new Date(sim.createdAt).toLocaleDateString('ja-JP')}
                      </td>
                      <td className="py-2.5 pr-4">{sim.fiscalYear}</td>
                      <td className="py-2.5 pr-4">{sim.mainIndustry}</td>
                      <td className="py-2.5 text-right font-mono font-medium">
                        {sim.pScore}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
