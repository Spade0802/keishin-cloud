import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: 'Y点（経営状況分析）の計算方法と改善策',
  description:
    'Y点の8つの財務指標の計算方法、各指標の上限・下限、Y点を上げるための具体的な改善策を経審の専門知識とともに解説します。',
};

export default function YScoreGuidePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold sm:text-4xl">
            Y点（経営状況分析）の計算方法と改善策
          </h1>
          <p className="mt-4 text-muted-foreground">
            経審のY点を構成する8つの財務指標の計算方法と、Y点を効率よく上げるための具体的な改善策を解説します。
          </p>

          <div className="mt-8 prose prose-gray max-w-none">
            <h2 className="text-2xl font-bold mt-10 mb-4">Y点とは</h2>
            <p className="leading-relaxed text-muted-foreground">
              Y点（経営状況分析）は、経営事項審査のP点を構成する5つの要素のひとつで、ウェイトは20%です。
              登録経営状況分析機関（ワイズ公共データシステム、日本建設情報センター等）が、建設業者の財務諸表から8つの財務指標を算出し、経営状況を客観的に評価します。
            </p>
            <p className="leading-relaxed text-muted-foreground mt-3">
              Y点は0〜1595点の範囲で、全業種共通のスコアです。財務体質の改善によって比較的短期間で点数を上げやすい項目であり、多くの建設業者がY点対策に注力しています。
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4">Y点の計算式</h2>
            <p className="leading-relaxed text-muted-foreground">
              Y点は、8つの財務指標から中間値Aを算出し、最終的なスコアに変換します。
            </p>

            <div className="my-6 p-4 bg-muted/50 rounded-lg space-y-2">
              <p className="font-mono text-sm font-bold">
                A = −0.4650×x1 − 0.0508×x2 + 0.0264×x3 + 0.0277×x4
              </p>
              <p className="font-mono text-sm font-bold ml-6">
                + 0.0011×x5 + 0.0089×x6 + 0.0818×x7 + 0.0172×x8 + 0.1906
              </p>
              <p className="font-mono text-sm font-bold mt-2">
                Y = floor(167.3 × A + 583)
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                ※ Y点は0以上1595以下にクランプされます
              </p>
            </div>

            <h2 className="text-2xl font-bold mt-10 mb-4">8つの財務指標の詳細</h2>
            <p className="leading-relaxed text-muted-foreground mb-4">
              各指標には上限値と下限値があり、範囲外の値はクランプされます。A係数の符号（+/-）により、指標値が大きいほど良い項目と小さいほど良い項目があります。
            </p>

            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">指標</th>
                    <th className="py-2 text-left">名称</th>
                    <th className="py-2 text-left">計算式</th>
                    <th className="py-2 text-right">下限</th>
                    <th className="py-2 text-right">上限</th>
                    <th className="py-2 text-center">方向</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    {
                      key: 'x1',
                      name: '純支払利息比率',
                      formula: '(支払利息−受取利息配当金)/売上高×100',
                      min: '−0.3%',
                      max: '5.1%',
                      direction: '↓低い方が良い',
                    },
                    {
                      key: 'x2',
                      name: '負債回転期間',
                      formula: '(流動負債+固定負債)/(売上高÷12)',
                      min: '0.9月',
                      max: '18.0月',
                      direction: '↓低い方が良い',
                    },
                    {
                      key: 'x3',
                      name: '総資本売上総利益率',
                      formula: '売上総利益/総資本(2期平均)×100',
                      min: '6.5%',
                      max: '63.6%',
                      direction: '↑高い方が良い',
                    },
                    {
                      key: 'x4',
                      name: '売上高経常利益率',
                      formula: '経常利益/売上高×100',
                      min: '−8.5%',
                      max: '5.1%',
                      direction: '↑高い方が良い',
                    },
                    {
                      key: 'x5',
                      name: '自己資本対固定資産比率',
                      formula: '自己資本/固定資産×100',
                      min: '−76.5%',
                      max: '350.0%',
                      direction: '↑高い方が良い',
                    },
                    {
                      key: 'x6',
                      name: '自己資本比率',
                      formula: '自己資本/総資本×100',
                      min: '−68.6%',
                      max: '68.5%',
                      direction: '↑高い方が良い',
                    },
                    {
                      key: 'x7',
                      name: '営業キャッシュフロー',
                      formula: '営業CF(2期平均)/1億',
                      min: '−10.0億',
                      max: '15.0億',
                      direction: '↑高い方が良い',
                    },
                    {
                      key: 'x8',
                      name: '利益剰余金',
                      formula: '利益剰余金/1億',
                      min: '−3.0億',
                      max: '100.0億',
                      direction: '↑高い方が良い',
                    },
                  ].map((item) => (
                    <tr key={item.key} className="border-b">
                      <td className="py-2 font-mono font-medium">{item.key}</td>
                      <td className="py-2">{item.name}</td>
                      <td className="py-2 text-xs text-muted-foreground">{item.formula}</td>
                      <td className="py-2 text-right">{item.min}</td>
                      <td className="py-2 text-right">{item.max}</td>
                      <td className="py-2 text-center text-xs">{item.direction}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-bold mt-10 mb-4">Y点を上げるための改善策</h2>

            <div className="grid gap-4 my-8">
              {[
                {
                  title: '1. 借入金の圧縮（x1・x2改善）',
                  desc: '支払利息の削減は純支払利息比率（x1）に直結します。金利交渉や借換、繰上返済で負債を圧縮しましょう。負債回転期間（x2）も同時に改善されます。',
                  impact: 'x1はA係数が−0.465と最も影響が大きい指標です。',
                },
                {
                  title: '2. 利益率の向上（x3・x4改善）',
                  desc: '売上総利益率を高めるには、原価管理の徹底と適正な受注単価の確保が重要です。経常利益率は営業外収益の確保や経費削減で改善できます。',
                  impact: '受注時の利益率管理が最も効果的な対策です。',
                },
                {
                  title: '3. 自己資本の充実（x5・x6改善）',
                  desc: '増資や内部留保の充実で自己資本を厚くします。役員借入金の資本への振替（DES）も有効な手段です。不要な固定資産の売却でx5も改善します。',
                  impact: '長期的な財務体質の改善につながります。',
                },
                {
                  title: '4. キャッシュフロー経営（x7改善）',
                  desc: '営業CFは2期平均で評価されます。売掛金の早期回収、在庫の適正化、支払サイトの見直しでキャッシュフローを改善しましょう。',
                  impact: 'x7はA係数0.0818で、x1に次いで影響の大きい指標です。',
                },
                {
                  title: '5. 利益剰余金の積み上げ（x8改善）',
                  desc: '毎年の利益を配当せず内部留保として積み上げます。上限が100億円と幅広く、着実な利益計上が長期的な改善につながります。',
                  impact: '中小企業では比較的改善しやすい指標です。',
                },
              ].map((item) => (
                <Card key={item.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">{item.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                    <p className="text-xs text-blue-600 mt-2">{item.impact}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <h2 className="text-2xl font-bold mt-10 mb-4">Y点対策の決算時のポイント</h2>
            <ul className="list-disc list-inside space-y-2 text-muted-foreground">
              <li>決算期末の預金残高を増やす（借入金を一時返済→決算後に再借入はNG）</li>
              <li>未成工事支出金・未収入金の精査で資産の実態を反映する</li>
              <li>減価償却は必ず実施する（未実施は他の指標に悪影響）</li>
              <li>役員報酬の適正化（過度な報酬はx4を悪化させる）</li>
              <li>不要な固定資産・在庫の処分で総資本を圧縮する</li>
            </ul>
          </div>

          <div className="mt-12 text-center">
            <Link href="/login">
              <Button size="lg">
                <Calculator className="mr-2 h-5 w-5" />
                登録して始める
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
