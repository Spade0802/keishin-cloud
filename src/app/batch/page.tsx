import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Building2, ArrowLeft, Upload, BarChart3, FileSpreadsheet } from 'lucide-react';

export const metadata: Metadata = {
  title: '一括シミュレーション',
};

export default function BatchSimulationPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1">
        <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-4">
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
              ダッシュボードに戻る
            </Link>
          </div>

          <div className="text-center mb-10">
            <Badge variant="secondary" className="mb-4">
              準備中
            </Badge>
            <h1 className="text-3xl font-bold tracking-tight mb-3">
              一括シミュレーション
            </h1>
            <p className="text-muted-foreground max-w-xl mx-auto">
              複数法人の経審P点を一括で試算・比較できる機能を準備しています。
              行政書士事務所など、多数のクライアントを担当される方に最適です。
            </p>
          </div>

          <Card className="border-dashed border-2 mb-8">
            <CardContent className="py-10 text-center">
              <Building2 className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
              <p className="text-lg font-semibold text-muted-foreground mb-2">
                一括シミュレーション（準備中）
              </p>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                この機能は現在開発中です。リリース時にお知らせします。
              </p>
            </CardContent>
          </Card>

          <div className="space-y-4">
            <h2 className="text-lg font-semibold">予定している機能</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <Card>
                <CardContent className="pt-5 pb-4">
                  <Upload className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">一括アップロード</h3>
                  <p className="text-xs text-muted-foreground">
                    複数法人の決算書をまとめてアップロードし、一度に処理
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <BarChart3 className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">法人間比較</h3>
                  <p className="text-xs text-muted-foreground">
                    複数法人のP点・各指標を横並びで比較表示
                  </p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-5 pb-4">
                  <FileSpreadsheet className="h-6 w-6 text-primary mb-2" />
                  <h3 className="font-semibold text-sm mb-1">一括エクスポート</h3>
                  <p className="text-xs text-muted-foreground">
                    全法人の試算結果をExcelファイルにまとめて出力
                  </p>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-10 text-center">
            <Link href="/dashboard">
              <Button variant="outline">
                ダッシュボードに戻る
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
