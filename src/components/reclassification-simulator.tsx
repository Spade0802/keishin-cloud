'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
} from 'lucide-react';
import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ } from '@/lib/engine/p-calculator';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';
import type { YInput } from '@/lib/engine/types';

interface ReclassItem {
  id: string;
  name: string;
  currentTreatment: string;
  alternative: string;
  affectedFields: Partial<YInput>;
  evidence: string;
  evaluation: '採用余地あり' | '要確認' | '非推奨' | '不可';
  enabled: boolean;
}

const DEFAULT_ITEMS: ReclassItem[] = [
  {
    id: 'misc-to-construction',
    name: '雑収入→完成工事高振替',
    currentTreatment: '全額を営業外収益として計上',
    alternative: '工事関連部分を完成工事高に振替',
    affectedFields: { sales: 12000, grossProfit: 12000 },
    evidence: '工事契約書・精算書',
    evaluation: '採用余地あり',
    enabled: false,
  },
  {
    id: 'capital-loan',
    name: '資本性借入金の認定',
    currentTreatment: '全額を負債として計上',
    alternative: '60,000千円を自己資本に認定',
    affectedFields: { equity: 60000, fixedLiabilities: -60000 },
    evidence: '借入契約書（要件確認必要）',
    evaluation: '要確認',
    enabled: false,
  },
  {
    id: 'unpaid-expense-reclass',
    name: '未払経費の分類先変更',
    currentTreatment: '工事未払金に含めて計上',
    alternative: '未払費用に分離',
    affectedFields: { constructionPayable: -870 },
    evidence: '—',
    evaluation: '採用余地あり',
    enabled: false,
  },
  {
    id: 'insurance-to-fixed',
    name: '保険積立金の固定資産計上',
    currentTreatment: '投資その他の資産に計上',
    alternative: '長期前払費用に振替',
    affectedFields: {},
    evidence: '保険証券',
    evaluation: '要確認',
    enabled: false,
  },
  {
    id: 'depreciation-method',
    name: '減価償却方法の変更',
    currentTreatment: '定率法',
    alternative: '定額法に変更（減価償却費増加）',
    affectedFields: { depreciation: 2000 },
    evidence: '変更届出書',
    evaluation: '非推奨',
    enabled: false,
  },
];

function EvalBadge({ evaluation }: { evaluation: ReclassItem['evaluation'] }) {
  const config = {
    '採用余地あり': { icon: FileCheck, className: 'bg-green-50 text-green-700 border-green-200' },
    '要確認': { icon: AlertTriangle, className: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    '非推奨': { icon: Shield, className: 'bg-orange-50 text-orange-700 border-orange-200' },
    '不可': { icon: Ban, className: 'bg-red-50 text-red-700 border-red-200' },
  };
  const c = config[evaluation];
  const Icon = c.icon;
  return (
    <Badge variant="outline" className={c.className}>
      <Icon className="mr-1 h-3 w-3" />
      {evaluation}
    </Badge>
  );
}

export function ReclassificationSimulator() {
  // Base financial data
  const [sales, setSales] = useState('1668128');
  const [grossProfit, setGrossProfit] = useState('270254');
  const [ordinaryProfit, setOrdinaryProfit] = useState('85784');
  const [interestExpense, setInterestExpense] = useState('6042');
  const [interestDividendIncome, setInterestDividendIncome] = useState('844');
  const [currentLiabilities, setCurrentLiabilities] = useState('185776');
  const [fixedLiabilities, setFixedLiabilities] = useState('227499');
  const [totalCapital, setTotalCapital] = useState('749286');
  const [equity, setEquity] = useState('336010');
  const [fixedAssets, setFixedAssets] = useState('236308');
  const [retainedEarnings, setRetainedEarnings] = useState('299650');
  const [corporateTax, setCorporateTax] = useState('29851');
  const [depreciation, setDepreciation] = useState('5985');
  const [allowanceDoubtful, setAllowanceDoubtful] = useState('635');
  const [notesAndAccountsReceivable, setNotesAndAccountsReceivable] = useState('129271');
  const [constructionPayable, setConstructionPayable] = useState('137521');
  const [inventoryAndMaterials, setInventoryAndMaterials] = useState('4836');
  const [advanceReceived, setAdvanceReceived] = useState('682');
  const [prevTotalCapital, setPrevTotalCapital] = useState('827777');
  const [prevOperatingCF, setPrevOperatingCF] = useState('78454');
  const [prevAllowanceDoubtful, setPrevAllowanceDoubtful] = useState('1200');
  const [prevNotesAndAccountsReceivable, setPrevNotesAndAccountsReceivable] = useState('223124');
  const [prevConstructionPayable, setPrevConstructionPayable] = useState('224090');
  const [prevInventoryAndMaterials, setPrevInventoryAndMaterials] = useState('17836');
  const [prevAdvanceReceived, setPrevAdvanceReceived] = useState('1653');
  const [ebitda, setEbitda] = useState('44332');
  const [wTotal] = useState(138);
  const [industryAvgCompletion] = useState('1375760');
  const [industryAvgSubcontract] = useState('688475');
  const [techStaffValue] = useState('62');

  const [items, setItems] = useState<ReclassItem[]>(DEFAULT_ITEMS);
  const [showResult, setShowResult] = useState(false);

  function num(s: string): number {
    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  function toggleItem(id: string) {
    setItems((prev) => prev.map((item) => item.id === id ? { ...item, enabled: !item.enabled } : item));
  }

  function buildYInput(adjustments: Partial<YInput> = {}): YInput {
    const base: YInput = {
      sales: num(sales),
      grossProfit: num(grossProfit),
      ordinaryProfit: num(ordinaryProfit),
      interestExpense: num(interestExpense),
      interestDividendIncome: num(interestDividendIncome),
      currentLiabilities: num(currentLiabilities),
      fixedLiabilities: num(fixedLiabilities),
      totalCapital: num(totalCapital),
      equity: num(equity),
      fixedAssets: num(fixedAssets),
      retainedEarnings: num(retainedEarnings),
      corporateTax: num(corporateTax),
      depreciation: num(depreciation),
      allowanceDoubtful: num(allowanceDoubtful),
      notesAndAccountsReceivable: num(notesAndAccountsReceivable),
      constructionPayable: num(constructionPayable),
      inventoryAndMaterials: num(inventoryAndMaterials),
      advanceReceived: num(advanceReceived),
      prev: {
        totalCapital: num(prevTotalCapital),
        operatingCF: num(prevOperatingCF),
        allowanceDoubtful: num(prevAllowanceDoubtful),
        notesAndAccountsReceivable: num(prevNotesAndAccountsReceivable),
        constructionPayable: num(prevConstructionPayable),
        inventoryAndMaterials: num(prevInventoryAndMaterials),
        advanceReceived: num(prevAdvanceReceived),
      },
    };

    // Apply adjustments
    for (const [key, val] of Object.entries(adjustments)) {
      if (key === 'prev') continue;
      if (key in base && typeof val === 'number') {
        (base as unknown as Record<string, number>)[key] += val;
      }
    }

    return base;
  }

  function calculateCase(yInput: YInput, equityAdj: number = 0): { Y: number; X2: number; P: number } {
    const yResult = calculateY(yInput);
    const equityVal = yInput.equity;
    const ebitdaVal = num(ebitda);
    const x21 = lookupScore(X21_TABLE, equityVal);
    const x22 = lookupScore(X22_TABLE, ebitdaVal);
    const x2 = calculateX2(x21, x22);
    const W = Math.floor((wTotal * 1750) / 200);
    const avgComp = num(industryAvgCompletion);
    const avgSub = num(industryAvgSubcontract);
    const techVal = num(techStaffValue);
    const X1 = lookupScore(X1_TABLE, avgComp);
    const z1 = lookupScore(Z1_TABLE, techVal);
    const z2 = lookupScore(Z2_TABLE, avgSub);
    const Z = calculateZ(z1, z2);
    const P = calculateP(X1, x2, yResult.Y, Z, W);
    return { Y: yResult.Y, X2: x2, P };
  }

  // Case A: Current (no changes)
  const caseA = useMemo(() => {
    if (!showResult) return null;
    const yInput = buildYInput();
    return calculateCase(yInput);
  }, [showResult, sales, grossProfit, ordinaryProfit, interestExpense, interestDividendIncome, currentLiabilities, fixedLiabilities, totalCapital, equity, fixedAssets, retainedEarnings, corporateTax, depreciation, allowanceDoubtful, notesAndAccountsReceivable, constructionPayable, inventoryAndMaterials, advanceReceived, prevTotalCapital, prevOperatingCF, prevAllowanceDoubtful, prevNotesAndAccountsReceivable, prevConstructionPayable, prevInventoryAndMaterials, prevAdvanceReceived, ebitda]);

  // Case B: Optimized (all enabled items applied)
  const caseB = useMemo(() => {
    if (!showResult) return null;
    const mergedAdj: Partial<YInput> = {};
    for (const item of items) {
      if (item.enabled || true) { // Case B applies ALL items
        for (const [key, val] of Object.entries(item.affectedFields)) {
          if (typeof val === 'number') {
            (mergedAdj as Record<string, number>)[key] = ((mergedAdj as Record<string, number>)[key] || 0) + val;
          }
        }
      }
    }
    const yInput = buildYInput(mergedAdj);
    return calculateCase(yInput);
  }, [showResult, items, sales, grossProfit, ordinaryProfit, interestExpense, interestDividendIncome, currentLiabilities, fixedLiabilities, totalCapital, equity, fixedAssets, retainedEarnings, corporateTax, depreciation, allowanceDoubtful, notesAndAccountsReceivable, constructionPayable, inventoryAndMaterials, advanceReceived, prevTotalCapital, prevOperatingCF, prevAllowanceDoubtful, prevNotesAndAccountsReceivable, prevConstructionPayable, prevInventoryAndMaterials, prevAdvanceReceived, ebitda]);

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
    const yInput = buildYInput(mergedAdj);
    return calculateCase(yInput);
  }, [showResult, items, sales, grossProfit, ordinaryProfit, interestExpense, interestDividendIncome, currentLiabilities, fixedLiabilities, totalCapital, equity, fixedAssets, retainedEarnings, corporateTax, depreciation, allowanceDoubtful, notesAndAccountsReceivable, constructionPayable, inventoryAndMaterials, advanceReceived, prevTotalCapital, prevOperatingCF, prevAllowanceDoubtful, prevNotesAndAccountsReceivable, prevConstructionPayable, prevInventoryAndMaterials, prevAdvanceReceived, ebitda]);

  function DiffArrow({ base, value }: { base: number; value: number }) {
    const diff = value - base;
    if (diff > 0) return <span className="text-green-600 text-sm font-medium flex items-center"><ArrowUpRight className="h-3 w-3" />+{diff}</span>;
    if (diff < 0) return <span className="text-red-600 text-sm font-medium flex items-center"><ArrowDownRight className="h-3 w-3" />{diff}</span>;
    return <span className="text-muted-foreground text-sm flex items-center"><Minus className="h-3 w-3" />±0</span>;
  }

  return (
    <div className="space-y-6">
      {/* Reclassification Items */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">再分類項目</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-xs text-muted-foreground">
            各項目のチェックを切り替えて、Case C（選択適用）に反映させます。Case Bは全項目適用時の最大効果です。
          </p>
          <div className="overflow-x-auto">
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
                  <tr key={item.id} className="border-b">
                    <td className="py-2">
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
                <div className="text-4xl font-bold">{caseA.P}</div>
                <div className="text-xs text-muted-foreground mt-1">P点</div>
                <div className="mt-2 text-xs text-muted-foreground">
                  Y={caseA.Y} X2={caseA.X2}
                </div>
              </CardContent>
            </Card>

            <Card className="border-green-300 bg-green-50/30">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">Case B</Badge>
                  合法的最適化（全適用）
                </CardTitle>
              </CardHeader>
              <CardContent className="text-center">
                <div className="text-4xl font-bold text-green-700">{caseB.P}</div>
                <div className="text-xs text-muted-foreground mt-1">P点</div>
                <div className="mt-2"><DiffArrow base={caseA.P} value={caseB.P} /></div>
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
                <div className="text-4xl font-bold text-blue-700">{caseC.P}</div>
                <div className="text-xs text-muted-foreground mt-1">P点</div>
                <div className="mt-2"><DiffArrow base={caseA.P} value={caseC.P} /></div>
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
                  <tr className="border-b font-bold">
                    <td className="py-2">P点</td>
                    <td className="py-2 text-right font-mono">{caseA.P}</td>
                    <td className="py-2 text-right font-mono text-green-700">{caseB.P} <DiffArrow base={caseA.P} value={caseB.P} /></td>
                    <td className="py-2 text-right font-mono text-blue-700">{caseC.P} <DiffArrow base={caseA.P} value={caseC.P} /></td>
                  </tr>
                </tbody>
              </table>
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
                {items.filter((item) => item.enabled && item.evidence !== '—').map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border p-3">
                    <input type="checkbox" className="h-4 w-4 rounded border-gray-300" />
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">必要書類: {item.evidence}</p>
                    </div>
                    <div className="ml-auto">
                      <EvalBadge evaluation={item.evaluation} />
                    </div>
                  </div>
                ))}
                {items.filter((item) => item.enabled && item.evidence !== '—').length === 0 && (
                  <p className="text-sm text-muted-foreground">再分類項目を選択すると、必要な証憑が表示されます。</p>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
