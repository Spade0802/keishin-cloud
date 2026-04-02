import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { auth } from '@/lib/auth';
import { SignupForm } from './signup-form';

export const metadata: Metadata = {
  title: '新規登録',
  description: 'KeishinCloudに無料で登録して、経審P点シミュレーション結果を保存・管理しましょう。',
};

export default async function SignupPage() {
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
        <SignupForm />
      </main>
      <Footer />
    </>
  );
}
