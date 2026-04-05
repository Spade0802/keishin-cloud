'use client';

import { useState, useMemo, useCallback, useRef } from 'react';
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
  ArrowRightLeft,
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  ResponsiveContainer,
  LabelList,
} from 'recharts';
import type { Props as RechartsLabelProps } from 'recharts/types/component/Label';
import type {
  AnalysisResult,
  AnalysisInput,
  ReclassificationItem,
  SimulationCase,
  ItemAssessment,
  RiskPoint,
  ImpactRankingItem,
  ChecklistItem,
  AccountMappingSuggestion,
  TrendInsights,
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

// ─── チャート: ケース比較バーチャート ───

const CASE_COLORS = {
  '現状': '#6b7280', // gray-500
  '全項目適用': '#16a34a', // green-600
  '選択適用': '#f59e0b', // amber-500
} as const;

/** YInputフィールド名 → 日本語ラベル */
const FIELD_LABELS: Record<string, string> = {
  sales: '完成工事高',
  grossProfit: '売上総利益',
  ordinaryProfit: '経常利益',
  interestExpense: '支払利息',
  interestDividendIncome: '受取利息配当金',
  currentLiabilities: '流動負債',
  fixedLiabilities: '固定負債',
  totalCapital: '総資本',
  equity: '純資産額',
  fixedAssets: '固定資産',
  retainedEarnings: '利益剰余金',
  corporateTax: '法人税等',
  depreciation: '減価償却実施額',
  allowanceDoubtful: '貸倒引当金',
  notesAndAccountsReceivable: '受取手形・売掛金',
  constructionPayable: '工事未払金',
  inventoryAndMaterials: '棚卸資産',
  advanceReceived: '未成工事受入金',
};

const COMPONENT_COLORS = ['#6366f1', '#06b6d4', '#f97316', '#8b5cf6'] as const;

interface CaseChartData {
  label: string;
  description: string;
  P: number;
  Y: number;
  X2: number;
  Z?: number;
  W?: number;
}

/** P点比較の横棒グラフ + 構成要素の縦棒グラフ */
function CaseComparisonChart({ cases }: { cases: CaseChartData[] }) {
  if (cases.length === 0) return null;

  const baseP = cases[0]?.P ?? 0;

  // P点比較用データ（横棒）
  const pChartData = cases.map((c) => ({
    name: c.description || c.label,
    caseLabel: c.description || c.label,
    P: c.P,
    delta: c.P - baseP,
  }));

  // 構成要素比較用データ（縦棒グループ）- 動的生成
  const caseKeys = cases.map((c) => c.description || c.label);
  const hasZW = cases.some((c) => c.Z !== undefined && c.W !== undefined);
  const metrics = hasZW
    ? [
        { name: 'Y点', getter: (c: CaseChartData) => c.Y },
        { name: 'X2点', getter: (c: CaseChartData) => c.X2 },
        { name: 'Z点', getter: (c: CaseChartData) => c.Z ?? 0 },
        { name: 'W点', getter: (c: CaseChartData) => c.W ?? 0 },
      ]
    : [
        { name: 'Y点', getter: (c: CaseChartData) => c.Y },
        { name: 'X2点', getter: (c: CaseChartData) => c.X2 },
      ];
  const componentData = metrics.map((m) => {
    const row: Record<string, string | number> = { name: m.name };
    cases.forEach((c, i) => { row[caseKeys[i]] = m.getter(c); });
    return row;
  });

  const renderDeltaLabel = (props: RechartsLabelProps) => {
    const x = Number(props.x ?? 0);
    const y = Number(props.y ?? 0);
    const width = Number(props.width ?? 0);
    const value = Number(props.value ?? 0);
    const index = Number(props.index ?? 0);
    if (index === 0 || value === baseP) return null;
    const diff = value - baseP;
    const sign = diff > 0 ? '+' : '';
    return (
      <text
        x={x + width + 6}
        y={y + 14}
        fill={diff > 0 ? '#16a34a' : diff < 0 ? '#dc2626' : '#6b7280'}
        fontSize={13}
        fontWeight="bold"
      >
        {sign}{diff}
      </text>
    );
  };

  return (
    <div className="space-y-6">
      {/* P点比較 横棒グラフ */}
      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          P点比較
        </h4>
        <div className="w-full" style={{ height: `${Math.max(cases.length * 56 + 40, 120)}px` }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={pChartData}
              layout="vertical"
              margin={{ top: 5, right: 60, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" fontSize={12} />
              <YAxis
                type="category"
                dataKey="name"
                width={160}
                fontSize={12}
                tick={{ fill: '#374151' }}
              />
              <Tooltip
                formatter={(value, _name, entry) => {
                  const d = (entry?.payload as { delta?: number })?.delta ?? 0;
                  const suffix = d !== 0 ? ` (${d > 0 ? '+' : ''}${d})` : '';
                  return [`${value}${suffix}`, 'P点'];
                }}
              />
              <Bar dataKey="P" radius={[0, 4, 4, 0]} maxBarSize={36}>
                {pChartData.map((entry, idx) => (
                  <Cell
                    key={entry.caseLabel}
                    fill={Object.values(CASE_COLORS)[idx] || '#6b7280'}
                  />
                ))}
                <LabelList dataKey="P" position="insideRight" fill="#fff" fontWeight="bold" fontSize={13} />
                <LabelList content={renderDeltaLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* 構成要素比較 縦棒グラフ */}
      <div>
        <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          構成要素スコア比較
        </h4>
        <div className="w-full" style={{ height: '260px' }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={componentData}
              margin={{ top: 20, right: 20, left: 0, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" fontSize={12} />
              <YAxis fontSize={12} />
              <Tooltip />
              <Legend />
              {caseKeys.map((key, idx) => (
                <Bar key={key} dataKey={key} fill={Object.values(CASE_COLORS)[idx] || '#6b7280'} radius={[4, 4, 0, 0]} maxBarSize={32}>
                  <LabelList dataKey={key} position="top" fontSize={11} fill={Object.values(CASE_COLORS)[idx] || '#6b7280'} />
                </Bar>
              ))}
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}

// ─── セクション: P点改善インパクトランキング ───

function difficultyBadgeColor(difficulty: ImpactRankingItem['difficulty']) {
  switch (difficulty) {
    case 'easy':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'medium':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'hard':
      return 'bg-red-100 text-red-800 border-red-300';
    default:
      return 'bg-gray-100 text-gray-600 border-gray-300';
  }
}

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
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{item.item}</span>
                  {item.difficulty && (
                    <Badge variant="outline" className={`text-[10px] px-1.5 py-0 ${difficultyBadgeColor(item.difficulty)}`}>
                      {item.difficultyLabel || (item.difficulty === 'easy' ? '簡単' : item.difficulty === 'hard' ? '困難' : '普通')}
                    </Badge>
                  )}
                </div>
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
  const [checked, setChecked] = useState<Record<number, boolean>>({});
  const checkedCount = Object.values(checked).filter(Boolean).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <CheckSquare className="h-5 w-5 text-blue-500" />
          確認すべき事項
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {checkedCount}/{items.length}件 確認済み
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-1.5">
          {items.map((item, i) => (
            <label
              key={i}
              className={`flex items-start gap-3 py-2 border-b last:border-b-0 cursor-pointer transition-colors ${
                checked[i] ? 'bg-emerald-50/50' : 'hover:bg-muted/30'
              }`}
            >
              <input
                type="checkbox"
                checked={!!checked[i]}
                onChange={() => setChecked((p) => ({ ...p, [i]: !p[i] }))}
                className="h-4 w-4 rounded border-gray-300 mt-0.5 shrink-0"
              />
              <div className="flex-1 min-w-0">
                <div className={`text-sm ${checked[i] ? 'line-through text-muted-foreground' : ''}`}>{item.item}</div>
              </div>
              <Badge variant="outline" className="shrink-0 text-xs">
                確認先: {item.target}
              </Badge>
            </label>
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
                  { label: 'Y(経営状況)', value: item.yImpact },
                  { label: 'X(技術力)', value: item.xImpact },
                  { label: 'Z(技術職員)', value: item.zImpact },
                  { label: 'W(社会性)', value: item.wImpact },
                  { label: 'P(総合)', value: item.pImpact },
                ].map(({ label, value }) => (
                  <div
                    key={label}
                    className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono ${
                      label.startsWith('P')
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

        {/* ビジュアル比較チャート */}
        {(() => {
          const firstIndustry = industryNames[0] || '';
          const chartCases: CaseChartData[] = cases.map((c) => ({
            label: c.label,
            description: c.description,
            P: c.scores.p[firstIndustry] ?? 0,
            Y: c.scores.y,
            X2: c.scores.x2,
            Z: Object.values(c.scores.z)[0],
            W: c.scores.w,
          }));
          return <CaseComparisonChart cases={chartCases} />;
        })()}

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
                    : 'border-emerald-200 bg-emerald-50/30'
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

  const [enabledItems, setEnabledItems] = useState<Record<number, boolean>>({});

  // affectedFieldsがあるアイテムだけフィルタ
  const simulableItems = useMemo(() =>
    items.filter((item) => item.affectedFields && Object.keys(item.affectedFields).length > 0),
    [items],
  );

  // yInputがない場合はシミュレーション不可
  if (!yInput || !industryCalcData || industryCalcData.length === 0) {
    return (
      <Card className="text-center">
        <CardContent className="py-8 text-muted-foreground">
          <Calculator className="mx-auto h-10 w-10 mb-3 opacity-50" />
          <p className="text-sm">シミュレーションには決算書データの入力が必要です</p>
        </CardContent>
      </Card>
    );
  }

  if (simulableItems.length === 0) return null;

  const toggleItem = (no: number) => {
    setEnabledItems((prev) => ({ ...prev, [no]: !prev[no] }));
  };

  const toggleAll = () => {
    const allEnabled = simulableItems.every((item) => enabledItems[item.no]);
    if (allEnabled) {
      setEnabledItems({});
    } else {
      const all: Record<number, boolean> = {};
      for (const item of simulableItems) all[item.no] = true;
      setEnabledItems(all);
    }
  };

  const WScore = W ?? Math.floor(((wTotal || 0) * 1750) / 200);
  const ebitdaVal = ebitda ?? 0;

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
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-muted-foreground">{simulableItems.length}件の再分類項目</span>
            <Button variant="ghost" size="sm" className="text-xs h-7" onClick={toggleAll}>
              {simulableItems.every((item) => enabledItems[item.no]) ? '全解除' : '全選択'}
            </Button>
          </div>
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
                    .map(([k, v]) => `${FIELD_LABELS[k] || k}: ${(v as number) > 0 ? '+' : ''}${v}`)
                    .join(', ')}
                </span>
                <Badge variant="outline" className={assessmentColor(item.assessment)}>
                  {item.assessment}
                </Badge>
              </div>
            </label>
          ))}
        </div>

        {/* 凡例 */}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground bg-muted/30 rounded-lg p-3">
          <span><span className="inline-block w-3 h-3 rounded-sm bg-gray-500 mr-1" />現状: 変更なしの場合</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-green-600 mr-1" />全項目適用: 上記すべての項目を適用した場合</span>
          <span><span className="inline-block w-3 h-3 rounded-sm bg-amber-500 mr-1" />選択適用: チェックした項目のみ適用した場合</span>
        </div>

        {/* ビジュアル比較チャート */}
        <CaseComparisonChart
          cases={[
            { label: '現状', description: '現状', P: pA, Y: caseA.Y, X2: caseA.X2 },
            { label: '全項目適用', description: '全項目適用', P: pB, Y: caseB.Y, X2: caseB.X2 },
            { label: '選択適用', description: '選択適用', P: pC, Y: caseC.Y, X2: caseC.X2 },
          ]}
        />

        {/* 3パターン比較カード */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="border-gray-300">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">現状</CardTitle>
              <p className="text-xs text-muted-foreground">変更なしの場合</p>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold">{pA}</div>
              <div className="text-xs text-muted-foreground mt-1">P点（{primaryIndustry}）</div>
              <div className="mt-2 text-xs text-muted-foreground">
                Y(経営状況)={caseA.Y}　X2(自己資本等)={caseA.X2}
              </div>
            </CardContent>
          </Card>

          <Card className="border-emerald-300 bg-emerald-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-emerald-700">全項目適用</CardTitle>
              <p className="text-xs text-muted-foreground">全再分類を適用した最大改善ケース</p>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold text-emerald-700">{pB}</div>
              <div className="text-xs text-muted-foreground mt-1">P点（{primaryIndustry}）</div>
              <div className="mt-2"><DiffArrow base={pA} value={pB} /></div>
              <div className="mt-1 text-xs text-muted-foreground">
                Y={caseB.Y}　X2={caseB.X2}
              </div>
            </CardContent>
          </Card>

          <Card className="border-amber-300 bg-amber-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-amber-700">選択適用</CardTitle>
              <p className="text-xs text-muted-foreground">上でチェックした項目のみ</p>
            </CardHeader>
            <CardContent className="text-center">
              <div className="text-4xl font-bold text-amber-700">{pC}</div>
              <div className="text-xs text-muted-foreground mt-1">P点（{primaryIndustry}）</div>
              <div className="mt-2"><DiffArrow base={pA} value={pC} /></div>
              <div className="mt-1 text-xs text-muted-foreground">
                Y={caseC.Y}　X2={caseC.X2}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* 全業種のP点比較テーブル */}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-xs text-muted-foreground">
                <th className="py-2 text-left">業種</th>
                <th className="py-2 text-center">現状</th>
                <th className="py-2 text-center text-emerald-600">全項目適用</th>
                <th className="py-2 text-center text-amber-600">選択適用</th>
                <th className="py-2 text-center text-emerald-600">差分</th>
                <th className="py-2 text-center text-amber-600">差分</th>
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

        <p className="text-xs text-muted-foreground">
          P = 0.25×X1(完工高) + 0.15×X2(自己資本等) + 0.20×Y(経営状況) + 0.25×Z(技術力) + 0.15×W(社会性)
        </p>
      </CardContent>
    </Card>
  );
}

// ─── セクション: 勘定科目マッピング提案 ───

function riskBadgeColor(risk: AccountMappingSuggestion['risk']) {
  switch (risk) {
    case 'low':
      return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    case 'medium':
      return 'bg-amber-100 text-amber-800 border-amber-300';
    case 'high':
      return 'bg-red-100 text-red-800 border-red-300';
  }
}

function riskLabel(risk: AccountMappingSuggestion['risk']) {
  switch (risk) {
    case 'low':
      return '低リスク';
    case 'medium':
      return '中リスク';
    case 'high':
      return '高リスク';
  }
}

function AccountMappingSuggestionsSection({ items }: { items: AccountMappingSuggestion[] }) {
  if (!items || items.length === 0) return null;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <ArrowRightLeft className="h-5 w-5 text-indigo-500" />
          勘定科目マッピング提案
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          経審用BSの科目分類を変更することでP点改善が見込める提案です。
          あくまで参考情報であり、実施にあたっては専門家にご確認ください。
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 参考情報の注記 */}
        <div className="rounded-lg border border-blue-200 bg-blue-50 p-3">
          <p className="text-xs text-blue-700">
            以下の提案は会計基準上認められる可能性のある代替分類です。
            実際の適用可否は取引の実態・契約内容に基づいて税理士・行政書士にご確認ください。
          </p>
        </div>

        {items.map((item, i) => (
          <div
            key={i}
            className="rounded-lg border hover:shadow-sm transition-shadow"
          >
            {/* ヘッダー行 */}
            <div className="flex items-center justify-between p-3 border-b bg-muted/30 rounded-t-lg">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm">{item.accountName}</span>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className={riskBadgeColor(item.risk)}>
                  {riskLabel(item.risk)}
                </Badge>
                <Badge variant="outline" className={assessmentColor(item.assessment)}>
                  {item.assessment}
                </Badge>
              </div>
            </div>

            {/* 本体 */}
            <div className="p-3 space-y-3">
              {/* 現在 → 提案 */}
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-3 items-center">
                <div>
                  <div className="text-xs font-medium text-muted-foreground mb-1">
                    現在の区分
                  </div>
                  <div className="text-sm bg-gray-50 rounded p-2">
                    {item.currentMapping}
                  </div>
                </div>
                <div className="hidden md:flex items-center justify-center">
                  <ArrowRightLeft className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="text-xs font-medium text-indigo-600 mb-1">
                    提案する区分
                  </div>
                  <div className="text-sm bg-indigo-50 rounded p-2">
                    {item.suggestedMapping}
                  </div>
                </div>
              </div>

              {/* 根拠 */}
              <div>
                <div className="text-xs font-medium text-muted-foreground mb-1">
                  根拠
                </div>
                <div className="text-xs text-muted-foreground">{item.rationale}</div>
              </div>

              {/* 影響バッジ */}
              <div className="flex flex-wrap gap-2">
                <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono bg-primary/10 text-primary font-bold">
                  <span className="font-medium">P影響</span>
                  <span>{item.pImpact || '—'}</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-mono bg-muted">
                  <span className="font-medium">Y影響</span>
                  <span>{item.yImpact || '—'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── セクション: 期間推移分析 ───

function TrendInsightsSection({ insights }: { insights: TrendInsights }) {
  return (
    <Card className="border-blue-200">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          期間推移分析
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          前期と当期のデータを比較した推移分析です
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 全体傾向 */}
        <div className="rounded-lg border bg-blue-50/50 p-4">
          <div className="text-xs font-semibold text-blue-700 mb-1">全体傾向</div>
          <p className="text-sm leading-relaxed">{insights.overallTrend}</p>
        </div>

        {/* 主要な変化点 */}
        <div>
          <div className="text-xs font-semibold text-muted-foreground mb-2">主要な変化点</div>
          <div className="space-y-2">
            {insights.keyChanges.map((change, i) => (
              <div
                key={i}
                className="flex items-start gap-2 rounded-lg border p-3 hover:bg-muted/20 transition-colors"
              >
                <ChevronRight className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
                <span className="text-sm">{change}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 推移リスク */}
        {insights.riskFromTrend && (
          <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/50 p-3">
            <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <div className="text-xs font-semibold text-amber-700 mb-0.5">推移から読み取れるリスク</div>
              <p className="text-sm text-amber-800">{insights.riskFromTrend}</p>
            </div>
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

  // ローディングスケルトン: 分析中に表示
  if (loading) {
    return (
      <div className="space-y-6" role="status" aria-label="AI分析を実行中">
        {/* スケルトン: サマリー */}
        <Card className="border-primary/20">
          <CardHeader className="pb-2">
            <div className="flex items-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
              <span className="text-base font-semibold">AI分析を実行中...</span>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="h-4 w-3/4 animate-pulse rounded bg-muted" />
            <div className="h-4 w-full animate-pulse rounded bg-muted" />
            <div className="h-4 w-5/6 animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>

        {/* スケルトン: 再分類レビュー */}
        <Card>
          <CardHeader className="pb-2">
            <div className="h-5 w-48 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-lg border p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="h-4 w-24 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-16 animate-pulse rounded-full bg-muted" />
                </div>
                <div className="h-3 w-full animate-pulse rounded bg-muted" />
                <div className="h-3 w-2/3 animate-pulse rounded bg-muted" />
              </div>
            ))}
          </CardContent>
        </Card>

        {/* スケルトン: シミュレーション */}
        <Card>
          <CardHeader className="pb-2">
            <div className="h-5 w-56 animate-pulse rounded bg-muted" />
          </CardHeader>
          <CardContent>
            <div className="h-48 w-full animate-pulse rounded bg-muted" />
          </CardContent>
        </Card>

        <p className="text-center text-sm text-muted-foreground">
          AIが経審データを分析しています。30秒〜1分程度お待ちください...
        </p>
      </div>
    );
  }

  // まだ分析結果がない場合: ボタンを表示
  if (!result) {
    return (
      <Card className="text-center">
        <CardContent className="py-12">
          <Sparkles className="mx-auto h-12 w-12 mb-4 text-primary/50" />
          <h3 className="text-lg font-bold mb-2">AIによる経審コンサル分析</h3>
          <p className="text-sm text-muted-foreground mb-6 max-w-md mx-auto">
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
            disabled={readOnly}
            className="px-8"
          >
            <Sparkles className="mr-2 h-5 w-5" />
            AI分析を実行
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

      {/* 期間推移分析 */}
      {result.trendInsights && (
        <TrendInsightsSection insights={result.trendInsights} />
      )}

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

      {/* 3セクション タブ */}
      <Tabs defaultValue="simulation" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="simulation" className="text-xs sm:text-sm gap-1">
            <BarChart3 className="h-3.5 w-3.5 hidden sm:block" />
            シミュレーション
          </TabsTrigger>
          <TabsTrigger value="assessment" className="text-xs sm:text-sm gap-1">
            <ClipboardCheck className="h-3.5 w-3.5 hidden sm:block" />
            再分類・判定
          </TabsTrigger>
          <TabsTrigger value="risk" className="text-xs sm:text-sm gap-1">
            <ShieldAlert className="h-3.5 w-3.5 hidden sm:block" />
            リスク論点
          </TabsTrigger>
        </TabsList>

        <TabsContent value="simulation">
          {analysisInput && (result.reclassificationReview ?? []).length > 0 ? (
            <ReclassificationSimulation
              items={result.reclassificationReview ?? []}
              analysisInput={analysisInput}
            />
          ) : (
            <SimulationTable cases={result.simulationComparison ?? []} />
          )}
        </TabsContent>

        <TabsContent value="assessment" className="space-y-6">
          <ReclassificationCards items={result.reclassificationReview ?? []} />
          <ItemAssessmentList items={result.itemAssessments ?? []} />
          {result.accountMappingSuggestions && result.accountMappingSuggestions.length > 0 && (
            <AccountMappingSuggestionsSection items={result.accountMappingSuggestions} />
          )}
        </TabsContent>

        <TabsContent value="risk">
          <RiskPointList items={result.riskPoints ?? []} />
        </TabsContent>
      </Tabs>

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
