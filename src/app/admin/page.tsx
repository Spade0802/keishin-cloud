import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Building2, Users, Calculator, Activity } from 'lucide-react';
import { getAdminStats, getSimulations } from '@/lib/admin/data';

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();
  const recentSimulations = (await getSimulations()).slice(0, 5);

  const statCards = [
    {
      title: '登録法人数',
      value: stats.totalOrganizations,
      icon: Building2,
    },
    {
      title: '登録ユーザー数',
      value: stats.totalUsers,
      icon: Users,
    },
    {
      title: '今月の試算回数',
      value: stats.monthlySimulations,
      icon: Calculator,
    },
    {
      title: 'アクティブユーザー',
      value: stats.recentActiveUsers,
      icon: Activity,
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">ダッシュボード</h2>

      {/* 統計カード */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.title}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {card.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{card.value}</div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* 直近の試算履歴 */}
      <Card>
        <CardHeader>
          <CardTitle>直近の試算</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-2 pr-4 font-medium">日時</th>
                  <th className="pb-2 pr-4 font-medium">法人名</th>
                  <th className="pb-2 pr-4 font-medium">業種</th>
                  <th className="pb-2 font-medium text-right">P点</th>
                </tr>
              </thead>
              <tbody>
                {recentSimulations.map((sim) => (
                  <tr key={sim.id} className="border-b last:border-0">
                    <td className="py-2.5 pr-4 whitespace-nowrap">
                      {new Date(sim.createdAt).toLocaleDateString('ja-JP')}
                    </td>
                    <td className="py-2.5 pr-4">{sim.organizationName}</td>
                    <td className="py-2.5 pr-4">{sim.mainIndustry}</td>
                    <td className="py-2.5 text-right font-mono font-medium">
                      {sim.pScore}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
