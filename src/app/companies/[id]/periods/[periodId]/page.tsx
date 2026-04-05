import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { companies, fiscalPeriods } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Building2, Calendar } from 'lucide-react';

export const metadata: Metadata = {
  title: '決算期詳細',
};

export default async function PeriodDetailPage({
  params,
}: {
  params: Promise<{ id: string; periodId: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.organizationId) {
    redirect('/onboarding');
  }

  const { id, periodId } = await params;

  const [company] = await db
    .select()
    .from(companies)
    .where(
      and(
        eq(companies.id, id),
        eq(companies.organizationId, session.user.organizationId)
      )
    );

  if (!company) {
    notFound();
  }

  const [period] = await db
    .select()
    .from(fiscalPeriods)
    .where(
      and(
        eq(fiscalPeriods.id, periodId),
        eq(fiscalPeriods.companyId, id)
      )
    );

  if (!period) {
    notFound();
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="mb-6 flex items-center gap-2 text-sm text-muted-foreground">
            <Link
              href="/companies"
              className="hover:text-foreground"
            >
              企業一覧
            </Link>
            <span>/</span>
            <Link
              href={`/companies/${id}`}
              className="hover:text-foreground"
            >
              {company.name}
            </Link>
            <span>/</span>
            <span className="text-foreground">第{period.periodNumber}期</span>
          </div>

          {/* Period Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Calendar className="h-6 w-6 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight">
                  {company.name} - 第{period.periodNumber}期
                </h1>
                <Badge
                  variant={
                    period.status === 'confirmed'
                      ? 'default'
                      : period.status === 'archived'
                        ? 'secondary'
                        : 'outline'
                  }
                >
                  {period.status === 'confirmed'
                    ? '確定'
                    : period.status === 'archived'
                      ? 'アーカイブ'
                      : '下書き'}
                </Badge>
              </div>
              {period.startDate && period.endDate && (
                <p className="text-sm text-muted-foreground ml-9">
                  {period.startDate} 〜 {period.endDate}
                </p>
              )}
            </div>
            <Link
              href={`/companies/${id}`}
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              企業詳細に戻る
            </Link>
          </div>

          {/* Placeholder for InputWizard + ResultView integration */}
          <div className="rounded-lg border border-dashed border-muted-foreground/30 p-12 text-center">
            <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
            <h2 className="text-lg font-semibold mb-2">
              経審データ入力
            </h2>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              この画面にInputWizardとResultViewが統合されます。
              決算書データの入力、経審計算、結果表示をここで行います。
            </p>
            {period.calculationResult != null && (
              <div className="mt-4">
                <Badge variant="default">計算結果あり</Badge>
              </div>
            )}
            {period.prevPeriodSnapshot != null && (
              <div className="mt-2">
                <Badge variant="secondary">前期データ引継ぎ済み</Badge>
              </div>
            )}
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
