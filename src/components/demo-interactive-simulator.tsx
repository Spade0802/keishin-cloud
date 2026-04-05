'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, RotateCcw, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ, calculateW } from '@/lib/engine/p-calculator';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';
import type { YInput, SocialItems } from '@/lib/engine/types';

/** Default sample financial data (thousands of yen) */
const DEFAULTS = {
  sales: 2850000,
  grossProfit: 456000,
  ordinaryProfit: 128500,
  interestExpense: 8200,
  interestDividendIncome: 1350,
  currentLiabilities: 312000,
  fixedLiabilities: 185000,
  totalCapital: 1120000,
  equity: 623000,
  fixedAssets: 385000,
  retainedEarnings: 498000,
  corporateTax: 42800,
  depreciation: 18500,
  allowanceDoubtful: 1250,
  notesAndReceivable: 285000,
  constructionPayable: 198000,
  inventoryAndMaterials: 12500,
  advanceReceived: 8500,
  // Industry data (土木一式)
  prevCompletion: 980000,
  currCompletion: 1150000,
  prevSubcontract: 620000,
  currSubcontract: 750000,
  techStaffValue: 85,
  // W items
  businessYears: 45,
};

const PREV_DATA = {
  totalCapital: 1085000,
  operatingCF: 95200,
  allowanceDoubtful: 1800,
  notesAndAccountsReceivable: 310000,
  constructionPayable: 215000,
  inventoryAndMaterials: 15800,
  advanceReceived: 6200,
};

const SOCIAL_ITEMS_BASE: SocialItems = {
  employmentInsurance: true,
  healthInsurance: true,
  pensionInsurance: true,
  constructionRetirementMutualAid: true,
  retirementSystem: true,
  nonStatutoryAccidentInsurance: false,
  youngTechContinuous: true,
  youngTechNew: false,
  techStaffCount: 48,
  youngTechCount: 12,
  newYoungTechCount: 0,
  cpdTotalUnits: 580,
  skillLevelUpCount: 5,
  skilledWorkerCount: 15,
  deductionTargetCount: 0,
  wlbEruboshi: 0,
  wlbKurumin: 1,
  wlbYouth: 0,
  ccusImplementation: 1,
  businessYears: 45,
  civilRehabilitation: false,
  disasterAgreement: true,
  suspensionOrder: false,
  instructionOrder: false,
  auditStatus: 1,
  certifiedAccountants: 0,
  firstClassAccountants: 1,
  secondClassAccountants: 0,
  rdExpense2YearAvg: 0,
  constructionMachineCount: 3,
  iso9001: true,
  iso14001: false,
  ecoAction21: false,
};

interface FieldDef {
  key: keyof typeof DEFAULTS;
  label: string;
  unit: string;
  group: string;
}

const EDITABLE_FIELDS: FieldDef[] = [
  { key: 'sales', label: '完成工事高', unit: '千円', group: '決算書' },
  { key: 'grossProfit', label: '売上総利益', unit: '千円', group: '決算書' },
  { key: 'ordinaryProfit', label: '経常利益', unit: '千円', group: '決算書' },
  { key: 'equity', label: '自己資本', unit: '千円', group: '決算書' },
  { key: 'totalCapital', label: '総資本', unit: '千円', group: '決算書' },
  { key: 'currentLiabilities', label: '流動負債', unit: '千円', group: '決算書' },
  { key: 'fixedLiabilities', label: '固定負債', unit: '千円', group: '決算書' },
  { key: 'depreciation', label: '減価償却実施額', unit: '千円', group: '決算書' },
  { key: 'currCompletion', label: '当期完成工事高（土木）', unit: '千円', group: '業種' },
  { key: 'currSubcontract', label: '当期元請完工高（土木）', unit: '千円', group: '業種' },
  { key: 'techStaffValue', label: '技術職員数値（土木）', unit: '人', group: '業種' },
  { key: 'businessYears', label: '営業年数', unit: '年', group: 'W項目' },
];

function computeResult(values: typeof DEFAULTS) {
  const ebitda = values.ordinaryProfit + values.interestExpense -
    values.interestDividendIncome + values.depreciation;

  const yInput: YInput = {
    sales: values.sales,
    grossProfit: values.grossProfit,
    ordinaryProfit: values.ordinaryProfit,
    interestExpense: values.interestExpense,
    interestDividendIncome: values.interestDividendIncome,
    currentLiabilities: values.currentLiabilities,
    fixedLiabilities: values.fixedLiabilities,
    totalCapital: values.totalCapital,
    equity: values.equity,
    fixedAssets: values.fixedAssets,
    retainedEarnings: values.retainedEarnings,
    corporateTax: values.corporateTax,
    depreciation: values.depreciation,
    allowanceDoubtful: values.allowanceDoubtful,
    notesAndAccountsReceivable: values.notesAndReceivable,
    constructionPayable: values.constructionPayable,
    inventoryAndMaterials: values.inventoryAndMaterials,
    advanceReceived: values.advanceReceived,
    prev: PREV_DATA,
  };

  const yResult = calculateY(yInput);
  const x21 = lookupScore(X21_TABLE, values.equity);
  const x22 = lookupScore(X22_TABLE, ebitda);
  const x2 = calculateX2(x21, x22);

  const socialItems: SocialItems = { ...SOCIAL_ITEMS_BASE, businessYears: values.businessYears };
  const wCalc = calculateW(socialItems);

  const avgComp = Math.floor((values.prevCompletion + values.currCompletion) / 2);
  const adoptedComp = Math.max(avgComp, values.currCompletion);
  const X1 = lookupScore(X1_TABLE, adoptedComp);
  const avgSub = Math.floor((values.prevSubcontract + values.currSubcontract) / 2);
  const z1 = lookupScore(Z1_TABLE, values.techStaffValue);
  const z2 = lookupScore(Z2_TABLE, avgSub);
  const Z = calculateZ(z1, z2);
  const P = calculateP(X1, x2, yResult.Y, Z, wCalc.W);

  return { P, X1, x2, Y: yResult.Y, Z, W: wCalc.W, ebitda };
}

export function DemoInteractiveSimulator() {
  const [values, setValues] = useState({ ...DEFAULTS });

  const baseResult = useMemo(() => computeResult(DEFAULTS), []);
  const currentResult = useMemo(() => {
    try {
      return computeResult(values);
    } catch {
      return null;
    }
  }, [values]);

  function handleChange(key: keyof typeof DEFAULTS, raw: string) {
    const num = parseInt(raw.replace(/,/g, ''), 10);
    if (!isNaN(num)) {
      setValues((prev) => ({ ...prev, [key]: num }));
    } else if (raw === '' || raw === '-') {
      setValues((prev) => ({ ...prev, [key]: 0 }));
    }
  }

  function handleReset() {
    setValues({ ...DEFAULTS });
  }

  const pDiff = currentResult ? currentResult.P - baseResult.P : 0;

  const groups = ['決算書', '業種', 'W項目'];

  return (
    <div className="space-y-6">
      {/* Result Banner */}
      <div className="rounded-xl border-2 border-primary/30 bg-primary/5 p-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="text-center sm:text-left">
            <p className="text-sm text-muted-foreground mb-1">
              土木一式工事 P点（サンプル会社）
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-4xl font-bold">
                {currentResult?.P ?? '---'}
              </span>
              <span className="text-lg text-muted-foreground">点</span>
              {pDiff !== 0 && (
                <Badge
                  className={`text-sm ${
                    pDiff > 0
                      ? 'bg-green-100 text-green-700 border-green-200'
                      : 'bg-red-100 text-red-700 border-red-200'
                  }`}
                >
                  {pDiff > 0 ? (
                    <TrendingUp className="h-3 w-3 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 mr-1" />
                  )}
                  {pDiff > 0 ? '+' : ''}{pDiff}
                </Badge>
              )}
              {pDiff === 0 && currentResult && (
                <Badge variant="outline" className="text-sm">
                  <Minus className="h-3 w-3 mr-1" />
                  変動なし
                </Badge>
              )}
            </div>
          </div>
          <div className="grid grid-cols-5 gap-3 text-center text-xs">
            {[
              { label: 'X1', value: currentResult?.X1 },
              { label: 'X2', value: currentResult?.x2 },
              { label: 'Y', value: currentResult?.Y },
              { label: 'Z', value: currentResult?.Z },
              { label: 'W', value: currentResult?.W },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-muted-foreground">{item.label}</div>
                <div className="font-bold text-base">{item.value ?? '-'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Input Fields */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            下記の数値を変更すると、P点がリアルタイムで再計算されます。登録不要で何度でもお試しいただけます。
          </p>
          <Button variant="outline" size="sm" onClick={handleReset}>
            <RotateCcw className="h-3 w-3 mr-1" />
            リセット
          </Button>
        </div>

        {groups.map((group) => (
          <div key={group}>
            <h3 className="text-sm font-semibold mb-2">{group}</h3>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {EDITABLE_FIELDS.filter((f) => f.group === group).map((field) => {
                const isChanged = values[field.key] !== DEFAULTS[field.key];
                return (
                  <div
                    key={field.key}
                    className={`space-y-1 rounded-lg border p-2 ${
                      isChanged ? 'border-primary/40 bg-primary/5' : ''
                    }`}
                  >
                    <Label htmlFor={`demo-sim-${field.key}`} className="text-xs text-muted-foreground">
                      {field.label}
                    </Label>
                    <div className="flex items-center gap-1">
                      <Input
                        id={`demo-sim-${field.key}`}
                        type="text"
                        inputMode="numeric"
                        value={values[field.key].toLocaleString()}
                        onChange={(e) => handleChange(field.key, e.target.value)}
                        className="h-8 text-sm font-mono"
                      />
                      <span className="text-xs text-muted-foreground whitespace-nowrap">
                        {field.unit}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
            <Separator className="mt-4" />
          </div>
        ))}
      </div>

      {!currentResult && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          入力値が計算範囲外です。数値を調整してください。
        </div>
      )}
    </div>
  );
}
