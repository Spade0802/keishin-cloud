import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, ArrowRight, CheckCircle } from 'lucide-react';

export const metadata: Metadata = {
  title: '経審P点を上げる方法｜具体的な加点テクニック',
  description:
    '経営事項審査のP点（総合評定値）を効率よく上げるための具体的な方法をX1・X2・Y・Z・W各評点ごとに解説します。',
};

export default function ScoreUpGuidePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold sm:text-4xl">
            経審P点を上げる方法｜具体的な加点テクニック
          </h1>
          <p className="mt-4 text-muted-foreground">
            X1・X2・Y・Z・W各評点の改善方法を網羅的に解説。即効性の高い施策から中長期戦略まで紹介します。
          </p>

          <div className="mt-8 prose prose-gray max-w-none">
            <h2 className="text-2xl font-bold mt-10 mb-4">P点改善の基本戦略</h2>
            <div className="my-6 p-4 bg-muted/50 rounded-lg text-center">
              <p className="font-mono text-lg font-bold">
                P = 0.25×X1 + 0.15×X2 + 0.20×Y + 0.25×Z + 0.15×W
              </p>
            </div>
            <p className="leading-relaxed text-muted-foreground">
              P点改善の鍵は、ウェイトの大きい<strong>X1（25%）</strong>と<strong>Z（25%）</strong>の対策です。
              ただし、X1は完成工事高に依存するため短期的な改善が難しい一方、<strong>W（15%）やY（20%）は比較的即効性が高い</strong>項目です。
              自社の現状を分析し、投資対効果の高い項目から改善しましょう。
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4">X1（完成工事高）を上げる</h2>
            <p className="leading-relaxed text-muted-foreground">
              完成工事高は2年平均と3年平均を選択できます。直近の売上が伸びている場合は2年平均、落ちている場合は3年平均が有利です。
            </p>
            <div className="grid gap-3 my-4">
              <Card>
                <CardContent className="pt-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span><strong>2年平均 vs 3年平均の有利選択</strong>：毎年シミュレーションして有利な方を選択</span></li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span><strong>業種の振り分け最適化</strong>：附帯工事の業種認定を見直し、主力業種に集約</span></li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span><strong>決算期の工事完成タイミング</strong>：可能な範囲で完成時期を調整</span></li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <h2 className="text-2xl font-bold mt-10 mb-4">X2（自己資本額・利益額）を上げる</h2>
            <p className="leading-relaxed text-muted-foreground">
              X2 = (X21 + X22) / 2 で、X21は自己資本額（純資産合計）、X22は利払後事業利益額から算出されます。
            </p>
            <div className="grid gap-3 my-4">
              <Card>
                <CardContent className="pt-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span><strong>増資</strong>：資本金の増額は自己資本を直接増加させる</span></li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span><strong>役員借入金のDES</strong>：デット・エクイティ・スワップで負債を資本に転換</span></li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span><strong>配当の抑制</strong>：利益剰余金の積み上げで純資産を増加</span></li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span><strong>減価償却の適正実施</strong>：EBITDA（X22の元データ）に加算される</span></li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <h2 className="text-2xl font-bold mt-10 mb-4">Y点（経営状況）を上げる</h2>
            <p className="leading-relaxed text-muted-foreground">
              Y点は8つの財務指標から計算されます。特にx1（純支払利息比率）のA係数が最も大きく、支払利息の削減が最も効果的です。
            </p>
            <p className="mt-2">
              <Link href="/guide/y-score" className="text-primary hover:underline">
                → Y点の詳細な計算方法と改善策はこちら
              </Link>
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4">Z（技術力）を上げる</h2>
            <p className="leading-relaxed text-muted-foreground">
              Z = 0.8×Z1 + 0.2×Z2 で、Z1は技術職員数値、Z2は元請完成工事高から算出されます。ウェイト25%と最も大きい項目のひとつです。
            </p>
            <div className="grid gap-3 my-4">
              <Card>
                <CardContent className="pt-4">
                  <ul className="space-y-2 text-sm text-muted-foreground">
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span><strong>1級資格の取得推進</strong>：1級技術者は2級の約5倍のポイント（技士補含む）</span></li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span><strong>監理技術者の確保</strong>：監理技術者証+講習修了で加点</span></li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span><strong>CPD単位の取得</strong>：技術者のCPD取得率に応じてZ1に加算</span></li>
                    <li className="flex gap-2"><CheckCircle className="h-4 w-4 text-green-600 shrink-0 mt-0.5" /><span><strong>元請比率の向上</strong>：Z2は元請完成工事高で評価。JV参加も有効</span></li>
                  </ul>
                </CardContent>
              </Card>
            </div>

            <h2 className="text-2xl font-bold mt-10 mb-4">W（社会性等）を上げる — 即効性の高い加点項目</h2>
            <p className="leading-relaxed text-muted-foreground mb-4">
              W点は対策がしやすく、即効性の高い項目が多いのが特徴です。以下の項目を確認し、取得可能なものは積極的に取り組みましょう。
            </p>

            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">W項目</th>
                    <th className="py-2 text-left">内容</th>
                    <th className="py-2 text-center">難易度</th>
                    <th className="py-2 text-center">効果</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { item: '社会保険加入', desc: '健康保険・厚生年金・雇用保険の加入（必須）', diff: '必須', effect: '減点回避' },
                    { item: '建退共加入', desc: '建設業退職金共済への加入と履行', diff: '★☆☆', effect: '★★★' },
                    { item: '退職一時金制度', desc: '就業規則への退職金規程の設定', diff: '★★☆', effect: '★★☆' },
                    { item: '法定外労災', desc: '法定外労働災害補償制度への加入', diff: '★☆☆', effect: '★★★' },
                    { item: '防災協定', desc: '自治体との災害時応援協定の締結', diff: '★★☆', effect: '★★★' },
                    { item: 'ISO 9001', desc: '品質マネジメントシステム認証取得', diff: '★★★', effect: '★★☆' },
                    { item: 'ISO 14001', desc: '環境マネジメントシステム認証取得', diff: '★★★', effect: '★★☆' },
                    { item: '若年技術者育成', desc: '35歳未満技術者の雇用・育成', diff: '★★☆', effect: '★★☆' },
                    { item: '建設機械保有', desc: '建設機械の自社保有台数', diff: '★★☆', effect: '★★☆' },
                    { item: 'えるぼし認定', desc: '女性活躍推進法に基づく認定', diff: '★★★', effect: '★★☆' },
                    { item: 'くるみん認定', desc: '次世代育成支援対策推進法に基づく認定', diff: '★★★', effect: '★★☆' },
                    { item: 'CPD単位取得', desc: '技術者のCPD単位取得（Zにも影響）', diff: '★★☆', effect: '★★☆' },
                  ].map((row) => (
                    <tr key={row.item} className="border-b">
                      <td className="py-2 font-medium">{row.item}</td>
                      <td className="py-2 text-muted-foreground">{row.desc}</td>
                      <td className="py-2 text-center">{row.diff}</td>
                      <td className="py-2 text-center">{row.effect}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-bold mt-10 mb-4">業種別の戦略</h2>
            <p className="leading-relaxed text-muted-foreground">
              複数の業種許可を持つ場合、P点が最も重要な業種にリソースを集中させることが効果的です。
            </p>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground mt-4">
              <li>主力業種の完成工事高を最大化する（附帯工事の振り分け最適化）</li>
              <li>技術者の業種配置を最適化する（1人の技術者は2業種まで申請可能）</li>
              <li>入札参加のランク（A/B/C/D）のボーダーラインを意識した対策を立てる</li>
              <li>自治体ごとに経審のP点と主観点の配分が異なるため、主要な入札先の評価方法を確認する</li>
            </ul>

            <h2 className="text-2xl font-bold mt-10 mb-4">P点改善のロードマップ</h2>
            <div className="grid gap-4 my-6 sm:grid-cols-3">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-green-700">即効（〜3ヶ月）</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>・建退共加入</li>
                    <li>・法定外労災加入</li>
                    <li>・防災協定締結</li>
                    <li>・2年/3年平均の有利選択</li>
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-blue-700">中期（3〜12ヶ月）</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>・ISO認証取得</li>
                    <li>・1級資格取得</li>
                    <li>・借入金の圧縮</li>
                    <li>・自己資本の充実</li>
                  </ul>
                </CardContent>
              </Card>
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm text-purple-700">長期（1年以上）</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>・元請比率の向上</li>
                    <li>・完成工事高の拡大</li>
                    <li>・財務体質の抜本改善</li>
                    <li>・若年技術者の育成</li>
                  </ul>
                </CardContent>
              </Card>
            </div>
          </div>

          <div className="mt-12 text-center">
            <Link href="/trial">
              <Button size="lg">
                <Calculator className="mr-2 h-5 w-5" />
                改善効果をシミュレーションする
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
