'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import {
  TrendingUp,
  TrendingDown,
  Minus,
  RotateCcw,
  SlidersHorizontal,
} from 'lucide-react';
import {
  usePRecalculation,
  type SimulationOverrides,
  type IndustrySimResult,
} from '@/lib/hooks/use-p-recalculation';
import type { YInput, SocialItems } from '@/lib/engine/types';

interface SimulationPanelProps {
  yInput: YInput;
  equity: number;
  ebitda: number;
  socialItems: SocialItems;
  industries: Array<{
    name: string;
    code: string;
    avgCompletion: number;
    avgSubcontract: number;
    techStaffValue: number;
  }>;
}

// Debounced value hook
function useDebouncedValue<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  const rafRef = useRef<number | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(() => {
        setDebounced(value);
      });
    }, delay);
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [value, delay]);

  return debounced;
}

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) {
    return (
      <Badge variant="secondary" className="text-xs">
        <Minus className="h-3 w-3 mr-0.5" />
        ±0
      </Badge>
    );
  }
  if (delta > 0) {
    return (
      <Badge className="bg-green-100 text-green-800 text-xs">
        <TrendingUp className="h-3 w-3 mr-0.5" />
        +{delta}
      </Badge>
    );
  }
  return (
    <Badge className="bg-red-100 text-red-800 text-xs">
      <TrendingDown className="h-3 w-3 mr-0.5" />
      {delta}
    </Badge>
  );
}

function ToggleSwitch({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
}) {
  return (
    <label className="flex items-center justify-between gap-3 cursor-pointer py-1.5">
      <span className="text-sm">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
          checked ? 'bg-primary' : 'bg-muted-foreground/30'
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-[18px]' : 'translate-x-[2px]'
          }`}
        />
      </button>
    </label>
  );
}

function RangeSlider({
  label,
  value,
  min,
  max,
  step,
  unit,
  onChange,
  formatValue,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  unit: string;
  onChange: (v: number) => void;
  formatValue?: (v: number) => string;
}) {
  const display = formatValue ? formatValue(value) : value.toLocaleString();
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        <span className="text-sm font-mono font-medium">
          {display}
          <span className="text-xs text-muted-foreground ml-1">{unit}</span>
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full h-2 bg-muted rounded-lg appearance-none cursor-pointer accent-primary"
      />
      <div className="flex justify-between text-[10px] text-muted-foreground">
        <span>{min.toLocaleString()}</span>
        <span>{max.toLocaleString()}</span>
      </div>
    </div>
  );
}

function ScoreComparisonRow({
  label,
  baseline,
  simulated,
}: {
  label: string;
  baseline: number;
  simulated: number;
}) {
  const delta = simulated - baseline;
  return (
    <div className="p-3 rounded-lg bg-white border text-center">
      <div className="text-xs text-muted-foreground mb-1">{label}</div>
      <div className="flex items-center justify-center gap-2">
        <span className="text-sm text-muted-foreground line-through">
          {baseline}
        </span>
        <span className="text-lg font-bold">{simulated}</span>
      </div>
      <DeltaBadge delta={delta} />
    </div>
  );
}

export function SimulationPanel({
  yInput,
  equity,
  ebitda,
  socialItems,
  industries,
}: SimulationPanelProps) {
  // Slider/toggle state
  const [borrowingRepay, setBorrowingRepay] = useState(0);
  const [equityIncrease, setEquityIncrease] = useState(0);
  const [techStaff1Delta, setTechStaff1Delta] = useState<Record<string, number>>({});
  const [techStaff2Delta, setTechStaff2Delta] = useState<Record<string, number>>({});
  const [iso14001, setIso14001] = useState(socialItems.iso14001);
  const [iso9001, setIso9001] = useState(socialItems.iso9001);
  const [ecoAction21, setEcoAction21] = useState(socialItems.ecoAction21);
  const [ccus, setCcus] = useState(socialItems.ccusImplementation);

  // Build overrides
  const rawOverrides: SimulationOverrides = {
    equityDelta: equityIncrease > 0 ? equityIncrease : undefined,
    borrowingDelta: borrowingRepay > 0 ? -borrowingRepay : undefined,
    techStaffValueDelta: (() => {
      const delta: Record<string, number> = {};
      for (const ind of industries) {
        const d1 = (techStaff1Delta[ind.code] ?? 0) * 5; // 1級 = 5点
        const d2 = (techStaff2Delta[ind.code] ?? 0) * 2; // 2級 = 2点
        if (d1 + d2 > 0) delta[ind.code] = d1 + d2;
      }
      return Object.keys(delta).length > 0 ? delta : undefined;
    })(),
    iso14001: iso14001 !== socialItems.iso14001 ? iso14001 : undefined,
    iso9001: iso9001 !== socialItems.iso9001 ? iso9001 : undefined,
    ecoAction21: ecoAction21 !== socialItems.ecoAction21 ? ecoAction21 : undefined,
    ccusImplementation: ccus !== socialItems.ccusImplementation ? ccus : undefined,
  };

  const overrides = useDebouncedValue(rawOverrides, 50);

  const result = usePRecalculation({
    yInput,
    equity,
    ebitda,
    socialItems,
    industries,
    overrides,
  });

  const hasChanges =
    borrowingRepay > 0 ||
    equityIncrease > 0 ||
    Object.values(techStaff1Delta).some((v) => v > 0) ||
    Object.values(techStaff2Delta).some((v) => v > 0) ||
    iso14001 !== socialItems.iso14001 ||
    iso9001 !== socialItems.iso9001 ||
    ecoAction21 !== socialItems.ecoAction21 ||
    ccus !== socialItems.ccusImplementation;

  const resetAll = useCallback(() => {
    setBorrowingRepay(0);
    setEquityIncrease(0);
    setTechStaff1Delta({});
    setTechStaff2Delta({});
    setIso14001(socialItems.iso14001);
    setIso9001(socialItems.iso9001);
    setEcoAction21(socialItems.ecoAction21);
    setCcus(socialItems.ccusImplementation);
  }, [socialItems]);

  // Summary: best improvement
  const totalDelta = result.industries.reduce((sum, r) => sum + r.delta, 0);
  const avgDelta =
    result.industries.length > 0
      ? Math.round(totalDelta / result.industries.length)
      : 0;

  // First industry for common score breakdown
  const first = result.industries[0];

  return (
    <div className="space-y-6">
      {/* Impact Summary */}
      {hasChanges && (
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="text-sm font-medium">シミュレーション効果</div>
                <div className="text-xs text-muted-foreground">
                  全業種平均 P点変動
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span
                  className={`text-3xl font-bold ${
                    avgDelta > 0
                      ? 'text-green-600'
                      : avgDelta < 0
                        ? 'text-red-600'
                        : ''
                  }`}
                >
                  {avgDelta > 0 ? '+' : ''}
                  {avgDelta}
                </span>
                <span className="text-sm text-muted-foreground">点</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Controls */}
        <div className="space-y-4">
          {/* Section 1: Financial */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm flex items-center gap-2">
                  <SlidersHorizontal className="h-4 w-4" />
                  財務改善
                </CardTitle>
                {hasChanges && (
                  <Button variant="ghost" size="sm" onClick={resetAll}>
                    <RotateCcw className="h-3 w-3 mr-1" />
                    リセット
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <RangeSlider
                label="借入金返済額"
                value={borrowingRepay}
                min={0}
                max={Math.max(10000, yInput.fixedLiabilities)}
                step={10000}
                unit="千円"
                onChange={setBorrowingRepay}
                formatValue={(v) =>
                  v === 0 ? '0' : `${(v / 1000).toFixed(0)}百万`
                }
              />
              <RangeSlider
                label="自己資本増加"
                value={equityIncrease}
                min={0}
                max={100000}
                step={5000}
                unit="千円"
                onChange={setEquityIncrease}
                formatValue={(v) =>
                  v === 0 ? '0' : `${(v / 1000).toFixed(0)}百万`
                }
              />
            </CardContent>
          </Card>

          {/* Section 2: Tech Staff */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">技術力向上</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {industries.map((ind) => (
                <div key={ind.code} className="space-y-2">
                  <div className="text-xs font-medium text-muted-foreground">
                    {ind.name}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">
                        1級追加
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={techStaff1Delta[ind.code] ?? 0}
                        onChange={(e) =>
                          setTechStaff1Delta((prev) => ({
                            ...prev,
                            [ind.code]: Math.max(
                              0,
                              Math.min(10, Number(e.target.value) || 0)
                            ),
                          }))
                        }
                        className="h-7 text-sm text-right w-16"
                      />
                      <span className="text-xs text-muted-foreground">人</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Label className="text-xs whitespace-nowrap">
                        2級追加
                      </Label>
                      <Input
                        type="number"
                        min={0}
                        max={10}
                        value={techStaff2Delta[ind.code] ?? 0}
                        onChange={(e) =>
                          setTechStaff2Delta((prev) => ({
                            ...prev,
                            [ind.code]: Math.max(
                              0,
                              Math.min(10, Number(e.target.value) || 0)
                            ),
                          }))
                        }
                        className="h-7 text-sm text-right w-16"
                      />
                      <span className="text-xs text-muted-foreground">人</span>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 3: Social Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">社会性等</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              <ToggleSwitch
                label="ISO14001取得"
                checked={iso14001}
                onChange={setIso14001}
              />
              <ToggleSwitch
                label="ISO9001取得"
                checked={iso9001}
                onChange={setIso9001}
              />
              <ToggleSwitch
                label="エコアクション21"
                checked={ecoAction21}
                onChange={setEcoAction21}
              />
              <Separator className="my-2" />
              <div className="space-y-1.5">
                <Label className="text-sm">CCUS導入レベル</Label>
                <div className="flex gap-1">
                  {[0, 1, 2, 3].map((level) => (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setCcus(level)}
                      className={`flex-1 py-1.5 text-xs rounded border transition-colors ${
                        ccus === level
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'bg-background hover:bg-muted border-border'
                      }`}
                    >
                      {level === 0
                        ? '未導入'
                        : level === 1
                          ? 'Lv1'
                          : level === 2
                            ? 'Lv2'
                            : 'Lv3'}
                    </button>
                  ))}
                </div>
                <div className="text-[10px] text-muted-foreground">
                  Lv1: +5点 / Lv2: +10点 / Lv3: +15点
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right: Results */}
        <div className="space-y-4">
          {/* Common score comparison */}
          {first && (
            <div className="grid grid-cols-3 gap-2">
              <ScoreComparisonRow
                label="Y点"
                baseline={first.Y.baseline}
                simulated={first.Y.simulated}
              />
              <ScoreComparisonRow
                label="X2"
                baseline={first.X2.baseline}
                simulated={first.X2.simulated}
              />
              <ScoreComparisonRow
                label="W"
                baseline={first.W.baseline}
                simulated={first.W.simulated}
              />
            </div>
          )}

          {/* Industry P-point cards */}
          <div className="space-y-3">
            {result.industries.map((ind) => (
              <Card
                key={ind.code}
                className={
                  ind.delta > 0
                    ? 'border-green-200 bg-green-50/30'
                    : ind.delta < 0
                      ? 'border-red-200 bg-red-50/30'
                      : ''
                }
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm font-medium">{ind.name}</div>
                      <div className="flex items-center gap-3 mt-1">
                        <div className="text-xs text-muted-foreground">
                          ベースライン{' '}
                          <span className="font-mono font-medium">
                            {ind.baselineP}
                          </span>
                        </div>
                        <span className="text-muted-foreground">→</span>
                        <div className="text-xs">
                          シミュレーション{' '}
                          <span className="font-mono font-bold text-base">
                            {ind.simulatedP}
                          </span>
                        </div>
                      </div>
                    </div>
                    <DeltaBadge delta={ind.delta} />
                  </div>
                  {/* Component breakdown */}
                  {ind.delta !== 0 && (
                    <div className="mt-2 pt-2 border-t grid grid-cols-5 gap-1 text-center text-[10px]">
                      {(
                        [
                          ['X1', ind.X1],
                          ['X2', ind.X2],
                          ['Y', ind.Y],
                          ['Z', ind.Z],
                          ['W', ind.W],
                        ] as [string, { baseline: number; simulated: number }][]
                      ).map(([label, scores]) => {
                        const d = scores.simulated - scores.baseline;
                        return (
                          <div key={label}>
                            <div className="text-muted-foreground">{label}</div>
                            <div className="font-mono">
                              {scores.simulated}
                            </div>
                            {d !== 0 && (
                              <div
                                className={
                                  d > 0 ? 'text-green-600' : 'text-red-600'
                                }
                              >
                                {d > 0 ? '+' : ''}
                                {d}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Hint when no changes */}
          {!hasChanges && (
            <div className="text-center py-8 text-muted-foreground">
              <SlidersHorizontal className="mx-auto h-8 w-8 mb-3 opacity-40" />
              <p className="text-sm">
                左のスライダーやトグルを操作すると、
                <br />
                P点への影響をリアルタイムで確認できます
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
