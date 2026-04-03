import type { Metadata } from 'next';
import { AdminSidebar } from '@/components/admin-sidebar';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata: Metadata = {
  title: '管理画面',
};

/**
 * 管理者ロールの判定
 * session.user.role === 'admin' で判定する。
 */
async function isServiceAdmin(): Promise<boolean> {
  const session = await auth();
  if (!session?.user) return false;
  return session.user.role === 'admin';
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
