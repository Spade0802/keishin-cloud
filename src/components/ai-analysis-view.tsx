'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertTriangle,
  Sparkles,
  Loader2,
  Table2,
  BarChart3,
  ClipboardCheck,
  ShieldAlert,
  TrendingUp,
  CheckSquare,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  Trophy,
  ChevronRight,
  Calculator,
} from 'lucide-react';
import type {
  AnalysisResult,
  AnalysisInput,
  ReclassificationItem,
  SimulationCase,
  ItemAssessment,
  RiskPoint,
  ImpactRankingItem,
  ChecklistItem,
} from '@/lib/ai-analysis-types';
import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ } from '@/lib/engine/p-calculator';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';
import type { YInput } from '@/lib/engine/types';

interface AiAnalysisViewProps {
  analysisInput?: AnalysisInput;
  staticResult?: AnalysisResult;
  readOnly?: boolean;
}

// ─── ヘルパー ───

function assessmentColor(assessment: ReclassificationItem['assessment']) {
  switch (assessment) {
    case '採用余地あり':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case '要確認':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case '非推奨':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function assessmentIcon(assessment: ReclassificationItem['assessment']) {
  switch (assessment) {
    case '採用余地あり':
      return <ArrowUpRight className="h-4 w-4 text-emerald-600" />;
    case '要確認':
      return <Minus className="h-4 w-4 text-amber-600" />;
    case '非推奨':
      return <ArrowDownRight className="h-4 w-4 text-red-600" />;
    default:
      return <Minus className="h-4 w-4 text-muted-foreground" />;
  }
}

function severityColor(severity: RiskPoint['severity']) {
  switch (severity) {
    case '高':
      return 'bg-red-100 text-red-800 border-red-300';
    case '中':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case '低':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
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
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'reviewable':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'insufficientBasis':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'shouldNotDo':
      return 'bg-red-50 text-red-700 border-red-200';
  }
}

function categoryIcon(category: ItemAssessment['category']) {
  switch (category) {
    case 'confirmed':
      return '✅';
    case 'reviewable':
      return '🔍';
    case 'insufficientBasis':
      return '⚠️';
    case 'shouldNotDo':
      return '🚫';
  }
}

function formatDelta(val: number): string {
  if (val > 0) return `+${val}`;
  if (val === 0) return '±0';
  return `${val}`;
}

// ─── セクション: P点改善インパクトランキング ───

function ImpactRankingSection({ items }: { items: ImpactRankingItem[] }) {
  if (!items || items.length === 0) return null;

  const rankColor = (rank: number) => {
    if (rank === 1) return 'bg-yellow-400 text-yellow-900';
    if (rank === 2) return 'bg-gray-300 text-gray-800';
    if (rank === 3) return 'bg-amber-600 text-white';
    return 'bg-gray-100 text-gray-600';
  };

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          P点改善インパクト順ランキング
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          影響度が大きい順に並べています
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          {items.map((item) => (
            <div
              key={item.rank}
              className="flex items-center gap-3 rounded-lg border p-3 hover:bg-muted/30 transition-colors"
            >
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${rankColor(item.rank)}`}
              >
                {item.rank}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{item.item}</div>
                <div className="text-xs text-muted-foreground mt-0.5">{item.comment}</div>
              </div>
              <div className="text-right shrink-0">
                <div className="text-sm font-mono font-bold text-primary">{item.pImpact}</div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── セクション: 確認すべき事項チェックリスト ───

function ChecklistSection({ items }: { items: ChecklistItem[] }) {
  if (!items || items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-blue-500" />
          経理担当・税理士・行政書士へ確認すべき事項
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <div key={i} className="flex items-start gap-3 py-2 border-b last:border-b-0">
              <div className="w-5 h-5 rounded border-2 border-gray-300 shrink-0 mt-0.5" />
              <div className="flex-1 min-w-0">
                <div className="text-sm">{item.item}</div>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs">
                {item.target}
              </Badge>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── セクション1: 再分類レビュー（カード型） ───

function ReclassificationCards({ items }: { items: ReclassificationItem[] }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Table2 className="h-5 w-5" />
          再分類レビュー
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          各科目の組替余地・適法性・P点影響を分析しています
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {items.map((item) => (
          <div
            key={item.no}
            className="rounded-lg border hover:shadow-sm transition-shadow"
          >
            {/* ヘッダー行 */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/30 rounded-t-lg">
              <div className="flex items-center gap-2">
                {assessmentIcon(item.assessment)}
                <span className="font-mono text-xs text-muted-foreground">
                  No.{item.no}
                </span>
                <span className="font-semibold text-sm">{item.item}</span>
              </div>
              <Badge variant="outline" className={assessmentColor(item.assessment)}>
                {item.assessment}
              </Badge>
            </div>

            {/* 本体 */}
            <div className="p-3 space-y-3">
              {/* 現在の処理 → 代替案 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    現在の処理
                  </div>
                  <div className="text-sm bg-gray-50 rounded p-2">
                    {item.currentTreatment}
                  </div>
                </div>
                <div>
                  <div className="text-xs font-medium text-blue-600 mb-1">
                    代替処理案
                  </div>
                  <div className="text-sm bg-blue-50 rounded p-2">
                    {item.alternativePlan}
                  </div>
                </div>
              </div>

              {/* 適法性・必要証憑 */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    適法性・根拠
                  </div>
                  <div className="text-xs text-muted-foreground">{item.legality}</div>
                </div>
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    必要証憑
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {item.requiredDocuments}
                  </div>
                </div>
              </div>

              {/* 影響度バー */}
              <div className="flex flex-wrap gap-2">
                {[
                  { label: 'Y', value: item.yImpact },
                  { label: 'X', value: item.xImpact },
                  { label: 'Z', value: item.zImpact },
                  { label: 'W', value: item.wImpact },
                  { label: 'P', value: item.pImpact },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono ${
                      label === 'P'
                        ? 'bg-primary/10 text-primary font-bold'
                        : 'bg-muted'
                    }`}
                  >
                    <span className="font-medium">{label}</span>
                    <span>{value || '—'}</span>
                  </div>
                ))}
              </div>

              {/* リスク */}
              {item.risk && item.risk !== '—' && (
                <div className="flex items-start gap-2 rounded-md bg-red-50 p-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                  <span className="text-xs text-red-700">{item.risk}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── セクション2: シミュレーション比較 ───

function SimulationTable({ cases }: { cases: SimulationCase[] }) {
  if (cases.length === 0) return null;
  const caseA = cases[0];
  const caseB = cases[1];
  const caseC = cases[2];
  const industryNames = Object.keys(caseA.scores.p);

  type ScoreRow = {
    label: string;
    bold?: boolean;
    getValue: (c: SimulationCase) => number | undefined;
  };

  const scoreRows: ScoreRow[] = [
    { label: 'Y（経営状況）', getValue: (c) => c.scores.y },
    { label: 'X2（自己資本等）', getValue: (c) => c.scores.x2 },
    { label: 'W（社会性等）', getValue: (c) => c.scores.w },
    ...industryNames.map((name) => ({
      label: `P点（${name}）`,
      bold: true,
      getValue: (c: SimulationCase) => c.scores.p[name],
    })),
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          シミュレーション比較
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          Case B は全条件充足時の上限値。実際には A と B の間に着地する可能性が高い。
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 前提条件カード */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {cases.map((c) => {
            const isOptimal = c.label === 'Case B';
            const isConservative = c.label === 'Case C';
            return (
              <div
                key={c.label}
                className={`rounded-lg border p-3 ${
                  isOptimal
                    ? 'border-blue-200 bg-blue-50/50'
                    : isConservative
                      ? 'border-emerald-200 bg-emerald-50/50'
                      : 'bg-muted/30'
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span
                    className={`text-sm font-bold ${
                      isOptimal
                        ? 'text-blue-700'
                        : isConservative
                          ? 'text-emerald-700'
                          : ''
                    }`}
                  >
                    {c.label}
                  </span>
                  <span className="text-xs text-muted-foreground">{c.description}</span>
                </div>
                <div className="space-y-1">
                  {Object.entries(c.assumptions).length > 0 ? (
                    Object.entries(c.assumptions).map(([k, v]) => (
                      <div key={k} className="flex justify-between text-xs gap-2">
                        <span className="text-muted-foreground truncate">{k}</span>
                        <span className="font-mono shrink-0">{v}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">変更なし</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* スコア比較テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2.5 text-left font-medium">評点</th>
                <th className="py-2.5 text-center font-medium">Case A</th>
                {caseB && (
                  <th className="py-2.5 text-center font-medium text-blue-600">
                    Case B
                  </th>
                )}
                {caseC && (
                  <th className="py-2.5 text-center font-medium text-emerald-600">
                    Case C
                  </th>
                )}
                {caseB && (
                  <th className="py-2.5 text-center font-medium text-blue-600">
                    B-A差
                  </th>
                )}
                {caseC && (
                  <th className="py-2.5 text-center font-medium text-emerald-600">
                    C-A差
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {scoreRows.map((row) => {
                const aVal = row.getValue(caseA) ?? 0;
                const bVal = caseB ? (row.getValue(caseB) ?? 0) : 0;
                const cVal = caseC ? (row.getValue(caseC) ?? 0) : 0;
                const bDelta = bVal - aVal;
                const cDelta = cVal - aVal;
                return (
                  <tr
                    key={row.label}
                    className={`border-b ${row.bold ? 'bg-muted/20' : ''}`}
                  >
                    <td className={`py-2.5 ${row.bold ? 'font-semibold' : 'font-medium'} text-sm`}>
                      {row.label}
                    </td>
                    <td className="py-2.5 text-center font-mono">{aVal}</td>
                    {caseB && (
                      <td className={`py-2.5 text-center font-mono ${row.bold ? 'font-bold' : ''}`}>
                        {bVal}
                      </td>
                    )}
                    {caseC && (
                      <td className={`py-2.5 text-center font-mono ${row.bold ? 'font-bold' : ''}`}>
                        {cVal}
                      </td>
                    )}
                    {caseB && (
                      <td
                        className={`py-2.5 text-center font-mono font-bold ${
                          bDelta > 0
                            ? 'text-blue-600'
                            : bDelta < 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {formatDelta(bDelta)}
                      </td>
                    )}
                    {caseC && (
                      <td
                        className={`py-2.5 text-center font-mono font-bold ${
                          cDelta > 0
                            ? 'text-emerald-600'
                            : cDelta < 0
                              ? 'text-red-600'
                              : 'text-muted-foreground'
                        }`}
                      >
                        {formatDelta(cDelta)}
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="text-xs text-muted-foreground">
          P = 0.25 x X1 + 0.15 x X2 + 0.20 x Y + 0.25 x Z + 0.15 x W
        </p>
      </CardContent>
    </Card>
  );
}

// ─── セクション3: 項目判定一覧 ───

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
      <CardHeader className="pb-3">
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
                <span className="text-base">{categoryIcon(cat)}</span>
                <Badge variant="outline" className={`${categoryColor(cat)} font-medium`}>
                  {categoryLabel(cat)}
                </Badge>
                <span className="text-xs text-muted-foreground">{catItems.length}件</span>
              </div>
              <div className="space-y-2">
                {catItems.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3 rounded-lg border p-3 hover:bg-muted/20 transition-colors"
                  >
                    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">{item.item}</div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {item.action}
                      </div>
                    </div>
                    <div className="text-right shrink-0 space-y-1">
                      <div className="text-xs text-muted-foreground">現状</div>
                      <div className="text-xs font-mono">{item.currentPImpact}</div>
                      {item.revisedPImpact &&
                        item.revisedPImpact !== '—' &&
                        item.revisedPImpact !== item.currentPImpact && (
                          <>
                            <div className="text-xs text-muted-foreground mt-1">見直し後</div>
                            <div className="text-xs font-mono font-bold text-primary">
                              {item.revisedPImpact}
                            </div>
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

// ─── セクション4: リスク論点 ───

function RiskPointList({ items }: { items: RiskPoint[] }) {
  // 高→中→低 の順にソート
  const sorted = [...items].sort((a, b) => {
    const order = { '高': 0, '中': 1, '低': 2 };
    return order[a.severity] - order[b.severity];
  });

  return (
    <Card>
      <CardHeader className="pb-3">
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
          {sorted.map((item, i) => (
            <div
              key={i}
              className={`rounded-lg border p-4 ${
                item.severity === '高'
                  ? 'border-red-200 bg-red-50/30'
                  : item.severity === '中'
                    ? 'border-amber-200 bg-amber-50/30'
                    : ''
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Badge variant="outline" className={severityColor(item.severity)}>
                  {item.severity === '高' ? '高リスク' : item.severity === '中' ? '中リスク' : '低リスク'}
                </Badge>
                <span className="font-medium text-sm">{item.topic}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-3">{item.riskContent}</p>
              <div className="flex items-start gap-2 rounded-md bg-white/80 border p-2.5">
                <span className="text-xs font-semibold text-primary shrink-0">対応方針</span>
                <span className="text-xs">{item.response}</span>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── セクション: 再分類シミュレーション（実計算） ───

interface ReclassSimProps {
  items: ReclassificationItem[];
  analysisInput: AnalysisInput;
}

function ReclassificationSimulation({ items, analysisInput }: ReclassSimProps) {
  const { yInput, ebitda, industryCalcData, W, wTotal } = analysisInput;

  // yInputがない場合はシミュレーション不可
  if (!yInput || !industryCalcData || industryCalcData.length === 0) {
    return null;
  }

  const [enabledItems, setEnabledItems] = useState<Record<number, boolean>>({});

  // affectedFieldsがあるアイテムだけフィルタ
  const simulableItems = items.filter(
    (item) => item.affectedFields && Object.keys(item.affectedFields).length > 0,
  );

  if (simulableItems.length === 0) return null;

  const toggleItem = (no: number) => {
    setEnabledItems((prev) => ({ ...prev, [no]: !prev[no] }));
  };

  const WScore = W || Math.floor(((wTotal || 0) * 1750) / 200);
  const ebitdaVal = ebitda || 0;

  function calcCase(adjustments: Partial<YInput>): { Y: number; X2: number; results: Array<{ name: string; P: number }> } {
    const base: YInput = { ...yInput!, prev: { ...yInput!.prev } };
    for (const [key, val] of Object.entries(adjustments)) {
      if (key === 'prev' || typeof val !== 'number') continue;
      if (key in base) {
        (base as unknown as Record<string, number>)[key] += val;
      }
    }

    const yResult = calculateY(base);
    const x21 = lookupScore(X21_TABLE, base.equity);
    const x22 = lookupScore(X22_TABLE, ebitdaVal);
    const x2 = calculateX2(x21, x22);

    const results = industryCalcData!.map((ind) => {
      const X1 = lookupScore(X1_TABLE, ind.avgCompletion);
      const z1 = lookupScore(Z1_TABLE, ind.techStaffValue);
      const z2 = lookupScore(Z2_TABLE, ind.avgSubcontract);
      const Z = calculateZ(z1, z2);
      const P = calculateP(X1, x2, yResult.Y, Z, WScore);
      return { name: ind.name, P };
    });

    return { Y: yResult.Y, X2: x2, results };
  }

  // Case A: 現状
  const caseA = calcCase({});

  // Case B: 全項目適用
  const allAdj: Partial<YInput> = {};
  for (const item of simulableItems) {
    for (const [key, val] of Object.entries(item.affectedFields!)) {
      if (typeof val === 'number') {
        (allAdj as Record<string, number>)[key] = ((allAdj as Record<string, number>)[key] || 0) + val;
      }
    }
  }
  const caseB = calcCase(allAdj);

  // Case C: 選択項目のみ
  const selectedAdj: Partial<YInput> = {};
  for (const item of simulableItems) {
    if (enabledItems[item.no]) {
      for (const [key, val] of Object.entries(item.affectedFields!)) {
        if (typeof val === 'number') {
          (selectedAdj as Record<string, number>)[key] = ((selectedAdj as Record<string, number>)[key] || 0) + val;
        }
      }
    }
  }
  const caseC = calcCase(selectedAdj);

  const primaryIndustry = caseA.results[0]?.name || '';
  const pA = caseA.results[0]?.P ?? 0;
  const pB = caseB.results[0]?.P ?? 0;
  const pC = caseC.results[0]?.P ?? 0;

  function DiffArrow({ base, value }: { base: number; value: number }) {
    const diff = value - base;
    if (diff > 0) return <span className="text-emerald-600 text-sm font-medium flex items-center justify-center"><ArrowUpRight className="h-3 w-3" />+{diff}</span>;
    if (diff < 0) return <span className="text-red-600 text-sm font-medium flex items-center justify-center"><ArrowDownRight className="h-3 w-3" />{diff}</span>;
    return <span className="text-muted-foreground text-sm flex items-center justify-center"><Minus className="h-3 w-3" />±0</span>;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Calculator className="h-5 w-5 text-primary" />
          再分類シミュレーション（実計算）
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          AIが提案する再分類項目を選択して、実際のP点への影響をリアルタイム計算します
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 再分類項目チェックリスト */}
        <div className="space-y-2">
          {simulableItems.map((item) => (
            <label
              key={item.no}
              className={`flex items-center gap-3 rounded-lg border p-3 cursor-pointer transition-colors ${
                enabledItems[item.no] ? 'bg-primary/5 border-primary/30' : 'hover:bg-muted/30'
              }`}
            >
              <input
                type="checkbox"
                checked={!!enabledItems[item.no]}
                onChange={() => toggleItem(item.no)}
                className="h-4 w-4 rounded border-gray-300"
              />
              <div className="flex-1 min-w-0">
                <div className="font-medium text-sm">{item.item}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {item.currentTreatment} → {item.alternativePlan}
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-xs font-mono text-muted-foreground">
                  {Object.entries(item.affectedFields || {})
                    .map(([k, v]) => `${k}: ${v as number > 0 ? '+' : ''}${v}`)
                    .join(', ')}
                </span>
                <Badge variant="outline" className={assessmentColor(item.assessment)}>
                  {item.assessment}
                </Badge>
              </div>
            </label>
          ))}
        </div>

        {/* 3パターン比較カード */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-gray-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge variant="outline">Case A</Badge>
                現状ベース
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold">{pA}</div>
              <div className="text-xs text-muted-foreground mt-1">P点（{primaryIndustry}）</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Y={caseA.Y} X2={caseA.X2}
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-300 bg-emerald-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Case B</Badge>
                全項目適用
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold text-emerald-700">{pB}</div>
              <div className="text-xs text-muted-foreground mt-1">P点（{primaryIndustry}）</div>
              <div className="mt-2"><DiffArrow base={pA} value={pB} /></div>
              <div className="mt-1 text-xs text-muted-foreground">
                Y={caseB.Y} X2={caseB.X2}
              </div>
            </CardContent>
          </Card>

          <Card className="border-blue-300 bg-blue-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Case C</Badge>
                選択適用
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold text-blue-700">{pC}</div>
              <div className="text-xs text-muted-foreground mt-1">P点（{primaryIndustry}）</div>
              <div className="mt-2"><DiffArrow base={pA} value={pC} /></div>
              <div className="mt-1 text-xs text-muted-foreground">
                Y={caseC.Y} X2={caseC.X2}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 全業種のP点比較テーブル */}
        {caseA.results.length > 1 && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 text-left">業種</th>
                  <th className="py-2 text-center">Case A</th>
                  <th className="py-2 text-center text-emerald-600">Case B</th>
                  <th className="py-2 text-center text-blue-600">Case C</th>
                  <th className="py-2 text-center text-emerald-600">B-A差</th>
                  <th className="py-2 text-center text-blue-600">C-A差</th>
                </tr>
              </thead>
              <tbody>
                {caseA.results.map((r, i) => {
                  const bP = caseB.results[i]?.P ?? 0;
                  const cP = caseC.results[i]?.P ?? 0;
                  return (
                    <tr key={r.name} className="border-b">
                      <td className="py-2 font-medium">{r.name}</td>
                      <td className="py-2 text-center font-mono">{r.P}</td>
                      <td className="py-2 text-center font-mono font-bold">{bP}</td>
                      <td className="py-2 text-center font-mono font-bold">{cP}</td>
                      <td className="py-2"><DiffArrow base={r.P} value={bP} /></td>
                      <td className="py-2"><DiffArrow base={r.P} value={cP} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── メインコンポーネント ───

export function AiAnalysisView({
  analysisInput,
  staticResult,
  readOnly,
}: AiAnalysisViewProps) {
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
      setError(
        err instanceof Error ? err.message : 'AI分析の実行中にエラーが発生しました',
      );
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
            Gemini
            AIが経審の専門コンサルタントの視点で、P点向上のための合法的な見直し余地を分析します。
            再分類レビュー、シミュレーション比較、リスク分析を含む包括的なレポートを生成します。
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
            <p className="text-sm font-medium text-amber-800">
              AI生成レポート - 免責事項
            </p>
            <p className="text-xs text-amber-700 mt-1">{result.disclaimer}</p>
          </div>
        </div>
      </div>

      {/* サマリー */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-transparent">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            分析サマリー
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm leading-relaxed">{result.summary}</p>
        </CardContent>
      </Card>

      {/* P点改善インパクトランキング + チェックリスト（横並び） */}
      {((result.impactRanking && result.impactRanking.length > 0) ||
        (result.checklistItems && result.checklistItems.length > 0)) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {result.impactRanking && result.impactRanking.length > 0 && (
            <ImpactRankingSection items={result.impactRanking} />
          )}
          {result.checklistItems && result.checklistItems.length > 0 && (
            <ChecklistSection items={result.checklistItems} />
          )}
        </div>
      )}

      {/* 4セクション タブ */}
      <Tabs defaultValue="reclassification" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="reclassification" className="text-xs sm:text-sm gap-1">
            <Table2 className="h-3.5 w-3.5 hidden sm:block" />
            再分類レビュー
          </TabsTrigger>
          <TabsTrigger value="simulation" className="text-xs sm:text-sm gap-1">
            <BarChart3 className="h-3.5 w-3.5 hidden sm:block" />
            シミュレーション
          </TabsTrigger>
          <TabsTrigger value="assessment" className="text-xs sm:text-sm gap-1">
            <ClipboardCheck className="h-3.5 w-3.5 hidden sm:block" />
            項目判定
          </TabsTrigger>
          <TabsTrigger value="risk" className="text-xs sm:text-sm gap-1">
            <ShieldAlert className="h-3.5 w-3.5 hidden sm:block" />
            リスク論点
          </TabsTrigger>
        </TabsList>

        <TabsContent value="reclassification">
          <ReclassificationCards items={result.reclassificationReview} />
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

      {/* 再分類シミュレーション（実計算） */}
      {analysisInput && result.reclassificationReview.length > 0 && (
        <ReclassificationSimulation
          items={result.reclassificationReview}
          analysisInput={analysisInput}
        />
      )}

      {/* 再分析ボタン */}
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
