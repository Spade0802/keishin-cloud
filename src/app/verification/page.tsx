import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { VerificationForm } from '@/components/verification-form';

export const metadata: Metadata = {
  title: '実績突合 | KeishinCloud',
  description:
    '過去の経審結果通知書と試算値を自動比較。全評点の突合と差異原因の自動推定。',
};

export default function VerificationPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold sm:text-3xl">実績突合</h1>
            <p className="mt-2 text-muted-foreground">
              行政庁から届いた⑤総合評定値通知書の実績値と、試算値を自動比較します。
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              差異がある場合は推定原因と対処法を表示します。
            </p>
          </div>
          <VerificationForm />
        </div>
      </main>
      <Footer />
    </>
  );
}
