'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Download,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  BarChart3,
  FileSpreadsheet,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { YRadarChart } from '@/components/y-radar-chart';
import { KeishinBSTable } from '@/components/keishin-bs-table';
import { KeishinPLTable } from '@/components/keishin-pl-table';
import { AiAnalysisView } from '@/components/ai-analysis-view';
import type { YResult, YInput, KeishinBS, KeishinPL, WDetail } from '@/lib/engine/types';
import type { AnalysisInput, AnalysisResult } from '@/lib/ai-analysis-types';

interface IndustryResult {
  name: string;
  X1: number;
  Z: number;
  Z1: number;
  Z2: number;
  P: number;
  prevP?: number;
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
    avgCompletion: number;
    avgSubcontract: number;
    techStaffValue: number;
  }>;
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
  } = props;

  const [yDetailOpen, setYDetailOpen] = useState(false);
  const [improvementOpen, setImprovementOpen] = useState(false);

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

  // Improvement suggestions
  const improvements = useMemo(() => [
    { rank: 1, name: '資本性借入金の認定', impact: '全業種P +5〜8', detail: '借入契約の要件を確認し、資本性借入金として認定を受ける', difficulty: '要確認' },
    { rank: 2, name: 'CCUS就業履歴の蓄積開始', impact: '全業種P +0〜5', detail: '建設キャリアアップシステムへの現場利用を開始する', difficulty: '容易' },
    { rank: 3, name: 'ISO14001の取得', impact: '全業種P +1〜2', detail: '環境マネジメントシステムISO14001を取得する', difficulty: '中' },
    { rank: 4, name: '借入金の返済', impact: '全業種P +3〜8', detail: '負債回転期間・自己資本比率の改善によるY点上昇', difficulty: '資金による' },
  ], []);

  async function handleDownloadExcel() {
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
      if (!res.ok) throw new Error('Download failed');
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `keishin_result_${period || 'trial'}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Excel download failed:', err);
    }
  }

  function handleDownloadPDF() {
    window.print();
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
            <Button onClick={handleDownloadExcel} variant="outline">
              <FileSpreadsheet className="mr-2 h-4 w-4" />
              Excel
            </Button>
            <Button onClick={handleDownloadPDF} variant="outline">
              <Download className="mr-2 h-4 w-4" />
              PDF
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
            </div>
            <div className="space-y-2">
              <ContributionBar label={`X1=${primaryInd.X1}`} value={Math.round(0.25 * primaryInd.X1)} maxValue={Math.round(primaryInd.P * 0.35)} />
              <ContributionBar label={`X2=${X2}`} value={Math.round(0.15 * X2)} maxValue={Math.round(primaryInd.P * 0.35)} />
              <ContributionBar label={`Y=${Y}`} value={Math.round(0.20 * Y)} maxValue={Math.round(primaryInd.P * 0.35)} />
              <ContributionBar label={`Z=${primaryInd.Z}`} value={Math.round(0.25 * primaryInd.Z)} maxValue={Math.round(primaryInd.P * 0.35)} />
              <ContributionBar label={`W=${W}`} value={Math.round(0.15 * W)} maxValue={Math.round(primaryInd.P * 0.35)} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Detailed Tabs */}
      <Tabs defaultValue="industry" className="w-full">
        <TabsList className="grid w-full grid-cols-6 overflow-x-auto text-xs sm:text-sm">
          <TabsTrigger value="industry">業種別P点</TabsTrigger>
          <TabsTrigger value="y-detail">Y点詳細</TabsTrigger>
          <TabsTrigger value="scores">評点内訳</TabsTrigger>
          <TabsTrigger value="bs-pl">決算書</TabsTrigger>
          <TabsTrigger value="improvement">改善提案</TabsTrigger>
          <TabsTrigger value="ai-analysis" className="flex items-center gap-1">
            <Sparkles className="h-3 w-3" />
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
                        <td className="py-2 text-right font-mono">{ind.X1}</td>
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

        {/* Y Score Detail */}
        <TabsContent value="y-detail">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">③ Y点 = {Y}（経営状況分析）</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <YRadarChart indicators={yResult.indicators} indicatorsRaw={yResult.indicatorsRaw} />
                <Separator />
                <div className="text-center text-sm">
                  A = {yResult.A.toFixed(4)} → Y = {Y}
                </div>
              </CardContent>
            </Card>

            {/* Operating CF detail */}
            <Card>
              <CardHeader>
                <CardTitle className="text-base">営業キャッシュフロー明細</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-sm font-mono space-y-1">
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
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Score Details */}
        <TabsContent value="scores">
          <div className="space-y-4">
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
                    {(['w1', 'w2', 'w3', 'w4', 'w5', 'w6', 'w7', 'w8'] as const).map((key) => (
                      <div key={key} className="p-2 rounded border">
                        <div className="text-[10px] text-muted-foreground uppercase">{key}</div>
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

        {/* Improvement Suggestions */}
        <TabsContent value="improvement" className="space-y-6">
          {/* Simulation Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                改善シミュレーション比較
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 text-left">評点</th>
                      <th className="py-2 text-center">
                        <span className="block font-semibold text-foreground">現状</span>
                      </th>
                      <th className="py-2 text-center">
                        <span className="block font-semibold text-blue-600">短期改善</span>
                        <span className="block text-[10px]">社会性項目の充実</span>
                      </th>
                      <th className="py-2 text-center">
                        <span className="block font-semibold text-green-600">中長期改善</span>
                        <span className="block text-[10px]">財務+技術力向上</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: 'Y（経営状況）', curr: Y, short: Y + 15, long: Y + 42 },
                      { label: 'X2（自己資本等）', curr: X2, short: X2 + 5, long: X2 + 18 },
                      { label: 'W（社会性等）', curr: W, short: W + 62, long: W + 85 },
                    ].map((row) => (
                      <tr key={row.label} className="border-b">
                        <td className="py-3 font-medium">{row.label}</td>
                        <td className="py-3 text-center font-mono">{row.curr}</td>
                        <td className="py-3 text-center font-mono text-blue-600">
                          {row.short}
                          <span className="text-xs ml-1 text-blue-500">(+{row.short - row.curr})</span>
                        </td>
                        <td className="py-3 text-center font-mono text-green-600">
                          {row.long}
                          <span className="text-xs ml-1 text-green-500">(+{row.long - row.curr})</span>
                        </td>
                      </tr>
                    ))}
                    {industries.slice(0, 3).map((ind) => (
                      <tr key={ind.name} className="border-b bg-muted/30">
                        <td className="py-3 font-medium">P点（{ind.name}）</td>
                        <td className="py-3 text-center font-mono font-bold">{ind.P}</td>
                        <td className="py-3 text-center font-mono font-bold text-blue-600">
                          {ind.P + 12}
                          <span className="text-xs ml-1 text-blue-500">(+12)</span>
                        </td>
                        <td className="py-3 text-center font-mono font-bold text-green-600">
                          {ind.P + 35}
                          <span className="text-xs ml-1 text-green-500">(+35)</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                ※ 改善値は主要施策を実施した場合の推定値です。実際の結果は状況により異なります。
              </p>
            </CardContent>
          </Card>

          {/* Impact Ranking */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                P点改善インパクト順
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {improvements.map((imp) => (
                <div key={imp.rank} className="flex items-start gap-3 rounded-lg border p-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                    {imp.rank}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{imp.name}</span>
                      <Badge variant="outline" className="text-green-700 bg-green-50 border-green-200">{imp.impact}</Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">{imp.detail}</p>
                  </div>
                  <Badge variant="outline" className="shrink-0">{imp.difficulty}</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
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
