import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, simulations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Calculator,
  FileCheck,
  BarChart3,
  ArrowRight,
  Building2,
  RefreshCw,
  Clock,
} from 'lucide-react';
import { SignOutButton } from '../sign-out-button';
import { SimulationComparison } from './simulation-comparison';

export const metadata: Metadata = {
  title: 'ダッシュボード - 試算履歴',
};

export default async function DashboardHistoryPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.organizationId) {
    redirect('/onboarding');
  }

  // 法人情報を取得
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, session.user.organizationId));

  // 最近のシミュレーション一覧を取得
  const recentSimulations = await db
    .select()
    .from(simulations)
    .where(eq(simulations.organizationId, session.user.organizationId))
    .orderBy(desc(simulations.updatedAt))
    .limit(20);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Welcome Section */}
          <section className="mb-10">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="h-7 w-7 text-primary" />
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    ダッシュボード
                  </h1>
                </div>
                <p className="text-muted-foreground">
                  {org?.name ?? '法人未設定'}
                  {org?.permitNumber && (
                    <span className="ml-2 text-sm">({org.permitNumber})</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {session.user.email}
                </span>
                <SignOutButton />
              </div>
            </div>
          </section>

          {/* Quick Action Cards */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4">クイックアクション</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <QuickActionCard
                href="/trial"
                icon={<Calculator className="h-6 w-6" />}
                title="新規試算"
                description="経審P点をシミュレーション"
                variant="primary"
              />
              <QuickActionCard
                href="/verification"
                icon={<FileCheck className="h-6 w-6" />}
                title="実績突合"
                description="通知書と試算値を比較"
              />
              <QuickActionCard
                href="/comparison"
                icon={<BarChart3 className="h-6 w-6" />}
                title="前期比較表"
                description="前期・当期を比較分析"
              />
              <QuickActionCard
                href="/reclassification"
                icon={<RefreshCw className="h-6 w-6" />}
                title="再分類分析"
                description="会計処理パターン別に比較"
              />
            </div>
          </section>

          {/* Recent Simulations */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                試算履歴
              </h2>
              <Link href="/trial">
                <Button size="sm">
                  <Calculator className="mr-2 h-4 w-4" />
                  新規試算
                </Button>
              </Link>
            </div>

            <SimulationComparison
              simulations={recentSimulations
                .filter((s) => s.resultData !== null)
                .map((s) => ({
                  id: s.id,
                  name: s.name,
                  period: s.period,
                  updatedAt: s.updatedAt.toISOString(),
                  resultData: s.resultData as Record<string, unknown> | null,
                }))}
            />

            {recentSimulations.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <Calculator className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
                  <p className="text-muted-foreground mb-4">
                    まだシミュレーションがありません
                  </p>
                  <Link href="/trial">
                    <Button>
                      最初の試算を始める
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left font-medium px-4 py-3">名前</th>
                        <th className="text-left font-medium px-4 py-3">期間</th>
                        <th className="text-left font-medium px-4 py-3">状態</th>
                        <th className="text-left font-medium px-4 py-3">更新日</th>
                        <th className="text-right font-medium px-4 py-3" />
                      </tr>
                    </thead>
                    <tbody>
                      {recentSimulations.map((sim) => (
                        <tr
                          key={sim.id}
                          className="border-b last:border-0 hover:bg-muted/30 transition-colors"
                        >
                          <td className="px-4 py-3 font-medium">
                            {sim.name}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {sim.period ?? '—'}
                          </td>
                          <td className="px-4 py-3">
                            {sim.resultData ? (
                              <span className="inline-flex items-center rounded-full bg-primary/10 text-primary px-2 py-0.5 text-xs font-medium">
                                完了
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full bg-muted text-muted-foreground px-2 py-0.5 text-xs font-medium">
                                入力中
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {sim.updatedAt.toLocaleDateString('ja-JP')}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <Link href={`/trial/${sim.id}`}>
                              <Button size="sm" variant="ghost">
                                開く
                                <ArrowRight className="ml-1 h-3 w-3" />
                              </Button>
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </section>

          {/* P点算出式 */}
          <section className="mb-6">
            <Card className="bg-muted/40">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">
                  P点算出式
                </p>
                <p className="font-mono text-sm font-medium">
                  P = 0.25 x X1 + 0.15 x X2 + 0.20 x Y + 0.25 x Z + 0.15 x W
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ─── サブコンポーネント ───

function QuickActionCard({
  href,
  icon,
  title,
  description,
  variant,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  variant?: 'primary';
}) {
  return (
    <Link href={href}>
      <Card
        className={`cursor-pointer transition-all hover:shadow-md h-full ${
          variant === 'primary'
            ? 'border-primary/30 bg-primary/5 hover:bg-primary/10'
            : 'hover:border-primary/30'
        }`}
      >
        <CardContent className="pt-5 pb-4">
          <div
            className={`mb-3 ${
              variant === 'primary' ? 'text-primary' : 'text-muted-foreground'
            }`}
          >
            {icon}
          </div>
          <h3 className="font-semibold text-sm mb-1">{title}</h3>
          <p className="text-xs text-muted-foreground">{description}</p>
        </CardContent>
      </Card>
    </Link>
  );
}
