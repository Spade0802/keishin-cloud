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
  tag: 'new' | 'improvement' | 'fix';
  title: string;
  items: string[];
}

const tagLabels: Record<ChangelogEntry['tag'], string> = {
  new: '新機能',
  improvement: '改善',
  fix: '修正',
};

const tagVariants: Record<ChangelogEntry['tag'], string> = {
  new: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  improvement: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  fix: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
};

const changelog: ChangelogEntry[] = [
  {
    version: 'v0.36',
    date: '2026-04-06',
    tag: 'improvement',
    title: 'モバイル最適化とバリデーション強化',
    items: [
      'モバイルレスポンシブ対応の全面改善',
      'バリデーション関数の抽出・共通化',
      'テストスイートを516件に拡充',
    ],
  },
  {
    version: 'v0.35',
    date: '2026-04-05',
    tag: 'improvement',
    title: '入力ウィザード改善',
    items: [
      '推奨設定のプリセット機能',
      'リアルタイムバリデーション',
      '入力値の重複チェック',
    ],
  },
  {
    version: 'v0.34',
    date: '2026-04-04',
    tag: 'new',
    title: '結果表示の大幅強化',
    items: [
      '前期比較チャートの追加',
      'AI改善提案機能',
      'アクセシビリティ対応強化',
      'スケルトンローディング対応',
    ],
  },
  {
    version: 'v0.32',
    date: '2026-04-03',
    tag: 'new',
    title: 'ユーザー設定ページ',
    items: [
      'プロフィール編集機能',
      'テーマ切替（ライト/ダーク）',
      '通知設定',
      'セッション管理',
    ],
  },
  {
    version: 'v0.31',
    date: '2026-04-02',
    tag: 'new',
    title: '通知基盤と監査ログ',
    items: [
      '通知システムの基盤構築',
      '監査ログの強化',
      'パフォーマンス計測機能',
      'エラー追跡の改善',
    ],
  },
  {
    version: 'v0.29',
    date: '2026-04-01',
    tag: 'new',
    title: 'シミュレーション比較機能',
    items: [
      '複数シナリオの並列比較',
      '結果のクリップボードコピー',
      'PDF出力の改善',
    ],
  },
  {
    version: 'v0.28',
    date: '2026-03-31',
    tag: 'improvement',
    title: 'オンボーディングとヘルプ',
    items: [
      '初回利用ガイドの追加',
      'コンテキストヘルプパネル',
      'パンくずリストナビゲーション',
    ],
  },
  {
    version: 'v0.27',
    date: '2026-03-30',
    tag: 'new',
    title: '管理画面と料金プラン',
    items: [
      '管理画面の機能強化',
      'ヘルスチェックエンドポイント',
      'API仕様書の整備',
      '料金プラン比較表',
    ],
  },
  {
    version: 'v0.26',
    date: '2026-03-29',
    tag: 'improvement',
    title: 'デモ体験の強化',
    items: [
      'インタラクティブデモの改善',
      'フルパイプラインテストの追加',
      'ランディングページの改善',
    ],
  },
  {
    version: 'v0.22',
    date: '2026-03-27',
    tag: 'fix',
    title: 'セキュリティとSEO',
    items: [
      'セキュリティヘッダーの追加',
      'エッジケーステストの拡充',
      'SEOメタタグの最適化',
    ],
  },
];

export default function ChangelogPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-2xl font-bold sm:text-3xl mb-2">更新履歴</h1>
          <p className="text-muted-foreground mb-10">
            KeishinCloudの最新アップデートと改善をお知らせします。
          </p>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-[7px] top-2 bottom-0 w-px bg-border" aria-hidden="true" />

            <div className="space-y-10">
              {changelog.map((entry) => (
                <article key={entry.version} className="relative pl-8">
                  {/* Timeline dot */}
                  <div
                    className="absolute left-0 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-primary bg-background"
                    aria-hidden="true"
                  />

                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="font-mono text-sm font-semibold">{entry.version}</span>
                    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${tagVariants[entry.tag]}`}>
                      {tagLabels[entry.tag]}
                    </span>
                    <time className="text-xs text-muted-foreground" dateTime={entry.date}>
                      {entry.date}
                    </time>
                  </div>

                  <h2 className="text-base font-semibold mb-2">{entry.title}</h2>

                  <ul className="space-y-1 text-sm text-muted-foreground">
                    {entry.items.map((item, i) => (
                      <li key={i} className="flex items-start gap-2">
                        <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground/40 shrink-0" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              ))}
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
