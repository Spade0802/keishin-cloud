import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'プライバシーポリシー',
};

const LAST_UPDATED = '2026年4月1日';

const sections = [
  { id: 'collection', label: '1. 収集する情報' },
  { id: 'purpose', label: '2. 情報の利用目的' },
  { id: 'simulator', label: '3. 簡易シミュレーターでのデータ取り扱い' },
  { id: 'third-party', label: '4. 第三者提供' },
  { id: 'cookies', label: '5. Cookieの使用' },
  { id: 'changes', label: '6. ポリシーの変更' },
  { id: 'retention', label: '7. データの保管期間' },
  { id: 'contact', label: '8. お問い合わせ' },
] as const;

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="mb-10">
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">プライバシーポリシー</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              最終更新日: {LAST_UPDATED}
            </p>
          </header>

          <p className="text-base leading-relaxed text-foreground mb-8">
            KeishinCloud（以下「本サービス」）は、ユーザーのプライバシーを尊重し、
            個人情報の保護に努めます。本ポリシーは、本サービスにおける個人情報の取り扱いについて定めます。
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
            <section id="collection" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">1. 収集する情報</h2>
              <p className="mb-2">本サービスでは、以下の情報を収集する場合があります。</p>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>Googleアカウント連携時のメールアドレス、表示名</li>
                <li>試算に入力された財務データ（アカウント登録時のみサーバー保存）</li>
                <li>アクセスログ（IPアドレス、ブラウザ情報、アクセス日時）</li>
              </ul>
            </section>

            <section id="purpose" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">2. 情報の利用目的</h2>
              <ul className="list-disc space-y-1.5 pl-5">
                <li>本サービスの提供・運営</li>
                <li>ユーザーの試算データの保存・表示</li>
                <li>サービスの改善・不具合対応</li>
                <li>利用状況の統計・分析（個人を特定しない形式）</li>
              </ul>
            </section>

            <section id="simulator" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">3. 簡易シミュレーターでのデータ取り扱い</h2>
              <p>
                ログインせずに利用する簡易シミュレーターでは、入力データはブラウザ内で処理され、
                サーバーに送信・保存されません。ブラウザを閉じるとデータは消去されます。
              </p>
            </section>

            <section id="third-party" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">4. 第三者提供</h2>
              <p>
                法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
              </p>
            </section>

            <section id="cookies" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">5. Cookieの使用</h2>
              <p>
                本サービスでは、ログイン状態の維持および利用状況の分析のためにCookieを使用する場合があります。
                ブラウザの設定でCookieを無効にすることができますが、一部の機能が制限される場合があります。
              </p>
            </section>

            <section id="changes" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">6. ポリシーの変更</h2>
              <p>
                本ポリシーの内容は、法令の変更やサービスの改善に伴い、予告なく変更される場合があります。
                変更後のポリシーは本ページに掲載した時点で効力を生じます。
              </p>
            </section>

            <section id="retention" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">7. データの保管期間</h2>
              <p>
                ユーザーがアカウントを削除した場合、個人情報は速やかに削除されます。
                ただし、法令に基づく保存義務がある場合はこの限りではありません。
                アクセスログは最大90日間保存されます。
              </p>
            </section>

            <section id="contact" className="scroll-mt-20">
              <h2 className="text-lg font-semibold text-foreground mb-3">8. お問い合わせ</h2>
              <p>
                個人情報の取り扱いに関するお問い合わせは、
                <a href="/contact" className="text-primary underline hover:no-underline">お問い合わせページ</a>
                よりご連絡ください。
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
