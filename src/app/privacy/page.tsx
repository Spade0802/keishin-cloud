import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';

export const metadata: Metadata = {
  title: 'プライバシーポリシー',
};

export default function PrivacyPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold sm:text-3xl mb-8">プライバシーポリシー</h1>

          <div className="prose prose-sm max-w-none space-y-6 text-muted-foreground">
            <p className="text-foreground">
              KeishinCloud（以下「本サービス」）は、ユーザーのプライバシーを尊重し、
              個人情報の保護に努めます。本ポリシーは、本サービスにおける個人情報の取り扱いについて定めます。
            </p>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">1. 収集する情報</h2>
              <p>本サービスでは、以下の情報を収集する場合があります。</p>
              <ul className="list-disc list-inside space-y-1 mt-2">
                <li>Googleアカウント連携時のメールアドレス、表示名</li>
                <li>試算に入力された財務データ（アカウント登録時のみサーバー保存）</li>
                <li>アクセスログ（IPアドレス、ブラウザ情報、アクセス日時）</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">2. 情報の利用目的</h2>
              <ul className="list-disc list-inside space-y-1">
                <li>本サービスの提供・運営</li>
                <li>ユーザーの試算データの保存・表示</li>
                <li>サービスの改善・不具合対応</li>
                <li>利用状況の統計・分析（個人を特定しない形式）</li>
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">3. 簡易シミュレーターでのデータ取り扱い</h2>
              <p>
                ログインせずに利用する簡易シミュレーターでは、入力データはブラウザ内で処理され、
                サーバーに送信・保存されません。ブラウザを閉じるとデータは消去されます。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">4. 第三者提供</h2>
              <p>
                法令に基づく場合を除き、ユーザーの同意なく個人情報を第三者に提供することはありません。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">5. Cookieの使用</h2>
              <p>
                本サービスでは、ログイン状態の維持および利用状況の分析のためにCookieを使用する場合があります。
                ブラウザの設定でCookieを無効にすることができますが、一部の機能が制限される場合があります。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">6. ポリシーの変更</h2>
              <p>
                本ポリシーの内容は、法令の変更やサービスの改善に伴い、予告なく変更される場合があります。
                変更後のポリシーは本ページに掲載した時点で効力を生じます。
              </p>
            </section>

            <section>
              <h2 className="text-lg font-semibold text-foreground mt-8 mb-3">7. お問い合わせ</h2>
              <p>
                個人情報の取り扱いに関するお問い合わせは、本サービスのサポート窓口までご連絡ください。
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
