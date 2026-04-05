import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '料金プラン',
  description:
    'KeishinCloudの料金プラン。無料プランからプロプランまで、経審シミュレーションに必要な機能を選べます。',
};

export default function PricingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
