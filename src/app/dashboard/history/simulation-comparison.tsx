'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  X,
  GitCompareArrows,
} from 'lucide-react';

interface SimulationRow {
  id: string;
  name: string;
  period: string | null;
  updatedAt: string; // serialised ISO string
  resultData: Record<string, unknown> | null;
}

interface Props {
  simulations: SimulationRow[];
}

function delta(a: number, b: number) {
  const diff = b - a;
  if (diff > 0)
    return (
      <span className="inline-flex items-center text-green-600 text-sm font-medium">
        <ArrowUpRight className="h-3 w-3" />+{diff}
      </span>
    );
  if (diff < 0)
    return (
      <span className="inline-flex items-center text-red-600 text-sm font-medium">
        <ArrowDownRight className="h-3 w-3" />
        {diff}
      </span>
    );
  return (
    <span className="inline-flex items-center text-muted-foreground text-sm">
      <Minus className="h-3 w-3" />
      0
    </span>
  );
}

/**
 * Extract P-score related numbers from the resultData JSON blob
 * stored by the simulation engine.
 */
function extractScores(rd: Record<string, unknown>) {
  const industries = (rd.industries ?? []) as Array<{
    name: string;
    P: number;
    X1: number;
    Z: number;
  }>;
  return {
    industries,
    Y: (rd.Y as number) ?? 0,
    X2: (rd.X2 as number) ?? 0,
    W: (rd.W as number) ?? 0,
  };
}

export function SimulationComparison({ simulations }: Props) {
  const [comparing, setComparing] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const completed = simulations.filter((s) => s.resultData !== null);

  function toggleSelection(id: string) {
    setSelectedIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 2) return [prev[1], id]; // keep last 2
      return [...prev, id];
    });
  }

  function exitCompare() {
    setComparing(false);
    setSelectedIds([]);
  }

  // Selected simulation objects
  const selected = selectedIds
    .map((id) => completed.find((s) => s.id === id))
    .filter(Boolean) as SimulationRow[];

  if (completed.length < 2) return null;

  return (
    <div className="mb-6">
      {!comparing ? (
        <Button
          variant="outline"
          size="sm"
          onClick={() => setComparing(true)}
        >
          <GitCompareArrows className="mr-2 h-4 w-4" />
          比較モード
        </Button>
      ) : (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              比較する試算を2つ選択してください（完了済みのみ）
            </p>
            <Button variant="ghost" size="sm" onClick={exitCompare}>
              <X className="mr-1 h-4 w-4" />
              比較を終了
            </Button>
          </div>

          {/* Selectable chips */}
          <div className="flex flex-wrap gap-2">
            {completed.map((sim) => {
              const isSelected = selectedIds.includes(sim.id);
              return (
                <button
                  key={sim.id}
                  onClick={() => toggleSelection(sim.id)}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-sm transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/10 text-primary font-medium'
                      : 'border-border hover:border-primary/40'
                  }`}
                >
                  {sim.name}
                  {sim.period && (
                    <span className="text-muted-foreground text-xs">
                      ({sim.period})
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Comparison table */}
          {selected.length === 2 && (
            <ComparisonTable a={selected[0]} b={selected[1]} />
          )}
        </div>
      )}
    </div>
  );
}

function ComparisonTable({ a, b }: { a: SimulationRow; b: SimulationRow }) {
  const scoresA = extractScores(a.resultData!);
  const scoresB = extractScores(b.resultData!);

  // Merge industry names from both
  const industryNames = Array.from(
    new Set([
      ...scoresA.industries.map((i) => i.name),
      ...scoresB.industries.map((i) => i.name),
    ])
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4" />
          P点比較
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b bg-muted/50 text-xs text-muted-foreground">
                <th className="text-left font-medium px-3 py-2">項目</th>
                <th className="text-right font-medium px-3 py-2">
                  <div>{a.name}</div>
                  {a.period && (
                    <div className="font-normal">{a.period}</div>
                  )}
                </th>
                <th className="text-right font-medium px-3 py-2">
                  <div>{b.name}</div>
                  {b.period && (
                    <div className="font-normal">{b.period}</div>
                  )}
                </th>
                <th className="text-center font-medium px-3 py-2">差分</th>
              </tr>
            </thead>
            <tbody>
              {/* Common scores */}
              <tr className="border-b">
                <td className="px-3 py-2 font-medium">Y（経営状況）</td>
                <td className="px-3 py-2 text-right font-mono">{scoresA.Y}</td>
                <td className="px-3 py-2 text-right font-mono">{scoresB.Y}</td>
                <td className="px-3 py-2 text-center">
                  {delta(scoresA.Y, scoresB.Y)}
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-2 font-medium">X2（自己資本等）</td>
                <td className="px-3 py-2 text-right font-mono">
                  {scoresA.X2}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {scoresB.X2}
                </td>
                <td className="px-3 py-2 text-center">
                  {delta(scoresA.X2, scoresB.X2)}
                </td>
              </tr>
              <tr className="border-b">
                <td className="px-3 py-2 font-medium">W（社会性）</td>
                <td className="px-3 py-2 text-right font-mono">{scoresA.W}</td>
                <td className="px-3 py-2 text-right font-mono">{scoresB.W}</td>
                <td className="px-3 py-2 text-center">
                  {delta(scoresA.W, scoresB.W)}
                </td>
              </tr>

              {/* Per-industry P scores */}
              {industryNames.map((name) => {
                const indA = scoresA.industries.find((i) => i.name === name);
                const indB = scoresB.industries.find((i) => i.name === name);
                const pA = indA?.P ?? 0;
                const pB = indB?.P ?? 0;
                return (
                  <tr key={name} className="border-b">
                    <td className="px-3 py-2 font-medium">
                      P点: {name}
                      <Badge
                        variant="outline"
                        className="ml-2 text-[10px] py-0"
                      >
                        X1={indA?.X1 ?? '-'} / Z={indA?.Z ?? '-'}
                      </Badge>
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-primary">
                      {indA ? pA : '-'}
                    </td>
                    <td className="px-3 py-2 text-right font-mono font-bold text-primary">
                      {indB ? pB : '-'}
                    </td>
                    <td className="px-3 py-2 text-center">
                      {indA && indB ? delta(pA, pB) : '-'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
