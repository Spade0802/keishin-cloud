'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  AlertTriangle,
  Sparkles,
  Loader2,
  Table2,
  BarChart3,
  ClipboardCheck,
  ShieldAlert,
} from 'lucide-react';
import type {
  AnalysisResult,
  AnalysisInput,
  ReclassificationItem,
  SimulationCase,
  ItemAssessment,
  RiskPoint,
} from '@/lib/ai-analysis-types';

interface AiAnalysisViewProps {
  /** 分析に必要な入力データ（ボタン押下時にAPIへ送信） */
  analysisInput?: AnalysisInput;
  /** デモ用: 事前生成済みの分析結果を渡す */
  staticResult?: AnalysisResult;
  /** デモ/読み取り専用モード */
  readOnly?: boolean;
}

// --- ヘルパー ---

function assessmentColor(assessment: ReclassificationItem['assessment']) {
  switch (assessment) {
    case '採用余地あり':
      return 'bg-green-50 text-green-700 border-green-200';
    case '要確認':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case '非推奨':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function severityColor(severity: RiskPoint['severity']) {
  switch (severity) {
    case '高':
      return 'bg-red-100 text-red-800 border-red-300';
    case '中':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    case '低':
      return 'bg-green-100 text-green-800 border-green-300';
  }
}

function categoryLabel(category: ItemAssessment['category']) {
  switch (category) {
    case 'confirmed':
      return 'そのまま確定';
    case 'reviewable':
      return '見直し余地あり';
    case 'insufficientBasis':
      return '根拠不足';
    case 'shouldNotDo':
      return '実施すべきでない';
  }
}

function categoryColor(category: ItemAssessment['category']) {
  switch (category) {
    case 'confirmed':
      return 'bg-green-50 text-green-700 border-green-200';
    case 'reviewable':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'insufficientBasis':
      return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'shouldNotDo':
      return 'bg-red-50 text-red-700 border-red-200';
  }
}

// --- セクション1: 再分類レビュー ---

function ReclassificationTable({ items }: { items: ReclassificationItem[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <Table2 className="h-5 w-5" />
          再分類レビュー
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          各科目の組替余地・適法性・P点影響を分析しています
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b text-muted-foreground">
                <th className="py-2 text-left w-8">No.</th>
                <th className="py-2 text-left min-w-[120px]">項目</th>
                <th className="py-2 text-left min-w-[150px]">現在の処理</th>
                <th className="py-2 text-left min-w-[150px]">代替処理案</th>
                <th className="py-2 text-left min-w-[150px]">適法性・根拠</th>
                <th className="py-2 text-left min-w-[100px]">必要証憑</th>
                <th className="py-2 text-center w-16">Y</th>
                <th className="py-2 text-center w-16">X</th>
                <th className="py-2 text-center w-16">Z</th>
                <th className="py-2 text-center w-16">W</th>
                <th className="py-2 text-center w-16">P</th>
                <th className="py-2 text-center w-20">評価</th>
                <th className="py-2 text-left min-w-[120px]">リスク</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.no} className="border-b hover:bg-muted/30">
                  <td className="py-2 font-mono">{item.no}</td>
                  <td className="py-2 font-medium">{item.item}</td>
                  <td className="py-2">{item.currentTreatment}</td>
                  <td className="py-2">{item.alternativePlan}</td>
                  <td className="py-2">{item.legality}</td>
                  <td className="py-2">{item.requiredDocuments}</td>
                  <td className="py-2 text-center font-mono">{item.yImpact}</td>
                  <td className="py-2 text-center font-mono">{item.xImpact}</td>
                  <td className="py-2 text-center font-mono">{item.zImpact}</td>
                  <td className="py-2 text-center font-mono">{item.wImpact}</td>
                  <td className="py-2 text-center font-mono font-bold">{item.pImpact}</td>
                  <td className="py-2 text-center">
                    <Badge variant="outline" className={assessmentColor(item.assessment)}>
                      {item.assessment}
                    </Badge>
                  </td>
                  <td className="py-2">{item.risk}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

// --- セクション2: シミュレーション比較 ---

function SimulationTable({ cases }: { cases: SimulationCase[] }) {
  if (cases.length === 0) return null;
  const caseA = cases[0];
  const industryNames = Object.keys(caseA.scores.p);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          シミュレーション比較
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          3ケースの比較：現状 / 最適化 / 保守的
        </p>
      </CardHeader>
      <CardContent>
        {/* 前提条件 */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {cases.map((c) => (
            <div key={c.label} className="rounded-lg border p-3">
              <div className="font-medium text-sm mb-1">
                {c.label}: {c.description}
              </div>
              <div className="space-y-1">
                {Object.entries(c.assumptions).map(([k, v]) => (
                  <div key={k} className="flex justify-between text-xs">
                    <span className="text-muted-foreground">{k}</span>
                    <span className="font-mono">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* スコア比較テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 text-left">評点</th>
                {cases.map((c) => (
                  <th key={c.label} className="py-2 text-center">
                    <span className={`font-semibold ${
                      c.label === 'Case B' ? 'text-blue-600' :
                      c.label === 'Case C' ? 'text-green-600' : 'text-foreground'
                    }`}>{c.label}</span>
                  </th>
                ))}
                <th className="py-2 text-center text-blue-600">B-A差</th>
                <th className="py-2 text-center text-green-600">C-A差</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b">
                <td className="py-2 font-medium">Y（経営状況）</td>
                {cases.map((c) => (
                  <td key={c.label} className="py-2 text-center font-mono">{c.scores.y}</td>
                ))}
                <td className="py-2 text-center font-mono text-blue-600">
                  +{cases[1]?.scores.y - caseA.scores.y}
                </td>
                <td className="py-2 text-center font-mono text-green-600">
                  +{cases[2]?.scores.y - caseA.scores.y}
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-medium">X2（自己資本等）</td>
                {cases.map((c) => (
                  <td key={c.label} className="py-2 text-center font-mono">{c.scores.x2}</td>
                ))}
                <td className="py-2 text-center font-mono text-blue-600">
                  +{cases[1]?.scores.x2 - caseA.scores.x2}
                </td>
                <td className="py-2 text-center font-mono text-green-600">
                  +{cases[2]?.scores.x2 - caseA.scores.x2}
                </td>
              </tr>
              <tr className="border-b">
                <td className="py-2 font-medium">W（社会性等）</td>
                {cases.map((c) => (
                  <td key={c.label} className="py-2 text-center font-mono">{c.scores.w}</td>
                ))}
                <td className="py-2 text-center font-mono text-blue-600">
                  +{cases[1]?.scores.w - caseA.scores.w}
                </td>
                <td className="py-2 text-center font-mono text-green-600">
                  +{cases[2]?.scores.w - caseA.scores.w}
                </td>
              </tr>
              <Separator className="my-0" />
              {industryNames.map((name) => (
                <tr key={name} className="border-b bg-muted/20">
                  <td className="py-2 font-medium">P点（{name}）</td>
                  {cases.map((c) => (
                    <td key={c.label} className="py-2 text-center font-mono font-bold">
                      {c.scores.p[name]}
                    </td>
                  ))}
                  <td className="py-2 text-center font-mono font-bold text-blue-600">
                    +{(cases[1]?.scores.p[name] ?? 0) - (caseA.scores.p[name] ?? 0)}
                  </td>
                  <td className="py-2 text-center font-mono font-bold text-green-600">
                    +{(cases[2]?.scores.p[name] ?? 0) - (caseA.scores.p[name] ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-muted-foreground mt-3">
          P = 0.25 x X1 + 0.15 x X2 + 0.20 x Y + 0.25 x Z + 0.15 x W
        </p>
      </CardContent>
    </Card>
  );
}

// --- セクション3: 項目判定一覧 ---

function ItemAssessmentList({ items }: { items: ItemAssessment[] }) {
  const groups: Record<ItemAssessment['category'], ItemAssessment[]> = {
    confirmed: [],
    reviewable: [],
    insufficientBasis: [],
    shouldNotDo: [],
  };
  for (const item of items) {
    groups[item.category]?.push(item);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ClipboardCheck className="h-5 w-5" />
          項目判定一覧
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          各項目の判定結果：確定 / 見直し / 根拠不足 / 不可
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {(Object.keys(groups) as ItemAssessment['category'][]).map((cat) => {
          const catItems = groups[cat];
          if (catItems.length === 0) return null;
          return (
            <div key={cat}>
              <div className="flex items-center gap-2 mb-3">
                <Badge variant="outline" className={categoryColor(cat)}>
                  {categoryLabel(cat)}
                </Badge>
                <span className="text-xs text-muted-foreground">{catItems.length}件</span>
              </div>
              <div className="space-y-2">
                {catItems.map((item, i) => (
                  <div key={i} className="flex items-start gap-3 rounded-lg border p-3">
                    <div className="flex-1">
                      <div className="font-medium text-sm">{item.item}</div>
                      <div className="text-xs text-muted-foreground mt-1">{item.action}</div>
                    </div>
                    <div className="text-right shrink-0">
                      <div className="text-xs text-muted-foreground">現状P影響</div>
                      <div className="text-xs font-mono">{item.currentPImpact}</div>
                      {item.revisedPImpact && item.revisedPImpact !== '—' && (
                        <>
                          <div className="text-xs text-muted-foreground mt-1">見直し後</div>
                          <div className="text-xs font-mono font-bold text-primary">{item.revisedPImpact}</div>
                        </>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// --- セクション4: リスク論点 ---

function RiskPointList({ items }: { items: RiskPoint[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <ShieldAlert className="h-5 w-5" />
          リスク論点
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          異常値・要注意項目の指摘とリスク評価
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {items.map((item, i) => (
            <div key={i} className="rounded-lg border p-4">
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={severityColor(item.severity)}>
                  {item.severity}
                </Badge>
                <span className="font-medium text-sm">{item.topic}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-2">{item.riskContent}</p>
              <div className="text-sm">
                <span className="font-medium">対応方針: </span>
                {item.response}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- メインコンポーネント ---

export function AiAnalysisView({ analysisInput, staticResult, readOnly }: AiAnalysisViewProps) {
  const [result, setResult] = useState<AnalysisResult | null>(staticResult ?? null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleAnalyze() {
    if (!analysisInput) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(analysisInput),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `エラー (${res.status})`);
      }
      const data: AnalysisResult = await res.json();
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'AI分析の実行中にエラーが発生しました');
    } finally {
      setLoading(false);
    }
  }

  // まだ分析結果がない場合: ボタンを表示
  if (!result) {
    return (
      <Card className="text-center">
        <CardContent className="py-12">
          <Sparkles className="mx-auto h-12 w-12 mb-4 text-primary/50" />
          <h3 className="text-lg font-bold mb-2">AIによる経審コンサル分析</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
            Gemini AIが経審の専門コンサルタントの視点で、P点向上のための
            合法的な見直し余地を分析します。再分類レビュー、シミュレーション比較、
            リスク分析を含む包括的なレポートを生成します。
          </p>
          {error && (
            <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive mb-4 max-w-md mx-auto">
              {error}
            </div>
          )}
          <Button
            size="lg"
            onClick={handleAnalyze}
            disabled={loading || readOnly}
            className="px-8"
          >
            {loading ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                分析中...（30秒ほどお待ちください）
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-5 w-5" />
                AI分析を実行
              </>
            )}
          </Button>
          {readOnly && (
            <p className="text-xs text-muted-foreground mt-3">
              ログインするとAI分析を利用できます
            </p>
          )}
        </CardContent>
      </Card>
    );
  }

  // 分析結果を表示
  return (
    <div className="space-y-6">
      {/* 免責事項バナー */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
        <div className="flex gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">AI生成レポート - 免責事項</p>
            <p className="text-xs text-amber-700 mt-1">{result.disclaimer}</p>
          </div>
        </div>
      </div>

      {/* サマリー */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            分析サマリー
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{result.summary}</p>
        </CardContent>
      </Card>

      {/* 4セクション タブ */}
      <Tabs defaultValue="reclassification" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="reclassification" className="text-xs sm:text-sm">
            再分類レビュー
          </TabsTrigger>
          <TabsTrigger value="simulation" className="text-xs sm:text-sm">
            シミュレーション
          </TabsTrigger>
          <TabsTrigger value="assessment" className="text-xs sm:text-sm">
            項目判定
          </TabsTrigger>
          <TabsTrigger value="risk" className="text-xs sm:text-sm">
            リスク論点
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reclassification">
          <ReclassificationTable items={result.reclassificationReview} />
        </TabsContent>

        <TabsContent value="simulation">
          <SimulationTable cases={result.simulationComparison} />
        </TabsContent>

        <TabsContent value="assessment">
          <ItemAssessmentList items={result.itemAssessments} />
        </TabsContent>

        <TabsContent value="risk">
          <RiskPointList items={result.riskPoints} />
        </TabsContent>
      </Tabs>

      {/* 再分析ボタン（非デモ時のみ） */}
      {!readOnly && analysisInput && (
        <div className="text-center" data-print-hide>
          <Button variant="outline" onClick={handleAnalyze} disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                再分析中...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                再分析する
              </>
            )}
          </Button>
        </div>
      )}
    </div>
  );
}
