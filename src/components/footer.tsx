'use client';

import Link from 'next/link';
import { useSession } from '@/lib/session-context';

export function Footer() {
  const session = useSession();
  // session?.user が空オブジェクト {} の場合にも対応するため、id または email の存在で判定
  const isLoggedIn = !!(session?.user?.email || session?.user?.id);

  return (
    <footer className="border-t bg-muted/30">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
                K
              </div>
              <span className="font-bold">KeishinCloud</span>
            </div>
            <p className="text-sm text-muted-foreground">
              建設業の経審P点をブラウザで即試算。
              クラウド型シミュレーター。
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-3">サービス</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/demo" className="hover:text-foreground transition-colors">デモ</Link></li>
              <li><Link href="/pricing" className="hover:text-foreground transition-colors">料金</Link></li>
              {isLoggedIn && (
                <>
                  <li><Link href="/trial" className="hover:text-foreground transition-colors">新規試算</Link></li>
                  <li><Link href="/verification" className="hover:text-foreground transition-colors">実績突合</Link></li>
                  <li><Link href="/comparison" className="hover:text-foreground transition-colors">前期比較表</Link></li>
                  <li><Link href="/reclassification" className="hover:text-foreground transition-colors">再分類分析</Link></li>
                </>
              )}
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-3">経審ガイド</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/guide/keishin" className="hover:text-foreground transition-colors">経審とは</Link></li>
              <li><Link href="/guide/y-score" className="hover:text-foreground transition-colors">Y点の計算方法</Link></li>
              <li><Link href="/guide/score-up" className="hover:text-foreground transition-colors">P点を上げる方法</Link></li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-3">サポート</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/contact" className="hover:text-foreground transition-colors">お問い合わせ</Link></li>
              <li><Link href="/changelog" className="hover:text-foreground transition-colors">更新履歴</Link></li>
              <li><Link href="/privacy" className="hover:text-foreground transition-colors">プライバシーポリシー</Link></li>
              <li><Link href="/terms" className="hover:text-foreground transition-colors">利用規約</Link></li>
            </ul>
          </div>
        </div>
        <div className="mt-8 border-t pt-6 text-center text-xs text-muted-foreground">
          <p>本サービスの試算結果は参考値であり、公式の経営事項審査結果通知書ではありません。</p>
          <p className="mt-2">&copy; {new Date().getFullYear()} KeishinCloud. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}
