import { useMemo } from 'react';
import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ, calculateW } from '@/lib/engine/p-calculator';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
} from '@/lib/engine/score-tables';
import type { YInput, SocialItems } from '@/lib/engine/types';

export interface SimulationOverrides {
  /** 自己資本の増減 (千円) */
  equityDelta?: number;
  /** 借入金の増減 (千円、マイナスなら返済) */
  borrowingDelta?: number;
  /** 業種別技術職員数値の増減 */
  techStaffValueDelta?: Record<string, number>;
  /** 社会性項目のトグル上書き */
  iso14001?: boolean;
  iso9001?: boolean;
  ecoAction21?: boolean;
  ccusImplementation?: number;
  /** 営業年数の増減 */
  businessYearsDelta?: number;
  /** 研究開発費の増減 */
  rdExpenseDelta?: number;
}

export interface IndustrySimResult {
  name: string;
  code: string;
  baselineP: number;
  simulatedP: number;
  delta: number;
  X1: { baseline: number; simulated: number };
  X2: { baseline: number; simulated: number };
  Y: { baseline: number; simulated: number };
  Z: { baseline: number; simulated: number };
  W: { baseline: number; simulated: number };
}

export interface SimulationResult {
  industries: IndustrySimResult[];
  /** Total max delta across all industries */
  maxDelta: number;
}

interface IndustryInput {
  name: string;
  code: string;
  avgCompletion: number;
  avgSubcontract: number;
  techStaffValue: number;
}

interface UsePRecalculationParams {
  yInput: YInput;
  equity: number;
  ebitda: number;
  socialItems: SocialItems;
  industries: IndustryInput[];
  overrides: SimulationOverrides;
}

export function usePRecalculation({
  yInput,
  equity,
  ebitda,
  socialItems,
  industries,
  overrides,
}: UsePRecalculationParams): SimulationResult {
  return useMemo(() => {
    // ---- Baseline calculation ----
    const baseY = calculateY(yInput);
    const baseX21 = lookupScore(X21_TABLE, equity);
    const baseX22 = lookupScore(X22_TABLE, ebitda);
    const baseX2 = calculateX2(baseX21, baseX22);
    const baseW = calculateW(socialItems);

    // ---- Simulated Y inputs ----
    const simYInput: YInput = { ...yInput };

    // equity increase
    if (overrides.equityDelta) {
      simYInput.equity = yInput.equity + overrides.equityDelta;
      simYInput.retainedEarnings = yInput.retainedEarnings + overrides.equityDelta;
    }

    // borrowing reduction affects fixedLiabilities and interestExpense
    if (overrides.borrowingDelta) {
      simYInput.fixedLiabilities = Math.max(0, yInput.fixedLiabilities + overrides.borrowingDelta);
      // Rough estimate: interest reduction proportional to borrowing reduction
      if (overrides.borrowingDelta < 0 && yInput.fixedLiabilities > 0) {
        const ratio = Math.abs(overrides.borrowingDelta) / yInput.fixedLiabilities;
        simYInput.interestExpense = Math.max(0, yInput.interestExpense * (1 - ratio * 0.5));
      }
    }

    const simY = calculateY(simYInput);

    // Simulated equity for X21
    const simEquity = equity + (overrides.equityDelta ?? 0);
    const simX21 = lookupScore(X21_TABLE, simEquity);
    const simX22 = lookupScore(X22_TABLE, ebitda);
    const simX2 = calculateX2(simX21, simX22);

    // Simulated W
    const simSocialItems: SocialItems = { ...socialItems };
    if (overrides.iso14001 !== undefined) simSocialItems.iso14001 = overrides.iso14001;
    if (overrides.iso9001 !== undefined) simSocialItems.iso9001 = overrides.iso9001;
    if (overrides.ecoAction21 !== undefined) simSocialItems.ecoAction21 = overrides.ecoAction21;
    if (overrides.ccusImplementation !== undefined) simSocialItems.ccusImplementation = overrides.ccusImplementation;
    if (overrides.businessYearsDelta) {
      simSocialItems.businessYears = socialItems.businessYears + overrides.businessYearsDelta;
    }
    if (overrides.rdExpenseDelta) {
      simSocialItems.rdExpense2YearAvg = socialItems.rdExpense2YearAvg + overrides.rdExpenseDelta;
    }
    const simW = calculateW(simSocialItems);

    // ---- Per-industry calculation ----
    const results: IndustrySimResult[] = industries.map((ind) => {
      const baseX1 = lookupScore(X1_TABLE, ind.avgCompletion);
      const baseZ1 = lookupScore(Z1_TABLE, ind.techStaffValue);
      const baseZ2 = lookupScore(Z2_TABLE, ind.avgSubcontract);
      const baseZ = calculateZ(baseZ1, baseZ2);
      const baseP = calculateP(baseX1, baseX2, baseY.Y, baseZ, baseW.W);

      // Simulated tech staff
      const techDelta = overrides.techStaffValueDelta?.[ind.code] ?? 0;
      const simTechValue = ind.techStaffValue + techDelta;
      const simZ1 = lookupScore(Z1_TABLE, simTechValue);
      const simZ2 = lookupScore(Z2_TABLE, ind.avgSubcontract);
      const simZ = calculateZ(simZ1, simZ2);
      const simP = calculateP(baseX1, simX2, simY.Y, simZ, simW.W);

      return {
        name: ind.name,
        code: ind.code,
        baselineP: baseP,
        simulatedP: simP,
        delta: simP - baseP,
        X1: { baseline: baseX1, simulated: baseX1 },
        X2: { baseline: baseX2, simulated: simX2 },
        Y: { baseline: baseY.Y, simulated: simY.Y },
        Z: { baseline: baseZ, simulated: simZ },
        W: { baseline: baseW.W, simulated: simW.W },
      };
    });

    const maxDelta = results.reduce((max, r) => Math.max(max, Math.abs(r.delta)), 0);

    return { industries: results, maxDelta };
  }, [yInput, equity, ebitda, socialItems, industries, overrides]);
}
