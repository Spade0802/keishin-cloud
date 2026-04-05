import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Building2, Users, Calculator, Activity, CreditCard, BarChart3, UserPlus } from 'lucide-react';
import { getAdminStats, getSimulations } from '@/lib/admin/data';
import Link from 'next/link';

export default async function AdminDashboardPage() {
  const stats = await getAdminStats();
  const recentSimulations = (await getSimulations()).slice(0, 5);

  const statCards = [
    {
      title: '登録法人数',
      value: stats.totalOrganizations,
      icon: Building2,
      href: '/admin/organizations',
    },
    {
      title: '登録ユーザー数',
      value: stats.totalUsers,
      icon: Users,
      href: '/admin/users',
    },
    {
      title: '有効サブスクリプション',
      value: stats.activeSubscriptions,
      icon: CreditCard,
      href: '/admin/billing',
    },
    {
      title: '今月の試算回数',
      value: stats.monthlySimulations,
      icon: Calculator,
      href: '/admin/simulations',
    },
    {
      title: '累計試算数',
      value: stats.totalSimulations,
      icon: BarChart3,
      href: '/admin/simulations',
    },
    {
      title: 'アクティブユーザー',
      value: stats.recentActiveUsers,
      icon: Activity,
      href: '/admin/users',
    },
    {
      title: '直近7日の新規登録',
      value: stats.recentSignups,
      icon: UserPlus,
      href: '/admin/users',
    },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">ダッシュボード</h2>

      {/* 統計カード */}
      <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Link key={card.title} href={card.href} className="group">
              <Card className="transition-colors group-hover:border-primary/50 group-hover:shadow-md">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-xs sm:text-sm font-medium text-muted-foreground">
                    {card.title}
                  </CardTitle>
                  <Icon className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                </CardHeader>
                <CardContent>
                  <div className="text-xl sm:text-2xl font-bold">{card.value.toLocaleString()}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      {/* 直近の試算履歴 */}
      <Card>
        <CardHeader>
          <CardTitle>直近の試算</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="mb-3 text-xs text-muted-foreground sm:hidden">
            ← 横スクロールで全項目を表示 →
          </p>
          <div className="overflow-x-auto rounded-md border sm:border-0">
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
                      {sim.pScore?.toLocaleString()}
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
