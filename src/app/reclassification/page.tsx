import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ReclassificationSimulator } from '@/components/reclassification-simulator';

export const metadata: Metadata = {
  title: '再分類シミュレーション | KeishinCloud',
  description:
    '決算確定前に最適な会計処理を可視化。Case A/B/C 3パターン比較で最もP点に有利な処理方法を特定。',
};

export default function ReclassificationPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold sm:text-3xl">再分類シミュレーション</h1>
            <p className="mt-2 text-muted-foreground">
              決算確定前に、異なる会計処理パターンがP点に与える影響を比較できます。
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ※ 合法的な再分類の範囲内での最適化を目的としています。
            </p>
          </div>
          <ReclassificationSimulator />
        </div>
      </main>
      <Footer />
    </>
  );
}
