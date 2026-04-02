import type { Metadata } from 'next';
import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Calculator, ArrowRight } from 'lucide-react';

export const metadata: Metadata = {
  title: '経営事項審査（経審）とは？わかりやすく解説',
  description:
    '経営事項審査（経審）の仕組み、P点の計算方法、X1・X2・Y・Z・W各評点の意味を建設業の経営者・行政書士向けにわかりやすく解説します。',
};

export default function KeishinGuidePage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        <article className="mx-auto max-w-3xl px-4 py-12 sm:px-6 lg:px-8">
          <h1 className="text-3xl font-bold sm:text-4xl">
            経営事項審査（経審）とは？わかりやすく解説
          </h1>
          <p className="mt-4 text-muted-foreground">
            公共工事の入札に必要な経営事項審査の仕組みを、計算方法まで含めて詳しく解説します。
          </p>

          <div className="mt-8 prose prose-gray max-w-none">
            <h2 className="text-2xl font-bold mt-10 mb-4">経営事項審査とは</h2>
            <p className="leading-relaxed text-muted-foreground">
              経営事項審査（通称「経審」）は、建設業法第27条の23に基づき、公共工事を発注者から直接請け負おうとする建設業者が必ず受けなければならない審査です。
              建設業者の経営力、技術力、社会的信用を客観的に評価し、公共工事の入札参加資格の基礎となる指標を算出します。
            </p>

            <h2 className="text-2xl font-bold mt-10 mb-4">P点（総合評定値）とは</h2>
            <p className="leading-relaxed text-muted-foreground">
              P点は、経審の最終的な評価結果を表す総合的なスコアです。以下の5つの要素から算出されます：
            </p>

            <div className="my-6 p-4 bg-muted/50 rounded-lg text-center">
              <p className="font-mono text-lg font-bold">
                P = 0.25×X1 + 0.15×X2 + 0.20×Y + 0.25×Z + 0.15×W
              </p>
            </div>

            <div className="grid gap-4 my-8 sm:grid-cols-2">
              {[
                {
                  title: 'X1（完成工事高）',
                  weight: '25%',
                  desc: '年間の完成工事高を業種別に評価。2年平均または3年平均を選択可能。',
                },
                {
                  title: 'X2（自己資本額・利益額）',
                  weight: '15%',
                  desc: 'X21（自己資本額＝純資産合計）とX22（利払後事業利益額）の平均。',
                },
                {
                  title: 'Y（経営状況）',
                  weight: '20%',
                  desc: '8つの財務指標から算出。登録経営状況分析機関が審査。',
                },
                {
                  title: 'Z（技術力）',
                  weight: '25%',
                  desc: 'Z1（技術職員の資格と人数）とZ2（元請完成工事高）から算出。',
                },
                {
                  title: 'W（社会性等）',
                  weight: '15%',
                  desc: '社会保険加入、営業年数、ISO取得、若年技術者育成など多岐にわたる項目。',
                },
              ].map((item) => (
                <Card key={item.title}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">{item.title}（ウェイト{item.weight}）</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <h2 className="text-2xl font-bold mt-10 mb-4">Y点の8つの財務指標</h2>
            <p className="leading-relaxed text-muted-foreground">
              Y点は経営状況を評価する指標で、以下の8つの財務比率から計算されます：
            </p>
            <div className="overflow-x-auto my-6">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="py-2 text-left">指標</th>
                    <th className="py-2 text-left">名称</th>
                    <th className="py-2 text-right">下限</th>
                    <th className="py-2 text-right">上限</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ['x1', '純支払利息比率', '-0.3%', '5.1%'],
                    ['x2', '負債回転期間', '0.9月', '18.0月'],
                    ['x3', '総資本売上総利益率', '6.5%', '63.6%'],
                    ['x4', '売上高経常利益率', '-8.5%', '5.1%'],
                    ['x5', '自己資本対固定資産比率', '-76.5%', '350.0%'],
                    ['x6', '自己資本比率', '-68.6%', '68.5%'],
                    ['x7', '営業キャッシュフロー', '-10.0億', '15.0億'],
                    ['x8', '利益剰余金', '-3.0億', '100.0億'],
                  ].map(([key, name, min, max]) => (
                    <tr key={key} className="border-b">
                      <td className="py-2 font-mono">{key}</td>
                      <td className="py-2">{name}</td>
                      <td className="py-2 text-right">{min}</td>
                      <td className="py-2 text-right">{max}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <h2 className="text-2xl font-bold mt-10 mb-4">経審の流れ</h2>
            <ol className="list-decimal list-inside space-y-3 text-muted-foreground">
              <li><strong>決算書の準備</strong> — 直近の事業年度の貸借対照表（BS）、損益計算書（PL）、完成工事原価報告書を用意</li>
              <li><strong>経営状況分析（Y点）</strong> — 登録経営状況分析機関に申請。財務諸表から8指標を算出</li>
              <li><strong>経営規模等評価（X/Z/W）</strong> — 許可行政庁（都道府県知事または国土交通大臣）に申請</li>
              <li><strong>総合評定値（P点）の算出</strong> — X1・X2・Y・Z・Wからの自動計算</li>
              <li><strong>結果通知書の交付</strong> — 審査後、結果通知書が交付される（有効期間1年7ヶ月）</li>
            </ol>

            <h2 className="text-2xl font-bold mt-10 mb-4">経審が必要な建設業者</h2>
            <p className="leading-relaxed text-muted-foreground">
              公共工事（国、地方公共団体、公社等が発注する建設工事）を元請として直接請け負う場合、経審を受けることが義務付けられています。
              下請として公共工事に参加する場合は不要ですが、入札参加資格を得るためには経審結果が必須です。
            </p>
            <p className="leading-relaxed text-muted-foreground mt-4">
              約14万社の建設業者が毎年経審を受けており、P点は入札参加のランク分け（A・B・C・D等）に直結する重要な指標です。
            </p>
          </div>

          <div className="mt-12 text-center">
            <Link href="/trial">
              <Button size="lg">
                <Calculator className="mr-2 h-5 w-5" />
                P点を無料で試算する
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
