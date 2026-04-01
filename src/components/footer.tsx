import Link from 'next/link';

export function Footer() {
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
              登録不要・無料のクラウド型シミュレーター。
            </p>
          </div>
          <div>
            <h3 className="font-semibold text-sm mb-3">サービス</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li><Link href="/simulator" className="hover:text-foreground transition-colors">P点シミュレーター</Link></li>
              <li><Link href="#features" className="hover:text-foreground transition-colors">機能一覧</Link></li>
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
            <h3 className="font-semibold text-sm mb-3">法的事項</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
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
