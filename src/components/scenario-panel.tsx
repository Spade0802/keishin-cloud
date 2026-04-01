'use client';

import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { TrendingUp, TrendingDown, Minus, Plus, RotateCcw } from 'lucide-react';
import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ } from '@/lib/engine/p-calculator';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
} from '@/lib/engine/score-tables';
import type { YInput } from '@/lib/engine/types';

interface ScenarioInput {
  label: string;
  key: string;
  currentValue: number;
  scenarioValue: number;
  unit: string;
}

interface ScenarioPanelProps {
  /** Current form values for Y calculation */
  yInput: YInput;
  /** Current equity value (千円) */
  equity: number;
  /** Current EBITDA value (千円) */
  ebitda: number;
  /** Current W total points */
  wTotal: number;
  /** Current industries data */
  industries: {
    name: string;
    avgCompletion: number;
    avgSubcontract: number;
    techStaffValue: number;
  }[];
}

const ADJUSTABLE_FIELDS: {
  key: string;
  label: string;
  unit: string;
  yInputField?: keyof YInput;
  special?: 'equity' | 'ebitda' | 'wTotal';
  tips: string;
}[] = [
  {
    key: 'equity',
    label: '純資産合計',
    unit: '千円',
    special: 'equity',
    tips: '増資や内部留保の充実でX21↑、Y点のx5/x6↑',
  },
  {
    key: 'ebitda',
    label: '利払後事業利益額',
    unit: '千円',
    special: 'ebitda',
    tips: '利益向上・減価償却増でX22↑',
  },
  {
    key: 'interestExpense',
    label: '支払利息',
    unit: '千円',
    yInputField: 'interestExpense',
    tips: '借入金圧縮でY点のx1（純支払利息比率）改善',
  },
  {
    key: 'fixedLiabilities',
    label: '固定負債',
    unit: '千円',
    yInputField: 'fixedLiabilities',
    tips: '長期借入金の返済でY点のx2（負債回転期間）改善',
  },
  {
    key: 'retainedEarnings',
    label: '利益剰余金',
    unit: '千円',
    yInputField: 'retainedEarnings',
    tips: '内部留保でY点のx8↑',
  },
  {
    key: 'wTotal',
    label: 'W評点合計',
    unit: '点',
    special: 'wTotal',
    tips: 'ISO取得、建退共加入、若年技術者育成で加点',
  },
];

function num(v: number | string): number {
  const n = typeof v === 'string' ? parseFloat(v) : v;
  return isNaN(n) ? 0 : n;
}

export function ScenarioPanel({
  yInput,
  equity,
  ebitda,
  wTotal,
  industries,
}: ScenarioPanelProps) {
  const [adjustments, setAdjustments] = useState<Record<string, number>>({});

  function getAdjusted(key: string, original: number): number {
    return key in adjustments ? adjustments[key] : original;
  }

  function setAdjustment(key: string, value: number) {
    setAdjustments((prev) => ({ ...prev, [key]: value }));
  }

  function resetAll() {
    setAdjustments({});
  }

  // Current P scores
  const currentScores = useMemo(() => {
    const yResult = calculateY(yInput);
    const x21 = lookupScore(X21_TABLE, equity);
    const x22 = lookupScore(X22_TABLE, ebitda);
    const x2 = calculateX2(x21, x22);
    const W = Math.floor((wTotal * 1750) / 200);

    const industryScores = industries.map((ind) => {
      const X1 = lookupScore(X1_TABLE, ind.avgCompletion);
      const z1 = lookupScore(Z1_TABLE, ind.techStaffValue);
      const z2 = lookupScore(Z2_TABLE, ind.avgSubcontract);
      const Z = calculateZ(z1, z2);
      const P = calculateP(X1, x2, yResult.Y, Z, W);
      return { name: ind.name, P, X1, Z };
    });

    return { Y: yResult.Y, X2: x2, W, industries: industryScores };
  }, [yInput, equity, ebitda, wTotal, industries]);

  // Scenario P scores
  const scenarioScores = useMemo(() => {
    const scenarioYInput: YInput = { ...yInput };
    for (const field of ADJUSTABLE_FIELDS) {
      if (field.yInputField && field.key in adjustments) {
        (scenarioYInput as unknown as Record<string, unknown>)[field.yInputField] =
          adjustments[field.key];
      }
    }
    // equity affects Y through equity field
    if ('equity' in adjustments) {
      scenarioYInput.equity = adjustments.equity;
    }
    if ('retainedEarnings' in adjustments) {
      scenarioYInput.retainedEarnings = adjustments.retainedEarnings;
    }

    const adjEquity = getAdjusted('equity', equity);
    const adjEbitda = getAdjusted('ebitda', ebitda);
    const adjWTotal = getAdjusted('wTotal', wTotal);

    const yResult = calculateY(scenarioYInput);
    const x21 = lookupScore(X21_TABLE, adjEquity);
    const x22 = lookupScore(X22_TABLE, adjEbitda);
    const x2 = calculateX2(x21, x22);
    const W = Math.floor((adjWTotal * 1750) / 200);

    const industryScores = industries.map((ind) => {
      const X1 = lookupScore(X1_TABLE, ind.avgCompletion);
      const z1 = lookupScore(Z1_TABLE, ind.techStaffValue);
      const z2 = lookupScore(Z2_TABLE, ind.avgSubcontract);
      const Z = calculateZ(z1, z2);
      const P = calculateP(X1, x2, yResult.Y, Z, W);
      return { name: ind.name, P, X1, Z };
    });

    return { Y: yResult.Y, X2: x2, W, industries: industryScores };
  }, [yInput, equity, ebitda, wTotal, industries, adjustments]);

  const hasChanges = Object.keys(adjustments).length > 0;

  function getOriginalValue(key: string): number {
    const field = ADJUSTABLE_FIELDS.find((f) => f.key === key);
    if (!field) return 0;
    if (field.special === 'equity') return equity;
    if (field.special === 'ebitda') return ebitda;
    if (field.special === 'wTotal') return wTotal;
    if (field.yInputField) return num((yInput as unknown as Record<string, unknown>)[field.yInputField] as number);
    return 0;
  }

  function DiffBadge({ current, scenario }: { current: number; scenario: number }) {
    const diff = scenario - current;
    if (diff === 0) return <Badge variant="secondary"><Minus className="h-3 w-3 mr-1" />±0</Badge>;
    if (diff > 0) return <Badge className="bg-green-100 text-green-800"><TrendingUp className="h-3 w-3 mr-1" />+{diff}</Badge>;
    return <Badge className="bg-red-100 text-red-800"><TrendingDown className="h-3 w-3 mr-1" />{diff}</Badge>;
  }

  return (
    <Card className="border-blue-200 bg-blue-50/30">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">改善シミュレーション（What-if）</CardTitle>
          {hasChanges && (
            <Button variant="ghost" size="sm" onClick={resetAll}>
              <RotateCcw className="h-3 w-3 mr-1" />
              リセット
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">
          数値を変更すると、P点への影響をリアルタイムで確認できます
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Adjustable fields */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {ADJUSTABLE_FIELDS.map((field) => {
            const original = getOriginalValue(field.key);
            const current = getAdjusted(field.key, original);
            const changed = field.key in adjustments && adjustments[field.key] !== original;

            return (
              <div key={field.key} className="space-y-1">
                <Label className="text-xs font-medium">
                  {field.label}
                  {changed && <span className="ml-1 text-blue-600">*</span>}
                </Label>
                <div className="flex items-center gap-1">
                  <Input
                    type="number"
                    value={current}
                    onChange={(e) => setAdjustment(field.key, num(e.target.value))}
                    className={`text-right text-sm h-8 ${changed ? 'border-blue-400 bg-blue-50' : ''}`}
                  />
                  <span className="text-xs text-muted-foreground whitespace-nowrap w-8">
                    {field.unit}
                  </span>
                </div>
                <p className="text-[10px] text-muted-foreground">{field.tips}</p>
              </div>
            );
          })}
        </div>

        <Separator />

        {/* Comparison table */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">スコア比較</h4>

          {/* Common scores */}
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { label: 'Y点', current: currentScores.Y, scenario: scenarioScores.Y },
              { label: 'X2', current: currentScores.X2, scenario: scenarioScores.X2 },
              { label: 'W', current: currentScores.W, scenario: scenarioScores.W },
            ].map((item) => (
              <div key={item.label} className="p-2 rounded bg-white">
                <div className="text-xs text-muted-foreground">{item.label}</div>
                <div className="text-lg font-bold">{item.scenario}</div>
                <DiffBadge current={item.current} scenario={item.scenario} />
              </div>
            ))}
          </div>

          {/* Industry P scores */}
          {currentScores.industries.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-xs">
                    <th className="py-1 text-left">業種</th>
                    <th className="py-1 text-right">現在P点</th>
                    <th className="py-1 text-right">改善後P点</th>
                    <th className="py-1 text-right">差分</th>
                  </tr>
                </thead>
                <tbody>
                  {currentScores.industries.map((ind, i) => {
                    const scenarioInd = scenarioScores.industries[i];
                    const diff = scenarioInd ? scenarioInd.P - ind.P : 0;
                    return (
                      <tr key={ind.name} className="border-b">
                        <td className="py-1.5">{ind.name}</td>
                        <td className="py-1.5 text-right font-mono">{ind.P}</td>
                        <td className="py-1.5 text-right font-mono font-bold">
                          {scenarioInd?.P ?? '-'}
                        </td>
                        <td className="py-1.5 text-right">
                          <span
                            className={
                              diff > 0
                                ? 'text-green-700 font-medium'
                                : diff < 0
                                  ? 'text-red-700 font-medium'
                                  : 'text-muted-foreground'
                            }
                          >
                            {diff > 0 ? '+' : ''}
                            {diff}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
