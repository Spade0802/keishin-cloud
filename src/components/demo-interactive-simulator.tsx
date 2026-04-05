'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Calculator, RotateCcw, TrendingUp, TrendingDown, Minus, Building2 } from 'lucide-react';
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

/** Preset scenarios */
interface PresetScenario {
  name: string;
  description: string;
  values: typeof DEFAULTS;
  socialOverrides?: Partial<SocialItems>;
}

const PRESET_SMALL: typeof DEFAULTS = {
  sales: 50000,
  grossProfit: 8500,
  ordinaryProfit: 2100,
  interestExpense: 450,
  interestDividendIncome: 50,
  currentLiabilities: 12000,
  fixedLiabilities: 5000,
  totalCapital: 35000,
  equity: 18000,
  fixedAssets: 10000,
  retainedEarnings: 12000,
  corporateTax: 700,
  depreciation: 1200,
  allowanceDoubtful: 200,
  notesAndReceivable: 8000,
  constructionPayable: 5500,
  inventoryAndMaterials: 800,
  advanceReceived: 300,
  prevCompletion: 45000,
  currCompletion: 50000,
  prevSubcontract: 15000,
  currSubcontract: 18000,
  techStaffValue: 8,
  businessYears: 15,
};

const PRESET_LARGE: typeof DEFAULTS = {
  sales: 15000000,
  grossProfit: 2100000,
  ordinaryProfit: 750000,
  interestExpense: 45000,
  interestDividendIncome: 12000,
  currentLiabilities: 2800000,
  fixedLiabilities: 1200000,
  totalCapital: 8500000,
  equity: 4500000,
  fixedAssets: 3200000,
  retainedEarnings: 3800000,
  corporateTax: 250000,
  depreciation: 120000,
  allowanceDoubtful: 8000,
  notesAndReceivable: 2200000,
  constructionPayable: 1800000,
  inventoryAndMaterials: 85000,
  advanceReceived: 45000,
  prevCompletion: 13500000,
  currCompletion: 15000000,
  prevSubcontract: 9500000,
  currSubcontract: 10500000,
  techStaffValue: 350,
  businessYears: 60,
};

const PRESET_NEW: typeof DEFAULTS = {
  sales: 120000,
  grossProfit: 18000,
  ordinaryProfit: 3500,
  interestExpense: 1200,
  interestDividendIncome: 100,
  currentLiabilities: 25000,
  fixedLiabilities: 15000,
  totalCapital: 55000,
  equity: 15000,
  fixedAssets: 18000,
  retainedEarnings: 5000,
  corporateTax: 1200,
  depreciation: 2000,
  allowanceDoubtful: 300,
  notesAndReceivable: 15000,
  constructionPayable: 10000,
  inventoryAndMaterials: 1500,
  advanceReceived: 500,
  prevCompletion: 100000,
  currCompletion: 120000,
  prevSubcontract: 30000,
  currSubcontract: 40000,
  techStaffValue: 12,
  businessYears: 3,
};

const PRESETS: PresetScenario[] = [
  {
    name: '中小建設業',
    description: '年商5千万円規模',
    values: PRESET_SMALL,
    socialOverrides: {
      techStaffCount: 5,
      youngTechCount: 1,
      cpdTotalUnits: 30,
      skillLevelUpCount: 0,
      businessYears: 15,
      constructionMachineCount: 1,
      iso9001: false,
      iso14001: false,
    },
  },
  {
    name: '中堅建設業',
    description: '年商28億円規模（デフォルト）',
    values: { ...DEFAULTS },
  },
  {
    name: '大規模建設業',
    description: '年商150億円規模',
    values: PRESET_LARGE,
    socialOverrides: {
      techStaffCount: 180,
      youngTechCount: 45,
      cpdTotalUnits: 6500,
      skillLevelUpCount: 25,
      skilledWorkerCount: 60,
      businessYears: 60,
      constructionMachineCount: 15,
      iso9001: true,
      iso14001: true,
      auditStatus: 4,
      certifiedAccountants: 2,
      firstClassAccountants: 3,
    },
  },
  {
    name: '新規参入',
    description: '営業年数3年・年商1.2億円',
    values: PRESET_NEW,
    socialOverrides: {
      techStaffCount: 8,
      youngTechCount: 3,
      cpdTotalUnits: 40,
      skillLevelUpCount: 1,
      businessYears: 3,
      constructionMachineCount: 0,
      iso9001: false,
      iso14001: false,
      constructionRetirementMutualAid: false,
      retirementSystem: false,
      disasterAgreement: false,
      auditStatus: 0,
    },
  },
];

/** P score component weights for visual breakdown */
const P_WEIGHTS = [
  { key: 'X1' as const, weight: 0.25, label: 'X1 (完工高)' },
  { key: 'X2' as const, weight: 0.15, label: 'X2 (自己資本・利益)' },
  { key: 'Y' as const, weight: 0.20, label: 'Y (経営状況)' },
  { key: 'Z' as const, weight: 0.25, label: 'Z (技術力)' },
  { key: 'W' as const, weight: 0.15, label: 'W (社会性)' },
];

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

  const contributions = {
    X1: 0.25 * X1,
    X2: 0.15 * x2,
    Y: 0.20 * yResult.Y,
    Z: 0.25 * Z,
    W: 0.15 * wCalc.W,
  };

  return { P, X1, x2, Y: yResult.Y, Z, W: wCalc.W, ebitda, contributions };
}

export function DemoInteractiveSimulator() {
  const [values, setValues] = useState({ ...DEFAULTS });
  const [activePreset, setActivePreset] = useState<string>('中堅建設業');

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
      setActivePreset('');
    } else if (raw === '' || raw === '-') {
      setValues((prev) => ({ ...prev, [key]: 0 }));
      setActivePreset('');
    }
  }

  function handleReset() {
    setValues({ ...DEFAULTS });
    setActivePreset('中堅建設業');
  }

  function handlePreset(preset: PresetScenario) {
    setValues({ ...preset.values });
    setActivePreset(preset.name);
  }

  const pDiff = currentResult ? currentResult.P - baseResult.P : 0;

  // Contribution breakdown for the bar chart
  const contributionTotal = currentResult
    ? currentResult.contributions.X1 +
      currentResult.contributions.X2 +
      currentResult.contributions.Y +
      currentResult.contributions.Z +
      currentResult.contributions.W
    : 0;

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
          <div className="grid grid-cols-5 gap-2 sm:gap-3 text-center text-xs">
            {[
              { label: 'X1', value: currentResult?.X1 },
              { label: 'X2', value: currentResult?.x2 },
              { label: 'Y', value: currentResult?.Y },
              { label: 'Z', value: currentResult?.Z },
              { label: 'W', value: currentResult?.W },
            ].map((item) => (
              <div key={item.label}>
                <div className="text-muted-foreground">{item.label}</div>
                <div className="font-bold text-sm sm:text-base">{item.value ?? '-'}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Preset Scenarios */}
      <div>
        <h3 className="text-sm font-semibold mb-2 flex items-center gap-1">
          <Building2 className="h-4 w-4" />
          プリセットシナリオ
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {PRESETS.map((preset) => (
            <Button
              key={preset.name}
              variant={activePreset === preset.name ? 'default' : 'outline'}
              size="sm"
              className="h-auto py-2 flex flex-col items-start text-left"
              onClick={() => handlePreset(preset)}
            >
              <span className="text-xs font-semibold">{preset.name}</span>
              <span className="text-[10px] opacity-70">{preset.description}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Contribution Breakdown Bar Chart */}
      {currentResult && (
        <div className="rounded-lg border p-4 space-y-3">
          <h3 className="text-sm font-semibold">P点 構成内訳</h3>
          {/* Stacked bar */}
          <div className="flex h-6 rounded-md overflow-hidden">
            {P_WEIGHTS.map(({ key, label }, i) => {
              const val = key === 'X2'
                ? currentResult.contributions.X2
                : currentResult.contributions[key];
              const pct = contributionTotal > 0 ? (val / contributionTotal) * 100 : 20;
              const colors = [
                'bg-blue-500',
                'bg-emerald-500',
                'bg-amber-500',
                'bg-purple-500',
                'bg-rose-500',
              ];
              return (
                <div
                  key={key}
                  className={`${colors[i]} transition-all duration-300`}
                  style={{ width: `${pct}%` }}
                  title={`${label}: ${Math.floor(val)}点`}
                />
              );
            })}
          </div>
          {/* Legend with values */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-2 text-xs">
            {P_WEIGHTS.map(({ key, weight, label }, i) => {
              const rawScore = key === 'X2' ? currentResult.x2 : currentResult[key];
              const contribution = key === 'X2'
                ? currentResult.contributions.X2
                : currentResult.contributions[key];
              const colors = [
                'bg-blue-500',
                'bg-emerald-500',
                'bg-amber-500',
                'bg-purple-500',
                'bg-rose-500',
              ];
              const pct = contributionTotal > 0
                ? ((contribution / contributionTotal) * 100).toFixed(1)
                : '20.0';
              return (
                <div key={key} className="space-y-1">
                  <div className="flex items-center gap-1">
                    <div className={`h-2 w-2 shrink-0 rounded-full ${colors[i]}`} />
                    <span className="text-muted-foreground truncate">{key}</span>
                  </div>
                  <div className="font-mono font-bold">{Math.floor(contribution)}</div>
                  <div className="text-muted-foreground">
                    {rawScore} x {weight}
                  </div>
                  <div className="text-muted-foreground">{pct}%</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Input Fields */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            下記の数値を変更すると、P点がリアルタイムで再計算されます。登録不要で何度でもお試しいただけます。
          </p>
          <Button variant="outline" size="sm" onClick={handleReset} aria-label="入力値をデフォルトにリセット">
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
                        className="h-10 sm:h-8 text-sm font-mono w-full"
                        aria-label={field.label}
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
