import Link from 'next/link';
import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import {
  Home,
  LayoutDashboard,
  PlayCircle,
  Mail,
  BookOpen,
  ArrowRight,
  SearchX,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'ページが見つかりません',
  description:
    'お探しのページは見つかりませんでした。KeishinCloudのトップページやデモ、ガイドをご利用ください。',
  robots: { index: false, follow: true },
};

const quickLinks = [
  {
    href: '/',
    label: 'トップページ',
    description: 'サービスの概要と機能紹介',
    icon: Home,
  },
  {
    href: '/dashboard',
    label: 'ダッシュボード',
    description: '試算結果の確認・管理',
    icon: LayoutDashboard,
  },
  {
    href: '/demo',
    label: 'デモを試す',
    description: '登録不要で経審シミュレーション',
    icon: PlayCircle,
  },
  {
    href: '/contact',
    label: 'お問い合わせ',
    description: 'ご不明点はお気軽にどうぞ',
    icon: Mail,
  },
];

const guideLinks = [
  { href: '/guide/keishin', label: '経審とは' },
  { href: '/guide/y-score', label: 'Y点の計算方法' },
  { href: '/guide/score-up', label: 'P点を上げる方法' },
];

export default function NotFound() {
  return (
    <>
      <Header />
      <main className="flex-1 px-4 py-16 sm:py-24">
        <div className="mx-auto max-w-3xl">
          {/* Hero section */}
          <div className="text-center mb-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-muted">
              <SearchX className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-7xl font-bold text-muted-foreground/20 select-none">
              404
            </p>
            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              ページが見つかりません
            </h1>
            <p className="mt-3 text-muted-foreground max-w-md mx-auto">
              お探しのページは移動または削除された可能性があります。
              URLをご確認いただくか、以下のリンクからお探しのページをお試しください。
            </p>
          </div>

          {/* Quick links grid */}
          <div className="grid gap-3 sm:grid-cols-2 mb-10">
            {quickLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group flex items-start gap-4 rounded-lg border p-4 transition-colors hover:bg-muted/50 hover:border-foreground/20"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <item.icon className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium text-sm">{item.label}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {item.description}
                  </p>
                </div>
              </Link>
            ))}
          </div>

          {/* Guide links */}
          <div className="rounded-lg border bg-muted/30 p-5">
            <div className="flex items-center gap-2 mb-3">
              <BookOpen className="h-4 w-4 text-muted-foreground" />
              <h2 className="text-sm font-semibold">経審ガイド</h2>
            </div>
            <p className="text-xs text-muted-foreground mb-3">
              経営事項審査について詳しく知りたい方はこちら
            </p>
            <ul className="space-y-1">
              {guideLinks.map((item) => (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className="group flex items-center justify-between rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:text-foreground hover:bg-background"
                  >
                    {item.label}
                    <ArrowRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* CTA */}
          <div className="mt-10 text-center">
            <Link href="/">
              <Button size="lg">
                <Home className="mr-2 h-4 w-4" />
                トップページへ戻る
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
