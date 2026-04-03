'use client';

import Link from 'next/link';
import { Header } from '@/components/header';
import { Footer } from '@/components/footer';
import { ResultView } from '@/components/result-view';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Calculator, ArrowRight, FileSpreadsheet, Building2, Users } from 'lucide-react';
import {
  demoResult,
  demoBasicInfo,
  demoFinancialSummary,
  demoIndustrySummary,
  demoBS,
  demoPL,
} from '@/lib/demo-data';

export default function DemoPage() {
  return (
    <>
      <Header />
      <main className="flex-1">
        {/* Demo Banner */}
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="mx-auto max-w-7xl px-4 py-3 sm:px-6 lg:px-8">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <p className="text-sm text-amber-800 text-center sm:text-left">
                これはデモ表示です。実際にデータを入力して試算するには登録してください。
              </p>
              <Link href="/login" className="shrink-0">
                <Button size="sm" className="whitespace-nowrap">
                  <Calculator className="mr-2 h-4 w-4" />
                  登録して始める
                </Button>
              </Link>
            </div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8 space-y-8">
          {/* Page Title */}
          <div>
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold sm:text-3xl">デモプレビュー</h1>
              <Badge variant="secondary">サンプルデータ</Badge>
            </div>
            <p className="text-muted-foreground">
              {demoBasicInfo.companyName} {demoBasicInfo.periodNumber}のサンプルデータを用いた試算結果です。
              読み取り専用で、すべての結果画面を閲覧できます。
            </p>
          </div>

          {/* Input Summary Accordion */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">入力データサマリー</CardTitle>
            </CardHeader>
            <CardContent>
              <Accordion className="w-full">
                {/* Financial Data */}
                <AccordionItem value="financials">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="h-4 w-4" />
                      Step 1: 決算書データ
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                      {demoFinancialSummary.map((item) => (
                        <div key={item.label} className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                          <span className="text-sm text-muted-foreground">{item.label}</span>
                          <span className="text-sm font-mono font-medium">
                            {item.value.toLocaleString()} {item.unit}
                          </span>
                        </div>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* Industry Data */}
                <AccordionItem value="industries">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4" />
                      Step 2: 業種別データ
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b text-xs text-muted-foreground">
                            <th className="py-2 text-left">業種</th>
                            <th className="py-2 text-center">許可区分</th>
                            <th className="py-2 text-right">2期平均完工高</th>
                            <th className="py-2 text-right">2期平均元請</th>
                            <th className="py-2 text-right">技術職員値</th>
                          </tr>
                        </thead>
                        <tbody>
                          {demoIndustrySummary.map((ind) => (
                            <tr key={ind.name} className="border-b">
                              <td className="py-2 font-medium">{ind.name}</td>
                              <td className="py-2 text-center">
                                <Badge variant="outline" className="text-xs">
                                  {ind.permitType}
                                </Badge>
                              </td>
                              <td className="py-2 text-right font-mono">
                                {ind.avgCompletion.toLocaleString()} 千円
                              </td>
                              <td className="py-2 text-right font-mono">
                                {ind.avgSubcontract.toLocaleString()} 千円
                              </td>
                              <td className="py-2 text-right font-mono">{ind.techStaffValue}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </AccordionContent>
                </AccordionItem>

                {/* W Items Summary */}
                <AccordionItem value="w-items">
                  <AccordionTrigger>
                    <div className="flex items-center gap-2">
                      <Users className="h-4 w-4" />
                      Step 3: 社会性等（W項目）
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">雇用保険</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">加入</Badge>
                      </div>
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">健康保険</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">加入</Badge>
                      </div>
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">厚生年金</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">加入</Badge>
                      </div>
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">建退共</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">加入</Badge>
                      </div>
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">退職一時金制度</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">あり</Badge>
                      </div>
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">防災協定</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">あり</Badge>
                      </div>
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">ISO9001</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">取得</Badge>
                      </div>
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">CCUS</span>
                        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">実施</Badge>
                      </div>
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">営業年数</span>
                        <span className="text-sm font-mono font-medium">45年</span>
                      </div>
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">監査の受審状況</span>
                        <span className="text-sm font-mono font-medium">会計参与設置</span>
                      </div>
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">W素点合計</span>
                        <span className="text-sm font-mono font-medium">{demoResult.wTotal}</span>
                      </div>
                      <div className="flex justify-between items-center rounded-lg bg-muted/50 px-3 py-2">
                        <span className="text-sm text-muted-foreground">W点</span>
                        <span className="text-sm font-mono font-bold">{demoResult.W}</span>
                      </div>
                    </div>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </CardContent>
          </Card>

          {/* Result View (reused component) */}
          <ResultView
            companyName={demoResult.companyName}
            period={demoResult.period}
            reviewBaseDate={demoResult.reviewBaseDate}
            industries={demoResult.industries}
            Y={demoResult.Y}
            X2={demoResult.X2}
            X21={demoResult.X21}
            X22={demoResult.X22}
            W={demoResult.W}
            wTotal={demoResult.wTotal}
            yResult={demoResult.yResult}
            wDetail={demoResult.wDetail}
            bs={demoBS}
            pl={demoPL}
            prevY={demoResult.prevY}
            prevX2={demoResult.prevX2}
            prevW={demoResult.prevW}
            readOnly
          />

          {/* CTA */}
          <div className="rounded-xl border-2 border-primary/20 bg-primary/5 p-8 text-center">
            <h2 className="text-xl font-bold mb-2">
              あなたの会社のP点を試算してみませんか？
            </h2>
            <p className="text-muted-foreground mb-6">
              無料で登録して、決算書の数値を入力するだけでP点を即算出できます。
            </p>
            <Link href="/login">
              <Button size="lg" className="text-base px-8 py-6">
                <Calculator className="mr-2 h-5 w-5" />
                登録して始める
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
