import type { Metadata } from 'next';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Badge } from '@/components/ui/badge';

export const metadata: Metadata = {
  title: '更新履歴 | KeishinCloud',
  description: 'KeishinCloudの最新アップデートと改善履歴',
};

interface ChangelogEntry {
  version: string;
  date: string;
  tags: Array<'new' | 'improvement' | 'fix'>;
  title: string;
  description?: string;
  items: string[];
}

const tagLabels: Record<'new' | 'improvement' | 'fix', string> = {
  new: '新機能',
  improvement: '改善',
  fix: '修正',
};

const tagDotColors: Record<'new' | 'improvement' | 'fix', string> = {
  new: 'border-green-500 bg-green-50 dark:bg-green-950',
  improvement: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
  fix: 'border-amber-500 bg-amber-50 dark:bg-amber-950',
};

const tagBadgeColors: Record<'new' | 'improvement' | 'fix', string> = {
  new: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  improvement: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  fix: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr + 'T00:00:00');
  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

const changelog: ChangelogEntry[] = [
  {
    version: 'v0.36',
    date: '2026-04-06',
    tags: ['improvement'],
    title: 'モバイル最適化とバリデーション強化',
    description: 'スマートフォン・タブレットでの操作性を大幅に向上し、入力バリデーションの品質を強化しました。',
    items: [
      'モバイルレスポンシブ対応の全面改善',
      'バリデーション関数の抽出・共通化',
      'テストスイートを516件に拡充',
      'タッチ操作時のフィードバック改善',
    ],
  },
  {
    version: 'v0.35',
    date: '2026-04-05',
    tags: ['improvement', 'fix'],
    title: '入力ウィザード改善',
    description: 'ステップバイステップの入力フローを見直し、ユーザーの入力ミスを未然に防ぐ仕組みを導入しました。',
    items: [
      '推奨設定のプリセット機能',
      'リアルタイムバリデーション',
      '入力値の重複チェック',
      'ステップ間のデータ保持の安定化',
    ],
  },
  {
    version: 'v0.34',
    date: '2026-04-04',
    tags: ['new'],
    title: '結果表示の大幅強化',
    description: 'シミュレーション結果の可視化を刷新し、AI による改善提案機能を追加しました。',
    items: [
      '前期比較チャートの追加',
      'AI改善提案機能',
      'アクセシビリティ対応強化（WCAG 2.1 AA準拠）',
      'スケルトンローディング対応',
    ],
  },
  {
    version: 'v0.33',
    date: '2026-04-03',
    tags: ['fix'],
    title: 'パフォーマンスと安定性の改善',
    description: '大規模データ処理時のパフォーマンスボトルネックを解消し、全体的な安定性を向上しました。',
    items: [
      '大量データ処理時のメモリ使用量を40%削減',
      'APIレスポンスタイムの改善（平均200ms短縮）',
      'セッションタイムアウト時のデータ消失を防止',
      'エラー発生時のリカバリフローを整備',
    ],
  },
  {
    version: 'v0.32',
    date: '2026-04-02',
    tags: ['new'],
    title: 'ユーザー設定ページ',
    description: 'アカウント管理機能を一元化し、個人設定をカスタマイズできるようになりました。',
    items: [
      'プロフィール編集機能',
      'テーマ切替（ライト/ダーク/システム追従）',
      '通知設定（メール・プッシュ）',
      'セッション管理と強制ログアウト',
    ],
  },
  {
    version: 'v0.31',
    date: '2026-04-01',
    tags: ['new'],
    title: '通知基盤と監査ログ',
    description: 'エンタープライズ向けの監査ログ機能と、リアルタイム通知基盤を構築しました。',
    items: [
      '通知システムの基盤構築（WebSocket対応）',
      '監査ログの強化（操作履歴の完全記録）',
      'パフォーマンス計測機能',
      'エラー追跡の改善（Sentry連携）',
    ],
  },
  {
    version: 'v0.30',
    date: '2026-03-31',
    tags: ['fix', 'improvement'],
    title: 'バグ修正とUI改善',
    description: 'ユーザーフィードバックに基づく細かなバグ修正とUI改善を実施しました。',
    items: [
      'ダッシュボードのグラフ描画が特定条件で崩れる問題を修正',
      'ダークモード時のコントラスト比を改善',
      'フォーム送信時の二重送信防止',
      'ページ遷移時のちらつきを解消',
    ],
  },
  {
    version: 'v0.29',
    date: '2026-03-30',
    tags: ['new'],
    title: 'シミュレーション比較機能',
    description: '複数のシミュレーション結果を横並びで比較し、最適なシナリオを選択できるようになりました。',
    items: [
      '複数シナリオの並列比較（最大4件）',
      '結果のクリップボードコピー',
      'PDF出力の改善（カスタムヘッダー対応）',
      '比較結果のブックマーク機能',
    ],
  },
  {
    version: 'v0.28',
    date: '2026-03-29',
    tags: ['improvement'],
    title: 'オンボーディングとヘルプ',
    description: '初めてのユーザーがスムーズにサービスを利用開始できるよう、ガイド機能を充実させました。',
    items: [
      '初回利用ガイドの追加（インタラクティブツアー）',
      'コンテキストヘルプパネル',
      'パンくずリストナビゲーション',
      'FAQ検索機能の追加',
    ],
  },
  {
    version: 'v0.27',
    date: '2026-03-28',
    tags: ['new'],
    title: '管理画面と料金プラン',
    description: '管理者向け機能を大幅に強化し、料金プランの比較・選択UIを新設しました。',
    items: [
      '管理画面の機能強化（ユーザー一覧・権限管理）',
      'ヘルスチェックエンドポイント',
      'API仕様書の整備（OpenAPI 3.1対応）',
      '料金プラン比較表',
    ],
  },
  {
    version: 'v0.26',
    date: '2026-03-27',
    tags: ['improvement'],
    title: 'デモ体験の強化',
    description: '未登録ユーザーでも主要機能を体験できるデモ環境を改善しました。',
    items: [
      'インタラクティブデモの改善',
      'フルパイプラインテストの追加',
      'ランディングページの改善',
      'デモデータのリアルタイム生成',
    ],
  },
  {
    version: 'v0.25',
    date: '2026-03-26',
    tags: ['new', 'improvement'],
    title: 'バッチ処理とCSVインポート',
    description: '複数件のシミュレーションを一括で実行できるバッチ処理機能を追加しました。',
    items: [
      'CSVファイルからの一括インポート',
      'バッチ処理の進捗表示',
      '処理結果のまとめてダウンロード',
      'エラー行のスキップと通知',
    ],
  },
  {
    version: 'v0.24',
    date: '2026-03-25',
    tags: ['fix'],
    title: 'セキュリティ修正',
    description: '定期セキュリティ監査で発見された問題を修正しました。',
    items: [
      'CSRFトークン検証の強化',
      'レートリミットの適用範囲を拡大',
      '入力サニタイズの見直し',
      '依存パッケージのセキュリティアップデート',
    ],
  },
  {
    version: 'v0.22',
    date: '2026-03-23',
    tags: ['fix'],
    title: 'セキュリティとSEO',
    description: 'Webアプリケーションのセキュリティ強化と検索エンジン最適化を実施しました。',
    items: [
      'セキュリティヘッダーの追加（CSP, HSTS）',
      'エッジケーステストの拡充',
      'SEOメタタグの最適化',
      'robots.txt / sitemap.xml の自動生成',
    ],
  },
  {
    version: 'v0.20',
    date: '2026-03-21',
    tags: ['new'],
    title: '初回リリース',
    description: 'KeishinCloud の最初の公開ベータ版をリリースしました。',
    items: [
      '経審シミュレーション基本機能',
      'ユーザー認証・登録フロー',
      'ダッシュボード基本レイアウト',
      'レスポンシブデザイン対応',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <Header />
      <main className="flex-1" id="top">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <header className="mb-12">
            <h1 className="text-2xl font-bold sm:text-3xl mb-2">更新履歴</h1>
            <p className="text-muted-foreground">
              KeishinCloudの最新アップデートと改善をお知らせします。
            </p>
            <nav aria-label="バージョンジャンプ" className="mt-4 flex flex-wrap gap-2">
              {changelog.map((entry) => (
                <a
                  key={entry.version}
                  href={`#${entry.version}`}
                  className="text-xs font-mono text-muted-foreground hover:text-foreground transition-colors underline underline-offset-2"
                >
                  {entry.version}
                </a>
              ))}
            </nav>
          </header>

          <section className="relative" aria-label="バージョン履歴">
            {/* Timeline connector line */}
            <div
              className="absolute left-[7px] top-2 bottom-0 w-px bg-gradient-to-b from-primary via-border to-transparent"
              aria-hidden="true"
            />

            <div className="space-y-12">
              {changelog.map((entry, index) => (
                <article
                  key={entry.version}
                  id={entry.version}
                  className="relative pl-10 scroll-mt-24"
                >
                  {/* Timeline dot — color matches the primary tag */}
                  <div
                    className={`absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 ${tagDotColors[entry.tags[0]]} shadow-sm`}
                    aria-hidden="true"
                  />

                  {/* "Latest" indicator for first entry */}
                  {index === 0 && (
                    <div
                      className="absolute left-[-3px] top-[-2px] h-[21px] w-[21px] rounded-full border-2 border-primary/30 animate-ping"
                      aria-hidden="true"
                    />
                  )}

                  <div className="flex flex-wrap items-center gap-2 mb-1">
                    <span className="font-mono text-sm font-bold tracking-tight">
                      {entry.version}
                    </span>
                    {entry.tags.map((tag) => (
                      <Badge key={tag} className={`${tagBadgeColors[tag]} border-0 text-[10px] uppercase tracking-wider`}>
                        {tagLabels[tag]}
                      </Badge>
                    ))}
                    {index === 0 && (
                      <Badge className="bg-primary text-primary-foreground border-0 text-[10px] uppercase tracking-wider">
                        最新
                      </Badge>
                    )}
                    <time
                      className="ml-auto text-xs text-muted-foreground tabular-nums"
                      dateTime={entry.date}
                    >
                      {formatDate(entry.date)}
                    </time>
                  </div>

                  <h2 className="text-base font-semibold mb-1">{entry.title}</h2>

                  {entry.description && (
                    <p className="text-sm text-muted-foreground mb-3">{entry.description}</p>
                  )}

                  <ul className="space-y-1.5 text-sm text-muted-foreground" role="list">
                    {entry.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span
                          className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0"
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </section>

          {/* Back to top */}
          <div className="mt-16 pt-8 border-t border-border text-center">
            <a
              href="#top"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="m18 15-6-6-6 6" />
              </svg>
              ページの先頭に戻る
            </a>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
