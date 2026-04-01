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
          <Link href="/simulator" className="text-muted-foreground hover:text-foreground transition-colors">
            シミュレーター
          </Link>
          <Link href="/guide/keishin" className="text-muted-foreground hover:text-foreground transition-colors">
            経審とは
          </Link>
          <Link href="/guide/y-score" className="text-muted-foreground hover:text-foreground transition-colors">
            Y点解説
          </Link>
          <Link href="/guide/score-up" className="text-muted-foreground hover:text-foreground transition-colors">
            P点の上げ方
          </Link>
          <Link href="/simulator">
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
          <Link href="/simulator" className="text-sm py-2" onClick={() => setMobileOpen(false)}>
            シミュレーター
          </Link>
          <Link href="/guide/keishin" className="text-sm py-2" onClick={() => setMobileOpen(false)}>
            経審とは
          </Link>
          <Link href="/guide/y-score" className="text-sm py-2" onClick={() => setMobileOpen(false)}>
            Y点解説
          </Link>
          <Link href="/guide/score-up" className="text-sm py-2" onClick={() => setMobileOpen(false)}>
            P点の上げ方
          </Link>
          <Link href="/simulator" onClick={() => setMobileOpen(false)}>
            <Button className="w-full" size="sm">無料で試算する</Button>
          </Link>
        </nav>
      )}
    </header>
  );
}
