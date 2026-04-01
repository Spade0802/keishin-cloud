import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { SimulatorForm } from '@/components/simulator-form';

export const metadata: Metadata = {
  title: '経審P点シミュレーター',
  description:
    '経営事項審査（経審）P点を無料で即試算。X1・X2・Y・Z・W全項目の自動計算、業種別P点の算出。登録不要。',
};

export default function SimulatorPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold sm:text-3xl">経審P点シミュレーター</h1>
            <p className="mt-2 text-muted-foreground">
              決算書の数値と業種情報を入力して、P点を即試算できます。
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              ※ 本試算結果は参考値であり、公式の経営事項審査結果通知書ではありません。
            </p>
          </div>
          <SimulatorForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
