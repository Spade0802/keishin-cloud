import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { organizations } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Calculator,
  Upload,
  FileCheck,
  ClipboardList,
  BarChart3,
  ArrowRight,
  Building2,
  Lightbulb,
  BookOpen,
  TrendingUp,
  CheckCircle,
  ChevronRight,
} from 'lucide-react';
import { SignOutButton } from './sign-out-button';

export const metadata: Metadata = {
  title: 'ダッシュボード',
};

export default async function DashboardPage() {
  const session = await auth();

  if (!session?.user) {
    redirect('/login');
  }

  if (!session.user.organizationId) {
    redirect('/onboarding');
  }

  // 法人情報を取得
  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.id, session.user.organizationId));

  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Welcome Section */}
          <section className="mb-10">
            <div className="flex items-center justify-between">
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <Building2 className="h-7 w-7 text-primary" />
                  <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                    ようこそ
                  </h1>
                </div>
                <p className="text-muted-foreground">
                  {org?.name ?? '法人未設定'}
                  {org?.permitNumber && (
                    <span className="ml-2 text-sm">({org.permitNumber})</span>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted-foreground hidden sm:inline">
                  {session.user.email}
                </span>
                <SignOutButton />
              </div>
            </div>
          </section>

          {/* CTA: 新規試算 */}
          <section className="mb-10">
            <Card className="bg-gradient-to-r from-primary/5 to-primary/10 border-primary/20">
              <CardContent className="py-8 text-center">
                <Calculator className="mx-auto mb-4 h-10 w-10 text-primary" />
                <h2 className="text-xl font-bold mb-2">経審P点を試算する</h2>
                <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
                  決算書をアップロードするだけで、貸借対照表・損益計算書を自動生成し、P点を計算します。
                </p>
                <Link href="/trial">
                  <Button size="lg" className="px-8">
                    <Calculator className="mr-2 h-5 w-5" />
                    新規試算を始める
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </CardContent>
            </Card>
          </section>

          {/* 使い方ガイド: 4ステップ */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-6 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              使い方ガイド
            </h2>

            <div className="space-y-0">
              {/* Step 1 */}
              <StepCard
                stepNum={1}
                icon={<Upload className="h-6 w-6" />}
                title="決算書をアップロード"
                description="決算書のPDF・Excelファイルをドラッグ＆ドロップ。AIが自動で貸借対照表と損益計算書を読み取り、経審に必要な18項目を自動入力します。"
                tips={[
                  'PDF（スキャン含む）、Excel、CSVに対応',
                  'OCR機能でスキャンPDFも読み取り可能',
                  '自動入力された項目は緑色、未入力は黄色で表示',
                ]}
              />

              {/* Step 2 */}
              <StepCard
                stepNum={2}
                icon={<FileCheck className="h-6 w-6" />}
                title="データを確認・補完"
                description="AIが読み取れなかった項目だけ手入力。自動生成された貸借対照表・損益計算書のプレビューで、読み取り結果を確認できます。"
                tips={[
                  '減価償却実施額は注記表や原価報告書から確認',
                  '貸倒引当金は絶対値で入力',
                  '工事未払金は未払経費を含めない',
                ]}
              />

              {/* Step 3 */}
              <StepCard
                stepNum={3}
                icon={<ClipboardList className="h-6 w-6" />}
                title="提出書データ・社会性項目を入力"
                description="経審提出書PDFをアップロードすると、業種別完工高やW項目も自動読取。技術職員名簿と社会性等の項目を入力します。"
                tips={[
                  '提出書PDFから基本情報・業種データを自動反映',
                  '別紙三のW項目も自動チェック',
                  '前期データは2回目以降自動引継ぎ',
                ]}
              />

              {/* Step 4 */}
              <StepCard
                stepNum={4}
                icon={<BarChart3 className="h-6 w-6" />}
                title="P点の結果を確認"
                description="業種ごとのP点、Y/X2/W各スコア、8つの財務指標をレーダーチャートで可視化。AI分析でP点向上のアドバイスも確認できます。"
                tips={[
                  'Excelエクスポートで結果を保存・共有',
                  'AI分析タブでP点向上の具体策を提案',
                  '再分類シミュレーションで会計処理の最適解を探索',
                ]}
                isLast
              />
            </div>
          </section>

          {/* その他の機能 */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Lightbulb className="h-5 w-5 text-primary" />
              便利な機能
            </h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FeatureCard
                href="/verification"
                icon={<CheckCircle className="h-5 w-5" />}
                title="実績突合"
                description="通知書の実績値と試算値を比較し、差異の原因を自動検出"
              />
              <FeatureCard
                href="/comparison"
                icon={<TrendingUp className="h-5 w-5" />}
                title="前期比較表"
                description="前期と当期のスコアを並べて比較分析"
              />
              <FeatureCard
                href="/reclassification"
                icon={<BarChart3 className="h-5 w-5" />}
                title="再分類分析"
                description="会計処理パターンごとのP点比較で最適解を発見"
              />
              <FeatureCard
                href="/batch"
                icon={<Building2 className="h-5 w-5" />}
                title="一括シミュレーション"
                description="複数法人のP点を一括試算・比較（準備中）"
              />
            </div>
          </section>

          {/* 学習リソース */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-primary" />
              経審を学ぶ
            </h2>
            <div className="grid gap-3 sm:grid-cols-3">
              <GuideLink
                href="/guide/keishin"
                title="経審とは"
                description="経営事項審査の基本と仕組み"
              />
              <GuideLink
                href="/guide/y-score"
                title="Y点の計算方法"
                description="8指標の計算式と改善ポイント"
              />
              <GuideLink
                href="/guide/score-up"
                title="P点を上げる方法"
                description="短期・中期・長期の改善戦略"
              />
            </div>
          </section>

          {/* P点算出式 */}
          <section className="mb-6">
            <Card className="bg-muted/40">
              <CardContent className="pt-4">
                <p className="text-xs text-muted-foreground mb-1">
                  P点算出式
                </p>
                <p className="font-mono text-sm font-medium">
                  P = 0.25 x X1 + 0.15 x X2 + 0.20 x Y + 0.25 x Z + 0.15 x W
                </p>
              </CardContent>
            </Card>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}

// ─── サブコンポーネント ───

function StepCard({
  stepNum,
  icon,
  title,
  description,
  tips,
  isLast,
}: {
  stepNum: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  tips: string[];
  isLast?: boolean;
}) {
  return (
    <div className="relative flex gap-4">
      {/* タイムライン */}
      <div className="flex flex-col items-center">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-sm">
          {stepNum}
        </div>
        {!isLast && (
          <div className="w-0.5 flex-1 bg-border my-1" />
        )}
      </div>

      {/* コンテンツ */}
      <div className={`pb-8 ${isLast ? '' : ''}`}>
        <div className="flex items-center gap-2 mb-1">
          <span className="text-primary">{icon}</span>
          <h3 className="font-semibold text-base">{title}</h3>
        </div>
        <p className="text-sm text-muted-foreground mb-3">{description}</p>
        <div className="space-y-1.5">
          {tips.map((tip, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
              <CheckCircle className="h-3.5 w-3.5 shrink-0 mt-0.5 text-green-500" />
              <span>{tip}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link href={href}>
      <Card className="cursor-pointer transition-all hover:shadow-md hover:border-primary/30 h-full">
        <CardContent className="pt-5 pb-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-primary">{icon}</span>
            <h3 className="font-semibold text-sm">{title}</h3>
          </div>
          <p className="text-xs text-muted-foreground mb-2">{description}</p>
          <span className="inline-flex items-center gap-1 text-xs font-medium text-primary">
            使ってみる
            <ChevronRight className="h-3 w-3" />
          </span>
        </CardContent>
      </Card>
    </Link>
  );
}

function GuideLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50 hover:border-primary/30"
    >
      <BookOpen className="h-4 w-4 text-primary shrink-0" />
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
