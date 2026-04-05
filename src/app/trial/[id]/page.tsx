import { notFound, redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { simulations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { InputWizard } from '@/components/input-wizard';
import { ErrorBoundary } from '@/components/error-boundary';

interface Props {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const [sim] = await db
    .select({ name: simulations.name })
    .from(simulations)
    .where(eq(simulations.id, id));

  return {
    title: sim ? `${sim.name} | KeishinCloud` : '試算 | KeishinCloud',
  };
}

export default async function TrialDetailPage({ params }: Props) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login');
  }

  const { id } = await params;

  const [sim] = await db
    .select()
    .from(simulations)
    .where(eq(simulations.id, id));

  if (!sim) {
    notFound();
  }

  // Verify the user has access (same user or same organization)
  const orgId = session.user.organizationId;
  const hasAccess =
    sim.userId === session.user.id ||
    (orgId && sim.organizationId === orgId) ||
    sim.isPublic;

  if (!hasAccess) {
    notFound();
  }

  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-4">
            <h1 className="text-2xl font-bold sm:text-3xl">{sim.name}</h1>
            <p className="mt-2 text-muted-foreground">
              {sim.period ? `${sim.period} - ` : ''}
              保存済みシミュレーション
            </p>
          </div>
          <ErrorBoundary fallbackTitle="試算画面でエラーが発生しました">
            <InputWizard
              initialInputData={sim.inputData as Record<string, unknown>}
              initialResultData={sim.resultData as Record<string, unknown> | undefined}
              simulationId={sim.id}
            />
          </ErrorBoundary>
        </div>
      </main>
      <Footer />
    </>
  );
}
