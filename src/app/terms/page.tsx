import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: '利用規約',
};

const LAST_UPDATED = '2026年4月1日';

const sections = [
  { id: 'service', label: '1. サービスの内容' },
  { id: 'disclaimer', label: '2. 免責事項' },
  { id: 'prohibited', label: '3. 禁止事項' },
  { id: 'ip', label: '4. 知的財産権' },
  { id: 'conditions', label: '5. 利用条件' },
  { id: 'pricing', label: '6. 利用料金' },
  { id: 'law', label: '7. 準拠法・管轄' },
  { id: 'contact', label: '8. お問い合わせ' },
  { id: 'changes', label: '9. 規約の変更' },
] as const;

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">利用規約</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              最終更新日: {LAST_UPDATED}
            </p>
          </header>

          <p className="text-base leading-relaxed text-foreground mb-8">
            本規約は、KeishinCloud（以下「本サービス」）の利用条件を定めるものです。
            本サービスを利用された場合、本規約に同意したものとみなします。
          </p>

          {/* Table of Contents */}
          <nav
            aria-label="目次"
            className="mb-10 rounded-lg border bg-muted/40 p-5 print:border-gray-300"
            data-print-hide
          >
            <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
              目次
            </h2>
            <ol className="grid gap-1.5 text-sm sm:grid-cols-2">
              {sections.map((s) => (
                <li key={s.id}>
                  <a
                    href={`#${s.id}`}
                    className="text-primary hover:underline"
                  >
                    {s.label}
                  </a>
                </li>
              ))}
            </ol>
          </nav>

          <div className="space-y-10 text-muted-foreground leading-relaxed">
            <section id="service" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">1. サービスの内容</h2>
              <p>
                本サービスは、建設業の経営事項審査（経審）P点の試算をWebブラウザ上で行うツールです。
                試算結果は参考値であり、公式の経営事項審査結果通知書ではありません。
              </p>
            </section>

            <section id="disclaimer" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">2. 免責事項</h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>本サービスの試算結果の正確性・完全性について、いかなる保証もいたしません。</li>
                <li>試算結果に基づく意思決定により生じた損害について、一切の責任を負いません。</li>
                <li>最終的な経審結果は登録経営状況分析機関および許可行政庁の審査によります。</li>
                <li>本サービスの一時的な中断・停止・変更について、事前通知の義務を負いません。</li>
              </ul>
            </section>

            <section id="prohibited" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">3. 禁止事項</h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>本サービスの逆アセンブル、逆コンパイル等のリバースエンジニアリング</li>
                <li>サーバーに過度の負荷をかける行為</li>
                <li>他のユーザーのアカウントを不正に使用する行為</li>
                <li>法令に違反する行為、または公序良俗に反する行為</li>
              </ul>
            </section>

            <section id="ip" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">4. 知的財産権</h2>
              <p>
                本サービスに関するすべてのコンテンツ（テキスト、デザイン、計算ロジック等）の知的財産権は、
                本サービスの運営者に帰属します。
              </p>
            </section>

            <section id="conditions" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">5. 利用条件</h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>本サービスの利用にはGoogleアカウントによる認証が必要です（簡易シミュレーターを除く）。</li>
                <li>ユーザーは自身のアカウント情報の管理について責任を負います。</li>
                <li>本サービスは日本国内の建設業許可事業者を主たる利用者として想定しています。</li>
                <li>利用者は正確な情報を入力するよう努めてください。</li>
              </ul>
            </section>

            <section id="pricing" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">6. 利用料金</h2>
              <p>
                本サービスの基本機能は無料で提供します。
                将来的に有料機能を追加する場合は、事前に案内いたします。
                有料プランの詳細は<a href="/pricing" className="text-primary underline hover:no-underline">料金ページ</a>をご確認ください。
              </p>
            </section>

            <section id="law" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">7. 準拠法・管轄</h2>
              <p>
                本規約は日本法に準拠し、本サービスに関する紛争については、
                東京地方裁判所を第一審の専属的合意管轄裁判所とします。
              </p>
            </section>

            <section id="contact" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">8. お問い合わせ</h2>
              <p>
                本規約に関するお問い合わせは、
                <a href="/contact" className="text-primary underline hover:no-underline">お問い合わせページ</a>
                よりご連絡ください。
              </p>
            </section>

            <section id="changes" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">9. 規約の変更</h2>
              <p>
                本規約は、必要に応じて予告なく変更される場合があります。
                変更後の規約は本ページに掲載した時点で効力を生じます。
              </p>
            </section>
          </div>

          <footer className="mt-12 border-t pt-6">
            <p className="text-xs text-muted-foreground">制定日: 2026年4月1日</p>
          </footer>
        </article>
      </main>
      <Footer />
    </>
  );
}
