import type { Metadata } from 'next';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { companies, fiscalPeriods } from '@/lib/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Building2,
  Calendar,
  Plus,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

export const metadata: Metadata = {
  title: '企業詳細',
};

export default async function CompanyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.organizationId) {
    redirect('/onboarding');
  }

  const { id } = await params;

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

  const periods = await db
    .select()
    .from(fiscalPeriods)
    .where(eq(fiscalPeriods.companyId, id))
    .orderBy(desc(fiscalPeriods.periodNumber));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Breadcrumb */}
          <div className="mb-6">
            <Link
              href="/companies"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-3 w-3" />
              企業一覧に戻る
            </Link>
          </div>

          {/* Company Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-3 mb-1">
                <Building2 className="h-7 w-7 text-primary" />
                <h1 className="text-2xl font-bold tracking-tight">
                  {company.name}
                </h1>
              </div>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                {company.permitNumber && (
                  <span>許可番号: {company.permitNumber}</span>
                )}
                {company.prefectureCode && (
                  <span>都道府県コード: {company.prefectureCode}</span>
                )}
              </div>
              {(company.targetIndustries as string[] | null)?.length ? (
                <div className="flex flex-wrap gap-1 mt-2">
                  {(company.targetIndustries as string[]).map((ind) => (
                    <Badge key={ind} variant="secondary" className="text-xs">
                      {ind}
                    </Badge>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* Periods Section */}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              決算期一覧
            </h2>
            <Link href={`/companies/${id}/periods/new`}>
              <Button size="sm">
                <Plus className="mr-2 h-4 w-4" />
                新規決算期
              </Button>
            </Link>
          </div>

          {periods.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Calendar className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                <h3 className="text-lg font-semibold mb-2">
                  決算期がまだありません
                </h3>
                <p className="text-sm text-muted-foreground mb-6">
                  最初の決算期を登録して、経審データの入力を開始しましょう。
                </p>
                <Link href={`/companies/${id}/periods/new`}>
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    最初の決算期を追加
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {periods.map((period) => (
                <Link
                  key={period.id}
                  href={`/companies/${id}/periods/${period.id}`}
                >
                  <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30">
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                            {period.periodNumber}
                          </div>
                          <div>
                            <p className="font-semibold">
                              第{period.periodNumber}期
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {period.startDate && period.endDate
                                ? `${period.startDate} 〜 ${period.endDate}`
                                : '期間未設定'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
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
                          <ArrowRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  );
}
