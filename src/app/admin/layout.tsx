import type { Metadata } from 'next';
import { AdminSidebar } from '@/components/admin-sidebar';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: '管理画面',
};

/**
 * 管理者ロールの判定
 * 現在はデモ用に全認証済みユーザーを許可。
 * 本番では session.user.role === 'service_admin' 等で判定する。
 */
async function isServiceAdmin(): Promise<boolean> {
  const session = await auth();
  // デモ: 認証済みなら許可。未認証なら拒否。
  // 本番実装時は管理者フラグで判定に変更する。
  return !!session?.user;
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const authorized = await isServiceAdmin();

  if (!authorized) {
    redirect('/login');
  }

  return (
    <div className="flex min-h-screen">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="sticky top-0 z-40 flex h-14 items-center gap-4 border-b bg-background/80 backdrop-blur-sm px-6">
          <h1 className="text-sm font-semibold">管理画面</h1>
        </header>
        <main className="flex-1 p-6">{children}</main>
      </div>
    </div>
  );
}
