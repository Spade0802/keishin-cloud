'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Building2,
  Users,
  Calculator,
  Settings,
  CreditCard,
  FileText,
  ArrowLeft,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navItems = [
  { href: '/admin', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/admin/organizations', label: '法人一覧', icon: Building2 },
  { href: '/admin/users', label: 'ユーザー一覧', icon: Users },
  { href: '/admin/simulations', label: '試算履歴', icon: Calculator },
  { href: '/admin/billing', label: '課金管理', icon: CreditCard },
  { href: '/admin/audit-logs', label: '監査ログ', icon: FileText },
  { href: '/admin/settings', label: 'システム設定', icon: Settings },
];

export function AdminSidebar() {
  const pathname = usePathname();

  const isActive = (href: string) => {
    if (href === '/admin') return pathname === '/admin';
    return pathname.startsWith(href);
  };

  return (
    <aside className="hidden lg:flex w-60 flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 border-b px-4">
        <div className="flex h-7 w-7 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground text-xs font-bold">
          K
        </div>
        <span className="text-sm font-bold tracking-tight">
          KeishinCloud
        </span>
      </div>

      <nav className="flex-1 flex flex-col gap-1 p-3">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                'flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors',
                isActive(item.href)
                  ? 'bg-sidebar-accent text-sidebar-accent-foreground font-medium'
                  : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground',
              )}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/"
          className="flex items-center gap-2 rounded-md px-3 py-2 text-sm text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          サイトに戻る
        </Link>
      </div>
    </aside>
  );
}
