import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: '利用規約',
};

export default function TermsPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold sm:text-3xl mb-8">利用規約</h1>

          <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
            <p className="text-foreground">
              本規約は、KeishinCloud（以下「本サービス」）の利用条件を定めるものです。
              本サービスを利用された場合、本規約に同意したものとみなします。
            </p>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">1. サービスの内容</h2>
              <p>
                本サービスは、建設業の経営事項審査（経審）P点の試算をWebブラウザ上で行うツールです。
                試算結果は参考値であり、公式の経営事項審査結果通知書ではありません。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">2. 免責事項</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>本サービスの試算結果の正確性・完全性について、いかなる保証もいたしません。</li>
                <li>試算結果に基づく意思決定により生じた損害について、一切の責任を負いません。</li>
                <li>最終的な経審結果は登録経営状況分析機関および許可行政庁の審査によります。</li>
                <li>本サービスの一時的な中断・停止・変更について、事前通知の義務を負いません。</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">3. 禁止事項</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>本サービスの逆アセンブル、逆コンパイル等のリバースエンジニアリング</li>
                <li>サーバーに過度の負荷をかける行為</li>
                <li>他のユーザーのアカウントを不正に使用する行為</li>
                <li>法令に違反する行為、または公序良俗に反する行為</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">4. 知的財産権</h2>
              <p>
                本サービスに関するすべてのコンテンツ（テキスト、デザイン、計算ロジック等）の知的財産権は、
                本サービスの運営者に帰属します。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">5. 利用条件</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>本サービスの利用にはGoogleアカウントによる認証が必要です（簡易シミュレーターを除く）。</li>
                <li>ユーザーは自身のアカウント情報の管理について責任を負います。</li>
                <li>本サービスは日本国内の建設業許可事業者を主たる利用者として想定しています。</li>
                <li>利用者は正確な情報を入力するよう努めてください。</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">6. 利用料金</h2>
              <p>
                本サービスの基本機能は無料で提供します。
                将来的に有料機能を追加する場合は、事前に案内いたします。
                有料プランの詳細は<a href="/pricing" className="text-primary underline hover:no-underline">料金ページ</a>をご確認ください。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">7. 準拠法・管轄</h2>
              <p>
                本規約は日本法に準拠し、本サービスに関する紛争については、
                東京地方裁判所を第一審の専属的合意管轄裁判所とします。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">8. お問い合わせ</h2>
              <p>
                本規約に関するお問い合わせは、
                <a href="/contact" className="text-primary underline hover:no-underline">お問い合わせページ</a>
                よりご連絡ください。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">9. 規約の変更</h2>
              <p>
                本規約は、必要に応じて予告なく変更される場合があります。
                変更後の規約は本ページに掲載した時点で効力を生じます。
              </p>
            </section>

            <p className="text-xs mt-8">制定日: 2026年4月1日</p>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
