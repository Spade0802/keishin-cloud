import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '無料体験デモ',
  description:
    'サンプルデータで経審P点シミュレーションを無料体験。登録不要で全機能をお試しいただけます。',
};

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
