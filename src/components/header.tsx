'use client';

import Link from 'next/link';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X } from 'lucide-react';

export function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-sm">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
            K
          </div>
          <span className="text-lg font-bold tracking-tight">
            KeishinCloud
          </span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-6 text-sm">
          <Link href="/dashboard" className="text-muted-foreground hover:text-foreground transition-colors">
            ダッシュボード
          </Link>
          <Link href="/trial" className="text-muted-foreground hover:text-foreground transition-colors">
            新規試算
          </Link>
          <Link href="/simulator" className="text-muted-foreground hover:text-foreground transition-colors">
            シミュレーション
          </Link>
          <Link href="/reclassification" className="text-muted-foreground hover:text-foreground transition-colors">
            再分類分析
          </Link>
          <Link href="/guide/keishin" className="text-muted-foreground hover:text-foreground transition-colors">
            経審とは
          </Link>
          <Link href="/trial">
            <Button size="sm">無料で試算する</Button>
          </Link>
        </nav>

        {/* Mobile menu button */}
        <button
          className="md:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="メニュー"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="md:hidden border-t px-4 py-4 flex flex-col gap-3">
          <Link href="/dashboard" className="text-sm py-2" onClick={() => setMobileOpen(false)}>
            ダッシュボード
          </Link>
          <Link href="/trial" className="text-sm py-2" onClick={() => setMobileOpen(false)}>
            新規試算
          </Link>
          <Link href="/simulator" className="text-sm py-2" onClick={() => setMobileOpen(false)}>
            シミュレーション
          </Link>
          <Link href="/reclassification" className="text-sm py-2" onClick={() => setMobileOpen(false)}>
            再分類分析
          </Link>
          <Link href="/guide/keishin" className="text-sm py-2" onClick={() => setMobileOpen(false)}>
            経審とは
          </Link>
          <Link href="/trial" onClick={() => setMobileOpen(false)}>
            <Button className="w-full" size="sm">無料で試算する</Button>
          </Link>
        </nav>
      )}
    </header>
  );
}
