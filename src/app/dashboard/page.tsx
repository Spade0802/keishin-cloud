import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations, simulations } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Calculator,
  TrendingUp,
  ArrowRight,
  Building2,
  ClipboardCheck,
  GitCompareArrows,
  Repeat2,
  Info,
} from 'lucide-react';
import { SignOutButton } from './sign-out-button';

export const metadata: Metadata = {
  title: 'ダッシュボード',
};

export default async function DashboardPage() {
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

  // 法人のシミュレーション一覧を取得
  const recentSimulations = await db
    .select()
    .from(simulations)
    .where(eq(simulations.organizationId, session.user.organizationId))
    .orderBy(desc(simulations.updatedAt))
    .limit(10);

  const hasSimulations = recentSimulations.length > 0;

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Welcome Section */}
          <section className="mb-8">
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
            <h2 className="text-lg font-semibold mb-4">試算・分析</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Link href="/trial">
                <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Calculator className="h-5 w-5 text-primary" />
                      新規試算
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      決算書＋提出書からP点を試算
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      開始する
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/verification">
                <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <ClipboardCheck className="h-5 w-5 text-primary" />
                      実績突合
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      通知書の実績と試算値を比較
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      開始する
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/comparison">
                <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <GitCompareArrows className="h-5 w-5 text-primary" />
                      前期比較表
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      前期と当期のP点を比較分析
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      開始する
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>

              <Link href="/reclassification">
                <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 h-full">
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base">
                      <Repeat2 className="h-5 w-5 text-primary" />
                      再分類分析
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      会計処理パターンのP点比較
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      開始する
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>
            </div>
          </section>

          {/* Simulations List */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">最近の試算結果</h2>
              {hasSimulations && (
                <Badge variant="outline" className="text-muted-foreground">
                  {recentSimulations.length}件
                </Badge>
              )}
            </div>

            {hasSimulations ? (
              <Card>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b text-left text-muted-foreground">
                        <th className="px-4 py-3 font-medium">日付</th>
                        <th className="px-4 py-3 font-medium">名称</th>
                        <th className="px-4 py-3 font-medium">期間</th>
                        <th className="px-4 py-3 font-medium">ステータス</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentSimulations.map((sim) => (
                        <tr
                          key={sim.id}
                          className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                        >
                          <td className="px-4 py-3">
                            {sim.createdAt
                              ? new Date(sim.createdAt).toLocaleDateString(
                                  'ja-JP'
                                )
                              : '-'}
                          </td>
                          <td className="px-4 py-3 font-medium">{sim.name}</td>
                          <td className="px-4 py-3">
                            {sim.period || '-'}
                          </td>
                          <td className="px-4 py-3">
                            <Badge variant="secondary">
                              {sim.resultData ? '完了' : '未完了'}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            ) : (
              <Card>
                <CardContent className="py-12 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                    <Info className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <p className="text-muted-foreground mb-4">
                    まだ試算結果がありません。新規試算を始めましょう。
                  </p>
                  <Link href="/trial">
                    <Button>
                      <Calculator className="mr-2 h-4 w-4" />
                      新規試算を始める
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            )}
          </section>

          {/* P-score Formula */}
          <section className="mb-10">
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

          {/* CTA */}
          <section className="text-center py-6">
            <Link href="/trial">
              <Button size="lg">
                <Calculator className="mr-2 h-5 w-5" />
                新規試算を始める
              </Button>
            </Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
