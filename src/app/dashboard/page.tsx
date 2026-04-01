import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/header";
import { Footer } from "@/components/footer";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Calculator,
  FileSpreadsheet,
  Download,
  TrendingUp,
  ArrowRight,
  Building2,
} from "lucide-react";

export const metadata: Metadata = {
  title: "ダッシュボード | KeishinCloud",
};

// Demo data for P-score by industry
const industryScores = [
  { name: "電気", score: 987, prevScore: 941, trend: +46 },
  { name: "管", score: 732, prevScore: 790, trend: -58 },
  { name: "電気通信", score: 733, prevScore: 668, trend: +65 },
  { name: "消防施設", score: 680, prevScore: 656, trend: +24 },
];

// Demo data for common scores
const commonScores = [
  { label: "Y (経営状況)", value: 852 },
  { label: "X2 (自己資本額等)", value: 748 },
  { label: "W (その他審査項目)", value: 1207 },
];

// Demo data for recent calculations
const recentCalculations = [
  {
    id: "1",
    date: "2026-03-28",
    industry: "電気",
    pScore: 987,
    status: "完了",
  },
  {
    id: "2",
    date: "2026-03-25",
    industry: "管",
    pScore: 732,
    status: "完了",
  },
  {
    id: "3",
    date: "2026-03-20",
    industry: "電気通信",
    pScore: 733,
    status: "完了",
  },
];

export default function DashboardPage() {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />

      <main className="flex-1">
        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
          {/* Welcome Section */}
          <section className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Building2 className="h-7 w-7 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
                株式会社サンプル建設
              </h1>
            </div>
            <p className="text-muted-foreground">
              経営事項審査の試算結果をまとめて確認できます
            </p>
          </section>

          {/* Quick Action Cards */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4">クイックアクション</h2>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <Link href="/trial">
                <Card className="cursor-pointer transition-shadow hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Calculator className="h-5 w-5 text-primary" />
                      新規試算
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-3">
                      決算書Excel＋提出書データからP点を試算
                    </p>
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                      試算を開始する
                      <ArrowRight className="h-4 w-4" />
                    </span>
                  </CardContent>
                </Card>
              </Link>

              <Card className="cursor-default opacity-75">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileSpreadsheet className="h-5 w-5 text-primary" />
                    前回の試算を見る
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    直近の試算結果を確認・比較します
                  </p>
                  <Badge variant="secondary">準備中</Badge>
                </CardContent>
              </Card>

              <Card className="cursor-default opacity-75">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Download className="h-5 w-5 text-primary" />
                    Excel一括ダウンロード
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    全業種の試算結果をExcelで出力します
                  </p>
                  <Badge variant="secondary">準備中</Badge>
                </CardContent>
              </Card>
            </div>
          </section>

          {/* P-score Summary by Industry */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">業種別 P点サマリー</h2>
              <Badge variant="outline">デモデータ</Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {industryScores.map((item) => (
                <Card key={item.name}>
                  <CardHeader>
                    <CardTitle className="text-sm text-muted-foreground font-medium">
                      {item.name}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-end justify-between">
                      <div>
                        <p className="text-3xl font-bold tracking-tight">
                          {item.score.toLocaleString()}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          P点
                        </p>
                      </div>
                      <div
                        className={`flex items-center gap-1 text-sm font-medium ${
                          item.trend >= 0
                            ? "text-green-600 dark:text-green-400"
                            : "text-red-600 dark:text-red-400"
                        }`}
                      >
                        <TrendingUp
                          className={`h-4 w-4 ${
                            item.trend < 0 ? "rotate-180" : ""
                          }`}
                        />
                        {item.trend >= 0 ? "+" : ""}
                        {item.trend}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>

          {/* Common Scores (Y, X2, W) */}
          <section className="mb-10">
            <h2 className="text-lg font-semibold mb-4">共通スコア</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              {commonScores.map((item) => (
                <Card key={item.label}>
                  <CardContent className="pt-2">
                    <p className="text-sm text-muted-foreground mb-1">
                      {item.label}
                    </p>
                    <p className="text-2xl font-bold tracking-tight">
                      {item.value.toLocaleString()}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {/* Formula Display */}
            <Card className="mt-4 bg-muted/40">
              <CardContent className="pt-2">
                <p className="text-xs text-muted-foreground mb-1">
                  P点算出式
                </p>
                <p className="font-mono text-sm font-medium">
                  P = 0.25 x X1 + 0.15 x X2 + 0.20 x Y + 0.25 x Z + 0.15 x W
                </p>
              </CardContent>
            </Card>
          </section>

          {/* Recent Calculations */}
          <section className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">最近の試算結果</h2>
              <Badge variant="outline">デモデータ</Badge>
            </div>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="px-4 py-3 font-medium">日付</th>
                      <th className="px-4 py-3 font-medium">業種</th>
                      <th className="px-4 py-3 font-medium text-right">
                        P点
                      </th>
                      <th className="px-4 py-3 font-medium">ステータス</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentCalculations.map((calc) => (
                      <tr
                        key={calc.id}
                        className="border-b last:border-0 hover:bg-muted/50 transition-colors"
                      >
                        <td className="px-4 py-3">{calc.date}</td>
                        <td className="px-4 py-3">{calc.industry}</td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {calc.pScore.toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant="secondary">{calc.status}</Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </section>

          {/* CTA */}
          <section className="text-center py-6">
            <Link href="/trial">
              <Button size="lg">
                <Calculator className="mr-2 h-5 w-5" />
                新規試算を始める
              </Button>
            </Link>
          </section>
        </div>
      </main>

      <Footer />
    </div>
  );
}
