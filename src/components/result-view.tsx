'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  FileSpreadsheet,
  FileText,
  AlertCircle,
  Sparkles,
  SlidersHorizontal,
  Loader2,
} from 'lucide-react';
import { YRadarChart } from '@/components/y-radar-chart';
import { KeishinBSTable } from '@/components/keishin-bs-table';
import { KeishinPLTable } from '@/components/keishin-pl-table';
import { AiAnalysisView } from '@/components/ai-analysis-view';
import { SimulationPanel } from '@/components/simulation-panel';
import type { YResult, YInput, KeishinBS, KeishinPL, WDetail, SocialItems } from '@/lib/engine/types';
import type { AnalysisInput, AnalysisResult } from '@/lib/ai-analysis-types';

interface IndustryResult {
  name: string;
  X1: number;
  Z: number;
  Z1: number;
  Z2: number;
  P: number;
  prevP?: number;
  /** 2年平均完成工事高（千円） */
  x1TwoYearAvg?: number;
  /** 当期完成工事高（千円） */
  x1Current?: number;
  /** X1算出に採用された方 */
  x1Selected?: '2年平均' | '当期';
}

interface ResultViewProps {
  companyName?: string;
  period?: string;
  reviewBaseDate?: string;
  industries: IndustryResult[];
  Y: number;
  X2: number;
  X21: number;
  X22: number;
  W: number;
  wTotal: number;
  yResult: YResult;
  wDetail?: WDetail;
  bs?: KeishinBS;
  pl?: KeishinPL;
  prevY?: number;
  prevX2?: number;
  prevW?: number;
  /** デモ/読み取り専用モード: ダウンロードボタンを非表示にする */
  readOnly?: boolean;
  /** AI分析の事前生成済み結果（デモ用） */
  staticAiAnalysis?: AnalysisResult;
  /** 再分類シミュレーション用のYInput */
  yInput?: YInput;
  /** EBITDA（X22計算用） */
  ebitda?: number;
  /** 業種別計算データ */
  industryCalcData?: Array<{
    name: string;
    code?: string;
    avgCompletion: number;
    avgSubcontract: number;
    techStaffValue: number;
  }>;
  /** 社会性項目（シミュレーション用） */
  socialItems?: SocialItems;
}

function DiffBadge({ prev, curr }: { prev?: number; curr: number }) {
  if (prev === undefined) return null;
  const diff = curr - prev;
  if (diff > 0) return (
    <span className="inline-flex items-center text-green-600 text-sm font-medium ml-2">
      <ArrowUpRight className="h-3 w-3" />+{diff}
    </span>
  );
  if (diff < 0) return (
    <span className="inline-flex items-center text-red-600 text-sm font-medium ml-2">
      <ArrowDownRight className="h-3 w-3" />{diff}
    </span>
  );
  return (
    <span className="inline-flex items-center text-muted-foreground text-sm ml-2">
      <Minus className="h-3 w-3" />±0
    </span>
  );
}

function ContributionBar({ label, value, maxValue }: { label: string; value: number; maxValue: number }) {
  const pct = Math.max(0, Math.min(100, (value / maxValue) * 100));
  return (
    <div className="flex items-center gap-3 text-sm">
      <div className="w-36 text-right text-muted-foreground">{label}</div>
      <div className="flex-1 h-5 bg-muted/50 rounded overflow-hidden">
        <div className="h-full bg-primary/70 rounded" style={{ width: `${pct}%` }} />
      </div>
      <div className="w-16 text-right font-mono font-medium">{value}</div>
    </div>
  );
}

export function ResultView(props: ResultViewProps) {
  const {
    companyName,
    period,
    reviewBaseDate,
    industries,
    Y, X2, X21, X22, W, wTotal,
    yResult,
    wDetail,
    bs,
    pl,
    prevY, prevX2, prevW,
    readOnly,
    staticAiAnalysis,
    yInput,
    ebitda,
    industryCalcData,
    socialItems,
  } = props;

  // AI分析用の入力データを構築
  const aiAnalysisInput: AnalysisInput | undefined = useMemo(() => {
    if (readOnly && !staticAiAnalysis) return undefined;
    return {
      companyName: companyName ?? '',
      period: period ?? '',
      industries: industries.map((ind) => ({
        name: ind.name,
        X1: ind.X1,
        Z: ind.Z,
        Z1: ind.Z1,
        Z2: ind.Z2,
        P: ind.P,
      })),
      Y, X2, X21, X22, W, wTotal,
      yResult: {
        indicators: yResult.indicators,
        indicatorsRaw: yResult.indicatorsRaw,
        A: yResult.A,
        Y: yResult.Y,
        operatingCF: yResult.operatingCF,
      },
      wDetail,
      bs: bs as unknown as Record<string, number>,
      pl: pl as unknown as Record<string, number>,
      yInput,
      ebitda,
      industryCalcData,
    };
  }, [companyName, period, industries, Y, X2, X21, X22, W, wTotal, yResult, wDetail, bs, pl, readOnly, staticAiAnalysis, yInput, ebitda, industryCalcData]);

  // Calculate P formula breakdown for first industry
  const primaryInd = industries[0];

  const [excelLoading, setExcelLoading] = useState(false);

  async function handleDownloadExcel() {
    setExcelLoading(true);
    try {
      const res = await fetch('/api/export-excel', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          period,
          industries,
          Y, X2, X21, X22, W, wTotal,
          yResult,
          bs,
          pl,
        }),
      });
      if (!res.ok) throw new Error('Excelファイルのダウンロードに失敗しました。');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `keishin_result_${period || 'trial'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel download failed:', err);
    } finally {
      setExcelLoading(false);
    }
  }

  const [pdfLoading, setPdfLoading] = useState(false);

  async function handleDownloadPDF() {
    setPdfLoading(true);
    try {
      const res = await fetch('/api/export-pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName,
          period,
          reviewBaseDate,
          industries,
          Y, X2, X21, X22, W, wTotal,
          yResult,
          wDetail,
        }),
      });
      if (!res.ok) throw new Error('PDFファイルのダウンロードに失敗しました。');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `keishin_report_${period || 'trial'}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('PDF download failed:', err);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {companyName && <span>{companyName}</span>}
            {period && <span>{period}</span>}
            {reviewBaseDate && <span className="text-sm text-muted-foreground">審査基準日:{reviewBaseDate}</span>}
          </h2>
          <Badge variant="outline" className="mt-1 bg-yellow-50 text-yellow-700 border-yellow-200">
            試算版
          </Badge>
        </div>
        {!readOnly && (
          <div className="flex gap-2" data-print-hide>
            <Button onClick={handleDownloadExcel} variant="outline" disabled={excelLoading}>
              {excelLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileSpreadsheet className="mr-2 h-4 w-4" />
              )}
              Excel
            </Button>
            <Button onClick={handleDownloadPDF} variant="outline" disabled={pdfLoading}>
              {pdfLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <FileText className="mr-2 h-4 w-4" />
              )}
              PDFエクスポート
            </Button>
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        ※ 本試算は参考値であり、公式の経営事項審査結果通知書ではありません。
      </p>

      {/* P Score Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {industries.map((ind) => (
          <Card key={ind.name} className="text-center">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">{ind.name}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold text-primary">{ind.P}</div>
              <div className="text-xs text-muted-foreground mt-1">P点</div>
              {ind.prevP !== undefined && <DiffBadge prev={ind.prevP} curr={ind.P} />}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Common Scores Bar */}
      <div className="flex flex-wrap gap-4 justify-center text-center">
        <div className="px-4 py-2 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground">Y点</div>
          <div className="text-lg font-bold">{Y}</div>
          <DiffBadge prev={prevY} curr={Y} />
        </div>
        <div className="px-4 py-2 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground">X2</div>
          <div className="text-lg font-bold">{X2}</div>
          <div className="text-[10px] text-muted-foreground">X21={X21} / X22={X22}</div>
          <DiffBadge prev={prevX2} curr={X2} />
        </div>
        <div className="px-4 py-2 rounded-lg bg-muted/50">
          <div className="text-xs text-muted-foreground">W点</div>
          <div className="text-lg font-bold">{W}</div>
          <div className="text-[10px] text-muted-foreground">素点={wTotal}</div>
          <DiffBadge prev={prevW} curr={W} />
        </div>
      </div>

      {/* P Formula Breakdown */}
      {primaryInd && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">P点の内訳（{primaryInd.name}）</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-sm font-mono bg-muted/30 rounded-lg p-4">
              <div>P = 0.25×<span className="font-bold">{primaryInd.X1}</span> + 0.15×<span className="font-bold">{X2}</span> + 0.20×<span className="font-bold">{Y}</span></div>
              <div className="ml-6">+ 0.25×<span className="font-bold">{primaryInd.Z}</span> + 0.15×<span className="font-bold">{W}</span> = <span className="text-primary font-bold text-lg">{primaryInd.P}</span></div>
              {primaryInd.x1Selected && (
                <div className="mt-2 text-xs border-t pt-2 flex flex-wrap items-center gap-x-1 gap-y-1">
                  <span className="text-muted-foreground">X1完工高:</span>
                  <span className={primaryInd.x1Selected === '2年平均' ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                    2年平均 ¥{primaryInd.x1TwoYearAvg?.toLocaleString()}千円
                  </span>
                  <span className="text-muted-foreground">vs</span>
                  <span className={primaryInd.x1Selected === '当期' ? 'text-green-600 font-semibold' : 'text-muted-foreground'}>
                    当期 ¥{primaryInd.x1Current?.toLocaleString()}千円
                  </span>
                  <Badge variant="outline" className="text-[10px] py-0 bg-green-50 text-green-700 border-green-200">
                    採用: {primaryInd.x1Selected}（より大きいため）
                  </Badge>
                </div>
              )}
            </div>
            <div className="space-y-2">
              <ContributionBar label={`X1=${primaryInd.X1}`} value={Math.floor(0.25 * primaryInd.X1)} maxValue={Math.floor(primaryInd.P * 0.35)} />
              <ContributionBar label={`X2=${X2}`} value={Math.floor(0.15 * X2)} maxValue={Math.floor(primaryInd.P * 0.35)} />
              <ContributionBar label={`Y=${Y}`} value={Math.floor(0.20 * Y)} maxValue={Math.floor(primaryInd.P * 0.35)} />
              <ContributionBar label={`Z=${primaryInd.Z}`} value={Math.floor(0.25 * primaryInd.Z)} maxValue={Math.floor(primaryInd.P * 0.35)} />
              <ContributionBar label={`W=${W}`} value={Math.floor(0.15 * W)} maxValue={Math.floor(primaryInd.P * 0.35)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="industry" className="w-full">
        <TabsList className="flex w-full overflow-x-auto text-xs sm:text-sm sm:grid sm:grid-cols-5">
          <TabsTrigger value="industry">業種別P点</TabsTrigger>
          <TabsTrigger value="scores">評点詳細</TabsTrigger>
          <TabsTrigger value="bs-pl">決算書</TabsTrigger>
          <TabsTrigger value="simulation" className="flex items-center gap-1">
            <SlidersHorizontal className="h-3 w-3 hidden sm:block" />
            シミュレーション
          </TabsTrigger>
          <TabsTrigger value="ai-analysis" className="flex items-center gap-1">
            <Sparkles className="h-3 w-3 hidden sm:block" />
            AI分析
          </TabsTrigger>
        </TabsList>

        {/* Industry Table */}
        <TabsContent value="industry">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">⑤ 業種別P点一覧</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 text-left">業種</th>
                      <th className="py-2 text-right">X1<br/><span className="font-normal">完工高</span></th>
                      <th className="py-2 text-right">X2<br/><span className="font-normal">自己資本等</span></th>
                      <th className="py-2 text-right">Y<br/><span className="font-normal">経営状況</span></th>
                      <th className="py-2 text-right">Z<br/><span className="font-normal">技術力</span></th>
                      <th className="py-2 text-right">W<br/><span className="font-normal">社会性</span></th>
                      <th className="py-2 text-right font-bold">P<br/><span className="font-normal">総合</span></th>
                      {industries.some((i) => i.prevP !== undefined) && (
                        <th className="py-2 text-center">変動</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {industries.map((ind) => (
                      <tr key={ind.name} className="border-b">
                        <td className="py-2 font-medium">{ind.name}</td>
                        <td className="py-2 text-right font-mono">
                          <div>{ind.X1}</div>
                          {ind.x1Selected && (
                            <div className="text-[10px] leading-tight mt-0.5">
                              <span className={ind.x1Selected === '2年平均' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                                2年平均:{ind.x1TwoYearAvg?.toLocaleString()}
                              </span>
                              <span className="text-muted-foreground mx-0.5">/</span>
                              <span className={ind.x1Selected === '当期' ? 'text-green-600 font-medium' : 'text-muted-foreground'}>
                                当期:{ind.x1Current?.toLocaleString()}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono">{X2}</td>
                        <td className="py-2 text-right font-mono">{Y}</td>
                        <td className="py-2 text-right font-mono">{ind.Z}</td>
                        <td className="py-2 text-right font-mono">{W}</td>
                        <td className="py-2 text-right font-mono font-bold text-primary">{ind.P}</td>
                        {industries.some((i) => i.prevP !== undefined) && (
                          <td className="py-2 text-center"><DiffBadge prev={ind.prevP} curr={ind.P} /></td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 text-xs text-muted-foreground">
                P = 0.25×X1 + 0.15×X2 + 0.20×Y + 0.25×Z + 0.15×W
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Score Details (Y + X2 + Z + W merged) */}
        <TabsContent value="scores">
          <div className="space-y-4">
            {/* Y点詳細 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Y点 = {Y}（経営状況分析）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <YRadarChart indicators={yResult.indicators} indicatorsRaw={yResult.indicatorsRaw} />
                <Separator />
                <details className="text-sm">
                  <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                    営業キャッシュフロー明細を表示
                  </summary>
                  <div className="font-mono space-y-1 mt-3">
                    <div className="flex justify-between"><span>経常利益</span><span>{yResult.operatingCFDetail.ordinaryProfit.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>＋減価償却実施額</span><span>{yResult.operatingCFDetail.depreciation.toLocaleString()}</span></div>
                    <div className="flex justify-between"><span>－法人税等</span><span>{yResult.operatingCFDetail.corporateTax.toLocaleString()}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>＋貸倒引当金増減</span><span>{yResult.operatingCFDetail.allowanceChange.toLocaleString()}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>－売掛債権増減</span><span>{yResult.operatingCFDetail.receivableChange.toLocaleString()}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>＋仕入債務増減</span><span>{yResult.operatingCFDetail.payableChange.toLocaleString()}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>－棚卸資産増減</span><span>{yResult.operatingCFDetail.inventoryChange.toLocaleString()}</span></div>
                    <div className="flex justify-between text-muted-foreground"><span>＋受入金増減</span><span>{yResult.operatingCFDetail.advanceChange.toLocaleString()}</span></div>
                    <Separator />
                    <div className="flex justify-between font-bold"><span>営業CF</span><span>{yResult.operatingCF.toLocaleString()} 千円</span></div>
                  </div>
                </details>
              </CardContent>
            </Card>

            {/* X2 */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">X2 = {X2}（自己資本額及び利益額）</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4 text-center">
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">X21（自己資本額）</div>
                    <div className="text-2xl font-bold">{X21}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-muted/50">
                    <div className="text-xs text-muted-foreground">X22（利益額）</div>
                    <div className="text-2xl font-bold">{X22}</div>
                  </div>
                </div>
                <div className="mt-3 text-xs text-muted-foreground text-center">
                  X2 = floor((X21 + X22) / 2) = floor(({X21} + {X22}) / 2) = {X2}
                </div>
              </CardContent>
            </Card>

            {/* Z detail per industry */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Z（技術力評点）</CardTitle>
              </CardHeader>
              <CardContent>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 text-left">業種</th>
                      <th className="py-2 text-right">Z1<br/>(技術職員)</th>
                      <th className="py-2 text-right">Z2<br/>(元請完工高)</th>
                      <th className="py-2 text-right font-bold">Z</th>
                    </tr>
                  </thead>
                  <tbody>
                    {industries.map((ind) => (
                      <tr key={ind.name} className="border-b">
                        <td className="py-2 font-medium">{ind.name}</td>
                        <td className="py-2 text-right font-mono">{ind.Z1}</td>
                        <td className="py-2 text-right font-mono">{ind.Z2}</td>
                        <td className="py-2 text-right font-mono font-bold">{ind.Z}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <div className="mt-3 text-xs text-muted-foreground">
                  Z = floor(Z1 × 0.8 + Z2 × 0.2)
                </div>
              </CardContent>
            </Card>

            {/* W detail */}
            {wDetail && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">W = {W}（社会性等）</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-4 sm:grid-cols-8 gap-3 text-center">
                    {([
                      { key: 'w1' as const, label: '労働福祉' },
                      { key: 'w2' as const, label: '営業年数' },
                      { key: 'w3' as const, label: '防災活動' },
                      { key: 'w4' as const, label: '法令遵守' },
                      { key: 'w5' as const, label: '経理・監査' },
                      { key: 'w6' as const, label: '研究開発' },
                      { key: 'w7' as const, label: '建設機械' },
                      { key: 'w8' as const, label: 'ISO等' },
                    ]).map(({ key, label }) => (
                      <div key={key} className="p-2 rounded border">
                        <div className="text-[10px] text-muted-foreground">{label}</div>
                        <div className={`text-sm font-bold ${wDetail[key] < 0 ? 'text-red-600' : wDetail[key] > 0 ? 'text-green-600' : ''}`}>
                          {wDetail[key]}
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-xs text-muted-foreground text-center">
                    素点合計 = {wDetail.total} → W = floor({wDetail.total} × 1750 / 200) = {W}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* BS/PL */}
        <TabsContent value="bs-pl">
          {bs || pl ? (
            <div className="space-y-6">
              {bs && <KeishinBSTable bs={bs} />}
              {pl && <KeishinPLTable pl={pl} />}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <FileSpreadsheet className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>決算書Excelをアップロードすると、経審用BS/PLが表示されます。</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Simulation Panel */}
        <TabsContent value="simulation">
          {yInput && socialItems && industryCalcData ? (
            <SimulationPanel
              yInput={yInput}
              equity={yInput.equity}
              ebitda={ebitda ?? 0}
              socialItems={socialItems}
              industries={industryCalcData.map((ind, i) => ({
                name: ind.name,
                code: ind.code ?? String(i).padStart(2, '0'),
                avgCompletion: ind.avgCompletion,
                avgSubcontract: ind.avgSubcontract,
                techStaffValue: ind.techStaffValue,
              }))}
            />
          ) : (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <SlidersHorizontal className="mx-auto h-12 w-12 mb-4 opacity-50" />
                <p>シミュレーションには詳細データの入力が必要です。</p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* AI Analysis — must be last to match TabsTrigger order */}
        <TabsContent value="ai-analysis">
          <AiAnalysisView
            analysisInput={aiAnalysisInput}
            staticResult={staticAiAnalysis}
            readOnly={readOnly}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
