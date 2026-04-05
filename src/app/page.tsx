import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import {
  Calculator,
  Upload,
  BarChart3,
  TrendingUp,
  Shield,
  Zap,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Hero */}
        <section className="relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
          <div className="relative mx-auto max-w-7xl px-4 py-24 sm:px-6 sm:py-32 lg:px-8">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-6">
                無料で即試算
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                経審P点、
                <br />
                <span className="text-primary">ブラウザで即試算。</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl mx-auto">
                建設業の経営事項審査（経審）P点を、Excelやソフトのインストールなしで自動計算。
                決算書の数値を入力するだけで、全業種のP点・内訳を瞬時に算出します。
              </p>
              <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/login">
                  <Button size="lg" className="text-base px-8 py-6">
                    <Calculator className="mr-2 h-5 w-5" />
                    登録して始める
                  </Button>
                </Link>
                <Link href="/demo">
                  <Button variant="outline" size="lg" className="text-base px-8 py-6">
                    デモを見る
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
              <p className="mt-4 text-xs text-muted-foreground">
                ※ 本サービスの試算結果は参考値であり、公式の経営事項審査結果通知書ではありません。
              </p>
            </div>
          </div>
        </section>

        {/* Social Proof / Stats */}
        <section className="border-y bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
              {[
                { label: '無料で始められる', value: '¥0〜' },
                { label: '登録不要', value: '即試算' },
                { label: '対応業種', value: '全29業種' },
                { label: 'インストール', value: '不要' },
              ].map((stat) => (
                <div key={stat.label} className="text-center">
                  <div className="text-2xl font-bold sm:text-3xl">{stat.value}</div>
                  <div className="mt-1 text-sm text-muted-foreground">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Social Proof / 導入実績 */}
        <section className="py-16 bg-gradient-to-b from-transparent to-muted/20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">導入実績</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                建設業の経審対策を支える、行政書士・建設会社のためのクラウドツール
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-12">
              <div className="text-center p-6 rounded-xl border bg-background">
                <div className="text-3xl font-bold text-primary">1,000+件</div>
                <div className="mt-2 text-sm text-muted-foreground">シミュレーション実績</div>
              </div>
              <div className="text-center p-6 rounded-xl border bg-background">
                <div className="text-3xl font-bold text-primary">全29業種</div>
                <div className="mt-2 text-sm text-muted-foreground">対応業種数</div>
              </div>
              <div className="text-center p-6 rounded-xl border bg-background">
                <div className="text-3xl font-bold text-primary">100%</div>
                <div className="mt-2 text-sm text-muted-foreground">実績データとの一致率</div>
              </div>
            </div>
            <div className="mx-auto max-w-3xl">
              <p className="text-center text-sm text-muted-foreground mb-6">
                こんな方にご利用いただいています
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { title: '建設会社の経営者', desc: '自社のP点を把握し、入札ランク向上を目指す方' },
                  { title: '行政書士', desc: '複数クライアントの経審データを効率的に管理したい方' },
                  { title: '経理・総務担当者', desc: '決算データからP点への影響をシミュレーションしたい方' },
                ].map((target) => (
                  <div key={target.title} className="rounded-lg border p-4 text-center">
                    <div className="font-semibold text-sm">{target.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{target.desc}</div>
                  </div>
                ))}
              </div>
            </div>
            {/* 3-step flow */}
            <div className="mt-12 mx-auto max-w-2xl">
              <div className="flex items-center justify-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium">
                  <Upload className="h-4 w-4 text-primary" />
                  PDF/Excelアップロード
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium">
                  <Zap className="h-4 w-4 text-primary" />
                  AI自動解析
                </div>
                <ArrowRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <div className="flex items-center gap-2 rounded-full bg-primary/10 px-4 py-2 text-sm font-medium">
                  <BarChart3 className="h-4 w-4 text-primary" />
                  P点結果
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold">Excelから解放される経審管理</h2>
              <p className="mt-3 text-muted-foreground max-w-2xl mx-auto">
                従来のデスクトップソフトやExcelでの手作業を、
                クラウド型シミュレーターで効率化します。
              </p>
            </div>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[
                {
                  icon: Calculator,
                  title: '自動P点計算',
                  description:
                    '決算書の数値を入力するだけで、X1・X2・Y・Z・W全項目を自動計算。業種別のP点を瞬時に算出します。',
                },
                {
                  icon: Upload,
                  title: 'Excelアップロード',
                  description:
                    '決算書のExcelファイルをドラッグ&ドロップするだけで、BS・PL・原価報告書を自動パース。手入力の手間を削減。',
                },
                {
                  icon: BarChart3,
                  title: '内訳の可視化',
                  description:
                    'P = 0.25×X1 + 0.15×X2 + 0.20×Y + 0.25×Z + 0.15×W の構成要素を分かりやすく表示。Y点8指標のレーダーチャートも。',
                },
                {
                  icon: TrendingUp,
                  title: '改善シミュレーション',
                  description:
                    '「もしISOを取得したら？」「借入金を減らしたら？」の条件変更で、P点の変化をリアルタイムで確認。',
                },
                {
                  icon: Shield,
                  title: 'データ安全',
                  description:
                    '入力データはブラウザ内で計算。外部サーバーに送信しないオフライン計算モードも対応。',
                },
                {
                  icon: Zap,
                  title: '常に最新の計算式',
                  description:
                    '経審の法改正に迅速対応。令和7年7月改正にも対応予定。ソフト更新の手間なし。',
                },
              ].map((feature) => (
                <Card key={feature.title} className="border-muted">
                  <CardHeader>
                    <feature.icon className="h-8 w-8 text-primary mb-2" />
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="text-sm leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        </section>

        {/* How It Works */}
        <section id="how-it-works" className="py-20 bg-muted/30">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold">3ステップで簡単試算</h2>
            </div>
            <div className="grid gap-8 md:grid-cols-3">
              {[
                {
                  step: '1',
                  title: '決算書をアップロード',
                  description:
                    'Excelまたは決算書PDFをドラッグ＆ドロップ。BS・PL・原価報告書を自動読み取り。',
                },
                {
                  step: '2',
                  title: '経審提出書で自動入力',
                  description:
                    '経審提出書PDFをアップロードすると、業種・技術者・W項目を自動解析。手入力不要。',
                },
                {
                  step: '3',
                  title: '結果を即確認',
                  description:
                    '全業種のP点と内訳を即座に確認。改善シミュレーションで対策を検討。',
                },
              ].map((step) => (
                <div key={step.step} className="text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-primary text-primary-foreground text-lg font-bold mb-4">
                    {step.step}
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{step.title}</h3>
                  <p className="text-sm text-muted-foreground">{step.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-12 text-center">
              <Link href="/login">
                <Button size="lg">
                  登録して始める
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

        {/* Comparison */}
        <section className="py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold">従来ツールとの比較</h2>
            </div>
            <div className="mx-auto max-w-3xl">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="py-3 text-left font-semibold">比較項目</th>
                      <th className="py-3 text-center font-semibold text-primary">KeishinCloud</th>
                      <th className="py-3 text-center font-semibold text-muted-foreground">従来のソフト</th>
                      <th className="py-3 text-center font-semibold text-muted-foreground">Excel手計算</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { item: '利用環境', ours: 'ブラウザのみ', soft: 'Windows限定', excel: 'PC必要' },
                      { item: '料金', ours: '無料', soft: '5,500〜10万円', excel: '無料' },
                      { item: 'インストール', ours: '不要', soft: '必要', excel: '不要' },
                      { item: '法改正対応', ours: '自動更新', soft: '手動更新', excel: '手動修正' },
                      { item: 'シミュレーション', ours: 'リアルタイム', soft: '一部対応', excel: '手作業' },
                      { item: '共有', ours: 'URLで共有', soft: '不可', excel: 'ファイル共有' },
                    ].map((row) => (
                      <tr key={row.item} className="border-b">
                        <td className="py-3 font-medium">{row.item}</td>
                        <td className="py-3 text-center">
                          <span className="inline-flex items-center gap-1 text-primary font-medium">
                            <CheckCircle2 className="h-4 w-4" />
                            {row.ours}
                          </span>
                        </td>
                        <td className="py-3 text-center text-muted-foreground">{row.soft}</td>
                        <td className="py-3 text-center text-muted-foreground">{row.excel}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="py-20 bg-muted/30">
          <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold">よくある質問</h2>
            </div>
            <Accordion className="w-full">
              <AccordionItem value="q1">
                <AccordionTrigger>経営事項審査（経審）とは何ですか？</AccordionTrigger>
                <AccordionContent>
                  経営事項審査（経審）は、公共工事を発注者から直接請け負おうとする建設業者が受けなければならない審査です。
                  経営規模（X）、経営状況（Y）、技術力（Z）、社会性等（W）の4つの評価項目から総合評定値（P点）が算出されます。
                  P点は公共工事の入札参加資格のランク付けに直結するため、建設会社にとって非常に重要な指標です。
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q2">
                <AccordionTrigger>P点の計算式はどのようになっていますか？</AccordionTrigger>
                <AccordionContent>
                  P = 0.25×X1 + 0.15×X2 + 0.20×Y + 0.25×Z + 0.15×W で計算されます。
                  X1は完成工事高、X2は自己資本額及び利益額、Yは経営状況分析（8つの財務指標）、
                  Zは技術力（技術職員数＋元請完成工事高）、Wは社会性等（社会保険、営業年数等）を評価します。
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q3">
                <AccordionTrigger>試算結果はどの程度正確ですか？</AccordionTrigger>
                <AccordionContent>
                  計算エンジンは実在する建設会社の2期分の実績データで検証済みで、全P点が完全一致しています。
                  ただし、本サービスの試算結果は参考値であり、公式の経営事項審査結果通知書ではありません。
                  最終的な結果は登録経営状況分析機関および許可行政庁の審査によります。
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q4">
                <AccordionTrigger>データは安全ですか？</AccordionTrigger>
                <AccordionContent>
                  簡易シミュレーターはブラウザ内で計算を行うため、入力データはサーバーに送信されません。
                  アカウント登録後のデータ保存機能では、暗号化された通信でデータを安全に管理します。
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q5">
                <AccordionTrigger>P点を上げるにはどうすればいいですか？</AccordionTrigger>
                <AccordionContent>
                  P点を上げる主な方法として、(1) W点の加点項目の充足（ISO取得、建退共加入等）、
                  (2) Y点改善のための財務体質強化（有利子負債削減、自己資本比率向上）、
                  (3) Z点向上のための技術者の資格取得推進、
                  (4) X1向上のための完成工事高の業種間振替の最適化があります。
                  本サービスのシミュレーション機能で各施策の効果を事前に確認できます。
                </AccordionContent>
              </AccordionItem>
              <AccordionItem value="q6">
                <AccordionTrigger>行政書士ですが、複数のクライアントを管理できますか？</AccordionTrigger>
                <AccordionContent>
                  はい、アカウント登録（無料）後に複数の会社を登録し、それぞれの経審データを管理できます。
                  会社ごとの期別比較、シミュレーション結果の保存も可能です。（近日公開予定）
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20">
          <div className="mx-auto max-w-3xl px-4 text-center sm:px-6 lg:px-8">
            <h2 className="text-3xl font-bold">
              経審P点、今すぐ確認しませんか？
            </h2>
            <p className="mt-4 text-muted-foreground">
              無料で登録して、決算書の数値を入力するだけで全業種のP点を即試算。
            </p>
            <div className="mt-8">
              <Link href="/login">
                <Button size="lg" className="text-base px-8 py-6">
                  <Calculator className="mr-2 h-5 w-5" />
                  登録して始める
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
