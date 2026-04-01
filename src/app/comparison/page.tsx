import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { PeriodComparison } from '@/components/period-comparison';

export const metadata: Metadata = {
  title: '前期比較表 | KeishinCloud',
  description:
    '前期と当期の経審P点・全評点を自動比較。変動の大きい項目をハイライト表示。',
};

export default function ComparisonPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold sm:text-3xl">前期比較表</h1>
            <p className="mt-2 text-muted-foreground">
              前期と当期の全評点を並べて比較します。変動幅が大きい項目を自動ハイライト。
            </p>
          </div>
          <PeriodComparison />
        </div>
      </main>
      <Footer />
    </>
  );
}
