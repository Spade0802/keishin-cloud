'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Menu, X, ChevronDown } from 'lucide-react';
import { useSession } from '@/lib/session-context';

const navItems = [
  { href: '/trial', label: '新規試算' },
  { href: '/dashboard', label: 'ダッシュボード' },
];

const toolItems = [
  { href: '/verification', label: '実績突合' },
  { href: '/comparison', label: '前期比較表' },
  { href: '/reclassification', label: '再分類分析' },
];

const guideItems = [
  { href: '/guide/keishin', label: '経審とは' },
  { href: '/guide/y-score', label: 'Y点の計算方法' },
  { href: '/guide/score-up', label: 'P点を上げる方法' },
];

export function Header() {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [guidesOpen, setGuidesOpen] = useState(false);
  const session = useSession();

  const isActive = (href: string) => pathname === href;
  const isLoggedIn = !!session?.user;

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
        <nav className="hidden lg:flex items-center gap-1 text-sm">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`px-3 py-2 rounded-md transition-colors ${
                isActive(item.href)
                  ? 'text-foreground bg-muted font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              {item.label}
            </Link>
          ))}

          {/* Tools dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setToolsOpen(true)}
            onMouseLeave={() => setToolsOpen(false)}
          >
            <button
              className={`flex items-center gap-1 px-3 py-2 rounded-md transition-colors ${
                toolItems.some(t => isActive(t.href))
                  ? 'text-foreground bg-muted font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              分析ツール
              <ChevronDown className="h-3 w-3" />
            </button>
            {toolsOpen && (
              <div className="absolute left-0 top-full pt-1 z-50">
                <div className="rounded-lg border bg-background shadow-lg py-1 min-w-[180px]">
                  {toolItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        isActive(item.href)
                          ? 'text-foreground bg-muted font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Guides dropdown */}
          <div
            className="relative"
            onMouseEnter={() => setGuidesOpen(true)}
            onMouseLeave={() => setGuidesOpen(false)}
          >
            <button
              className={`flex items-center gap-1 px-3 py-2 rounded-md transition-colors ${
                guideItems.some(g => isActive(g.href))
                  ? 'text-foreground bg-muted font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              }`}
            >
              経審ガイド
              <ChevronDown className="h-3 w-3" />
            </button>
            {guidesOpen && (
              <div className="absolute right-0 top-full pt-1 z-50">
                <div className="rounded-lg border bg-background shadow-lg py-1 min-w-[180px]">
                  {guideItems.map((item) => (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={`block px-4 py-2 text-sm transition-colors ${
                        isActive(item.href)
                          ? 'text-foreground bg-muted font-medium'
                          : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
                      }`}
                    >
                      {item.label}
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>

          {isLoggedIn ? (
            <Link href="/dashboard" className="ml-2">
              <Button size="sm" variant="outline">ダッシュボード</Button>
            </Link>
          ) : (
            <div className="ml-2 flex items-center gap-2">
              <Link href="/login">
                <Button size="sm" variant="ghost">ログイン</Button>
              </Link>
              <Link href="/trial">
                <Button size="sm">無料で試算する</Button>
              </Link>
            </div>
          )}
        </nav>

        {/* Mobile menu button */}
        <button
          className="lg:hidden p-2"
          onClick={() => setMobileOpen(!mobileOpen)}
          aria-label="メニュー"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile nav */}
      {mobileOpen && (
        <nav className="lg:hidden border-t px-4 py-4 flex flex-col gap-1 bg-background">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm py-2.5 px-3 rounded-md ${
                isActive(item.href)
                  ? 'text-foreground bg-muted font-medium'
                  : 'text-muted-foreground'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}

          <div className="border-t my-1" />
          <p className="text-xs text-muted-foreground px-3 pt-1">分析ツール</p>
          {toolItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm py-2.5 px-3 rounded-md ${
                isActive(item.href)
                  ? 'text-foreground bg-muted font-medium'
                  : 'text-muted-foreground'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}

          <div className="border-t my-1" />
          <p className="text-xs text-muted-foreground px-3 pt-1">経審ガイド</p>
          {guideItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`text-sm py-2.5 px-3 rounded-md ${
                isActive(item.href)
                  ? 'text-foreground bg-muted font-medium'
                  : 'text-muted-foreground'
              }`}
              onClick={() => setMobileOpen(false)}
            >
              {item.label}
            </Link>
          ))}

          <div className="border-t my-2" />
          {isLoggedIn ? (
            <Link href="/dashboard" onClick={() => setMobileOpen(false)}>
              <Button className="w-full" size="sm" variant="outline">
                ダッシュボード
              </Button>
            </Link>
          ) : (
            <div className="flex flex-col gap-2">
              <Link href="/login" onClick={() => setMobileOpen(false)}>
                <Button className="w-full" size="sm" variant="outline">
                  ログイン
                </Button>
              </Link>
              <Link href="/trial" onClick={() => setMobileOpen(false)}>
                <Button className="w-full" size="sm">無料で試算する</Button>
              </Link>
            </div>
          )}
        </nav>
      )}
    </header>
  );
}
