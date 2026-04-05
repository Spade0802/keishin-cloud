import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { companies } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, Plus, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: '企業一覧',
};

export default async function CompaniesPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.organizationId) {
    redirect('/onboarding');
  }

  const companyList = await db
    .select()
    .from(companies)
    .where(eq(companies.organizationId, session.user.organizationId))
    .orderBy(companies.createdAt);

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <Building2 className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">企業一覧</h1>
            </div>
            <Link href="/companies/new">
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                企業を追加
              </Button>
            </Link>
          </div>

          {companyList.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <Building2 className="mx-auto mb-4 h-10 w-10 text-muted-foreground" />
                <h2 className="text-lg font-semibold mb-2">企業がまだ登録されていません</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  経審シミュレーションを行う企業を登録してください。
                </p>
                <Link href="/companies/new">
                  <Button>
                    <Plus className="mr-2 h-4 w-4" />
                    最初の企業を追加
                  </Button>
                </Link>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {companyList.map((company) => (
                <Link key={company.id} href={`/companies/${company.id}`}>
                  <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 h-full">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-primary" />
                        {company.name}
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {company.permitNumber && (
                        <p className="text-sm text-muted-foreground mb-2">
                          許可番号: {company.permitNumber}
                        </p>
                      )}
                      {company.prefectureCode && (
                        <p className="text-sm text-muted-foreground mb-2">
                          都道府県コード: {company.prefectureCode}
                        </p>
                      )}
                      {(company.targetIndustries as string[] | null)?.length ? (
                        <div className="flex flex-wrap gap-1 mb-2">
                          {(company.targetIndustries as string[]).slice(0, 3).map((ind) => (
                            <Badge key={ind} variant="secondary" className="text-xs">
                              {ind}
                            </Badge>
                          ))}
                          {(company.targetIndustries as string[]).length > 3 && (
                            <Badge variant="secondary" className="text-xs">
                              +{(company.targetIndustries as string[]).length - 3}
                            </Badge>
                          )}
                        </div>
                      ) : null}
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
                        詳細を見る
                        <ArrowRight className="h-3 w-3" />
                      </span>
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
