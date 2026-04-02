import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { OnboardingForm } from './onboarding-form';

export const metadata: Metadata = {
  title: '法人情報の登録 | KeishinCloud',
  description: '法人情報を登録して、シミュレーション結果を管理しましょう。',
};

export default async function OnboardingPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  // 既に法人に紐づいている場合はダッシュボードへ
  if (session.user.organizationId) {
    redirect('/dashboard');
  }

  return (
    <main className="flex-1 flex items-center justify-center px-4 py-16">
      <OnboardingForm userName={session.user.name ?? ''} />
    </main>
  );
}
