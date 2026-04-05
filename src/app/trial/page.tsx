import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { InputWizard } from '@/components/input-wizard';
import { ErrorBoundary } from '@/components/error-boundary';

export const metadata: Metadata = {
  title: '新規試算 | KeishinCloud',
  description:
    '決算書Excelと経審提出書データを入力して、P点を即試算。4ステップの入力ウィザード。',
};

export default function TrialPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4">
            <h1 className="text-2xl font-bold sm:text-3xl">新規試算</h1>
            <p className="mt-2 text-muted-foreground">
              決算書と提出書データから、経審P点を試算します。
            </p>
          </div>
          <ErrorBoundary fallbackTitle="試算画面でエラーが発生しました">
            <InputWizard />
          </ErrorBoundary>
        </div>
      </main>
      <Footer />
    </>
  );
}
