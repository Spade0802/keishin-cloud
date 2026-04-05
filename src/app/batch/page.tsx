import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { BatchSimulationClient } from './batch-client';

export const metadata: Metadata = {
  title: '一括シミュレーション | KeishinCloud',
  description:
    '複数法人の経審P点を一括で試算・比較。CSV/Excelファイルをアップロードして、まとめて結果を確認できます。',
};

export default function BatchSimulationPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <BatchSimulationClient />
        </div>
      </main>
      <Footer />
    </div>
  );
}
