import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { auth } from '@/lib/auth';
import { LoginForm } from './login-form';

export const metadata: Metadata = {
  title: 'ログイン',
  description: 'KeishinCloudにログインして、シミュレーション結果を保存・管理しましょう。',
};

export default async function LoginPage() {
  const session = await auth().catch(() => null);

  if (session?.user) {
    if (!session.user.organizationId) {
      redirect('/onboarding');
    }
    redirect('/dashboard');
  }

  return (
    <>
      <Header />
      <main className="flex-1 flex items-center justify-center px-4 py-16">
        <LoginForm />
      </main>
      <Footer />
    </>
  );
}
