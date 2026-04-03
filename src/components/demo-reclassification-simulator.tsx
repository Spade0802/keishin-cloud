'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  ArrowRight,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  FileCheck,
  AlertTriangle,
  Shield,
  Ban,
  RotateCcw,
} from 'lucide-react';
import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ } from '@/lib/engine/p-calculator';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';
import { financials, prevData, ebitda, industryInputs, demoResult } from '@/lib/demo-data';
import type { YInput } from '@/lib/engine/types';

interface ReclassItem {
  id: string;
  name: string;
  currentTreatment: string;
  alternative: string;
  affectedFields: Partial<YInput>;
  evidence: string;
  evaluation: 'adopt' | 'check' | 'not-recommended' | 'impossible';
  enabled: boolean;
}

const EVAL_LABELS = {
  'adopt': '採用余地あり',
  'check': '要確認',
  'not-recommended': '非推奨',
  'impossible': '不可',
} as const;

const DEMO_ITEMS: ReclassItem[] = [
  {
    id: 'misc-to-construction',
    name: '雑収入 -> 完成工事高振替',
    currentTreatment: '工事関連の雑収入65,000千円を全額営業外収益として計上',
    alternative: '工事契約に基づく部分32,000千円を完成工事高に振替',
    affectedFields: { sales: 32000, grossProfit: 32000 },
    evidence: '工事契約書・精算書',
    evaluation: 'adopt',
    enabled: false,
  },
  {
    id: 'capital-loan',
    name: '資本性借入金の認定',
    currentTreatment: '長期借入金185,000千円を全額負債として計上',
    alternative: '80,000千円を自己資本に認定（十分性の要件を確認）',
    affectedFields: { equity: 80000, fixedLiabilities: -80000 },
    evidence: '借入契約書（劣後特約・期限一括返済等の要件確認必要）',
    evaluation: 'check',
    enabled: false,
  },
  {
    id: 'unpaid-expense-reclass',
    name: '未払経費の分類先変更',
    currentTreatment: '外注先への未払い12,000千円を工事未払金に含めて計上',
    alternative: '一般管理費に対応する部分を未払費用に分離',
    affectedFields: { constructionPayable: -12000 },
    evidence: '-',
    evaluation: 'adopt',
    enabled: false,
  },
  {
    id: 'insurance-to-longterm',
    name: '保険積立金の振替',
    currentTreatment: '保険積立金12,500千円を投資その他の資産に計上',
    alternative: '長期前払費用に振替（固定資産の構成変更）',
    affectedFields: {},
    evidence: '保険証券',
    evaluation: 'check',
    enabled: false,
  },
  {
    id: 'depreciation-method',
    name: '減価償却方法の変更',
    currentTreatment: '定率法で減価償却',
    alternative: '定額法に変更（減価償却費5,000千円増加 -> 営業CF改善）',
    affectedFields: { depreciation: 5000 },
    evidence: '変更届出書',
    evaluation: 'not-recommended',
    enabled: false,
  },
];

function EvalBadge({ evaluation }: { evaluation: ReclassItem['evaluation'] }) {
  const config = {
    'adopt': { icon: FileCheck, className: 'bg-green-50 text-green-700 border-green-200' },
    'check': { icon: AlertTriangle, className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    'not-recommended': { icon: Shield, className: 'bg-orange-50 text-orange-700 border-orange-200' },
    'impossible': { icon: Ban, className: 'bg-red-50 text-red-700 border-red-200' },
  };
  const c = config[evaluation];
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={c.className}>
      <Icon className="mr-1 h-3 w-3" />
      {EVAL_LABELS[evaluation]}
    </Badge>
  );
}

function DiffArrow({ base, value }: { base: number; value: number }) {
  const diff = value - base;
  if (diff > 0) return <span className="text-green-600 text-sm font-medium inline-flex items-center"><ArrowUpRight className="h-3 w-3" />+{diff}</span>;
  if (diff < 0) return <span className="text-red-600 text-sm font-medium inline-flex items-center"><ArrowDownRight className="h-3 w-3" />{diff}</span>;
  return <span className="text-muted-foreground text-sm inline-flex items-center"><Minus className="h-3 w-3" />+/-0</span>;
}

function buildYInput(adjustments: Partial<YInput> = {}): YInput {
  const base: YInput = {
    sales: financials.sales,
    grossProfit: financials.grossProfit,
    ordinaryProfit: financials.ordinaryProfit,
    interestExpense: financials.interestExpense,
    interestDividendIncome: financials.interestDividendIncome,
    currentLiabilities: financials.currentLiabilities,
    fixedLiabilities: financials.fixedLiabilities,
    totalCapital: financials.totalCapital,
    equity: financials.equity,
    fixedAssets: financials.fixedAssets,
    retainedEarnings: financials.retainedEarnings,
    corporateTax: financials.corporateTax,
    depreciation: financials.depreciation,
    allowanceDoubtful: financials.allowanceDoubtful,
    notesAndAccountsReceivable: financials.notesAndReceivable,
    constructionPayable: financials.constructionPayable,
    inventoryAndMaterials: financials.inventoryAndMaterials,
    advanceReceived: financials.advanceReceived,
    prev: prevData,
  };

  for (const [key, val] of Object.entries(adjustments)) {
    if (key === 'prev') continue;
    if (key in base && typeof val === 'number') {
      (base as unknown as Record<string, number>)[key] += val;
    }
  }

  return base;
}

function calculateCase(yInput: YInput): { Y: number; X2: number; industries: { name: string; P: number }[] } {
  const yResult = calculateY(yInput);
  const x21 = lookupScore(X21_TABLE, yInput.equity);
  const x22 = lookupScore(X22_TABLE, ebitda);
  const x2 = calculateX2(x21, x22);
  const W = demoResult.W;

  const industries = industryInputs.map((ind) => {
    const avgComp = Math.floor((ind.prevCompletion + ind.currCompletion) / 2);
    const avgSub = Math.floor((ind.prevSubcontract + ind.currSubcontract) / 2);
    const X1 = lookupScore(X1_TABLE, avgComp);
    const z1 = lookupScore(Z1_TABLE, ind.techStaffValue);
    const z2 = lookupScore(Z2_TABLE, avgSub);
    const Z = calculateZ(z1, z2);
    const P = calculateP(X1, x2, yResult.Y, Z, W);
    return { name: ind.name, P };
  });

  return { Y: yResult.Y, X2: x2, industries };
}

export function DemoReclassificationSimulator() {
  const [items, setItems] = useState<ReclassItem[]>(DEMO_ITEMS);
  const [showResult, setShowResult] = useState(false);

  function toggleItem(id: string) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item));
  }

  function resetItems() {
    setItems(DEMO_ITEMS.map((item) => ({ ...item, enabled: false })));
    setShowResult(false);
  }

  const enabledCount = items.filter((i) => i.enabled).length;

  // Case A: Current (no changes)
  const caseA = useMemo(() => {
    if (!showResult) return null;
    return calculateCase(buildYInput());
  }, [showResult]);

  // Case B: All items applied
  const caseB = useMemo(() => {
    if (!showResult) return null;
    const mergedAdj: Partial<YInput> = {};
    for (const item of DEMO_ITEMS) {
      for (const [key, val] of Object.entries(item.affectedFields)) {
        if (typeof val === 'number') {
          (mergedAdj as Record<string, number>)[key] = ((mergedAdj as Record<string, number>)[key] || 0) + val;
        }
      }
    }
    return calculateCase(buildYInput(mergedAdj));
  }, [showResult]);

  // Case C: Selected items only
  const caseC = useMemo(() => {
    if (!showResult) return null;
    const mergedAdj: Partial<YInput> = {};
    for (const item of items) {
      if (item.enabled) {
        for (const [key, val] of Object.entries(item.affectedFields)) {
          if (typeof val === 'number') {
            (mergedAdj as Record<string, number>)[key] = ((mergedAdj as Record<string, number>)[key] || 0) + val;
          }
        }
      }
    }
    return calculateCase(buildYInput(mergedAdj));
  }, [showResult, items]);

  return (
    <div className="space-y-6">
      {/* Intro */}
      <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
        <p className="text-sm text-amber-800">
          <strong>{demoResult.companyName}</strong> {demoResult.period} のデータを使った再分類シミュレーションです。
          決算確定前に、異なる会計処理パターンがP点に与える影響を比較できます。
        </p>
      </div>

      {/* Reclassification Items */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">再分類項目</CardTitle>
            {enabledCount > 0 && (
              <Button variant="ghost" size="sm" onClick={resetItems} className="text-xs">
                <RotateCcw className="mr-1 h-3 w-3" />
                リセット
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            各項目のチェックを切り替えて、Case C（選択適用）に反映させます。Case Bは全項目適用時の最大効果です。
          </p>

          {/* Mobile-friendly card layout */}
          <div className="space-y-3 sm:hidden">
            {items.map((item) => (
              <div
                key={item.id}
                className={`rounded-lg border p-3 cursor-pointer transition-colors ${
                  item.enabled ? 'border-primary bg-primary/5' : 'hover:bg-muted/30'
                }`}
                onClick={() => toggleItem(item.id)}
              >
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    checked={item.enabled}
                    onChange={() => toggleItem(item.id)}
                    className="h-4 w-4 rounded border-gray-300 mt-0.5"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{item.name}</span>
                      <EvalBadge evaluation={item.evaluation} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">{item.currentTreatment}</p>
                    <p className="text-xs mt-1">{item.alternative}</p>
                    {item.evidence !== '-' && (
                      <p className="text-xs text-muted-foreground mt-1">証憑: {item.evidence}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table layout */}
          <div className="hidden sm:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-xs text-muted-foreground">
                  <th className="py-2 text-left w-8">適用</th>
                  <th className="py-2 text-left">項目</th>
                  <th className="py-2 text-left">現在の処理</th>
                  <th className="py-2 text-left">代替案</th>
                  <th className="py-2 text-left">必要証憑</th>
                  <th className="py-2 text-center">評価</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr
                    key={item.id}
                    className={`border-b cursor-pointer transition-colors ${
                      item.enabled ? 'bg-primary/5' : 'hover:bg-muted/30'
                    }`}
                    onClick={() => toggleItem(item.id)}
                  >
                    <td className="py-2" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={item.enabled}
                        onChange={() => toggleItem(item.id)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                    </td>
                    <td className="py-2 font-medium">{item.name}</td>
                    <td className="py-2 text-xs text-muted-foreground">{item.currentTreatment}</td>
                    <td className="py-2 text-xs">{item.alternative}</td>
                    <td className="py-2 text-xs text-muted-foreground">{item.evidence}</td>
                    <td className="py-2 text-center"><EvalBadge evaluation={item.evaluation} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action Button */}
      <div className="flex justify-center">
        <Button size="lg" onClick={() => setShowResult(true)} className="px-12">
          <ArrowRight className="mr-2 h-5 w-5" />
          3パターン比較を実行
        </Button>
      </div>

      {/* Results */}
      {showResult && caseA && caseB && caseC && (
        <div className="space-y-6">
          <Separator />

          {/* 3-Pattern Comparison Cards */}
          <div className="grid gap-4 md:grid-cols-3">
            <Card className="border-gray-300">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline">Case A</Badge>
                  現状ベース
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-4xl font-bold">{caseA.industries[0].P}</div>
                <div className="text-xs text-muted-foreground mt-1">{caseA.industries[0].name} P点</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Y={caseA.Y} X2={caseA.X2}
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-300 bg-green-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Case B</Badge>
                  全項目適用（最大効果）
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-4xl font-bold text-green-700">{caseB.industries[0].P}</div>
                <div className="text-xs text-muted-foreground mt-1">{caseB.industries[0].name} P点</div>
                <div className="mt-2"><DiffArrow base={caseA.industries[0].P} value={caseB.industries[0].P} /></div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Y={caseB.Y} X2={caseB.X2}
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-300 bg-blue-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">Case C</Badge>
                  選択適用（{enabledCount}項目）
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-4xl font-bold text-blue-700">{caseC.industries[0].P}</div>
                <div className="text-xs text-muted-foreground mt-1">{caseC.industries[0].name} P点</div>
                <div className="mt-2"><DiffArrow base={caseA.industries[0].P} value={caseC.industries[0].P} /></div>
                <div className="mt-1 text-xs text-muted-foreground">
                  Y={caseC.Y} X2={caseC.X2}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Detail Comparison Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">評点比較</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-xs text-muted-foreground">
                      <th className="py-2 text-left">評点</th>
                      <th className="py-2 text-right">Case A（現状）</th>
                      <th className="py-2 text-right">Case B（最適化）</th>
                      <th className="py-2 text-right">Case C（選択）</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b">
                      <td className="py-2 font-medium">Y点</td>
                      <td className="py-2 text-right font-mono">{caseA.Y}</td>
                      <td className="py-2 text-right font-mono">{caseB.Y} <DiffArrow base={caseA.Y} value={caseB.Y} /></td>
                      <td className="py-2 text-right font-mono">{caseC.Y} <DiffArrow base={caseA.Y} value={caseC.Y} /></td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 font-medium">X2</td>
                      <td className="py-2 text-right font-mono">{caseA.X2}</td>
                      <td className="py-2 text-right font-mono">{caseB.X2} <DiffArrow base={caseA.X2} value={caseB.X2} /></td>
                      <td className="py-2 text-right font-mono">{caseC.X2} <DiffArrow base={caseA.X2} value={caseC.X2} /></td>
                    </tr>
                    {caseA.industries.map((ind, idx) => (
                      <tr key={ind.name} className={`border-b ${idx === 0 ? 'font-bold' : ''}`}>
                        <td className="py-2">P点（{ind.name}）</td>
                        <td className="py-2 text-right font-mono">{ind.P}</td>
                        <td className="py-2 text-right font-mono text-green-700">
                          {caseB.industries[idx].P} <DiffArrow base={ind.P} value={caseB.industries[idx].P} />
                        </td>
                        <td className="py-2 text-right font-mono text-blue-700">
                          {caseC.industries[idx].P} <DiffArrow base={ind.P} value={caseC.industries[idx].P} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* Evidence Checklist */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FileCheck className="h-5 w-5" />
                必要証憑チェックリスト
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {items.filter((item) => item.enabled && item.evidence !== '-').map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300" readOnly />
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">必要書類: {item.evidence}</p>
                    </div>
                    <div className="ml-auto">
                      <EvalBadge evaluation={item.evaluation} />
                    </div>
                  </div>
                ))}
                {items.filter((item) => item.enabled && item.evidence !== '-').length === 0 && (
                  <p className="text-sm text-muted-foreground">再分類項目を選択すると、必要な証憑が表示されます。</p>
                )}
              </div>
            </CardContent>
          </Card>

          <p className="text-xs text-muted-foreground text-center">
            ※ 合法的な再分類の範囲内での最適化を目的としています。実際の適用には専門家の確認を推奨します。
          </p>
        </div>
      )}
    </div>
  );
}
