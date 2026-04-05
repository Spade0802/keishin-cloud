// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  usePRecalculation,
  type SimulationOverrides,
  type SimulationResult,
} from '../use-p-recalculation';
import type { YInput, SocialItems } from '@/lib/engine/types';

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

function makeYInput(overrides?: Partial<YInput>): YInput {
  return {
    sales: 500_000,
    grossProfit: 100_000,
    ordinaryProfit: 50_000,
    interestExpense: 2_000,
    interestDividendIncome: 500,
    currentLiabilities: 80_000,
    fixedLiabilities: 60_000,
    totalCapital: 300_000,
    equity: 120_000,
    fixedAssets: 150_000,
    retainedEarnings: 80_000,
    corporateTax: 15_000,
    depreciation: 10_000,
    allowanceDoubtful: 1_000,
    notesAndAccountsReceivable: 40_000,
    constructionPayable: 30_000,
    inventoryAndMaterials: 20_000,
    advanceReceived: 5_000,
    prev: {
      totalCapital: 280_000,
      operatingCF: 30_000,
      allowanceDoubtful: 800,
      notesAndAccountsReceivable: 38_000,
      constructionPayable: 28_000,
      inventoryAndMaterials: 18_000,
      advanceReceived: 4_000,
    },
    ...overrides,
  };
}

function makeSocialItems(overrides?: Partial<SocialItems>): SocialItems {
  return {
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    constructionRetirementMutualAid: true,
    retirementSystem: true,
    nonStatutoryAccidentInsurance: true,
    youngTechContinuous: false,
    youngTechNew: false,
    techStaffCount: 10,
    youngTechCount: 0,
    newYoungTechCount: 0,
    cpdTotalUnits: 0,
    skillLevelUpCount: 0,
    skilledWorkerCount: 0,
    deductionTargetCount: 0,
    wlbEruboshi: 0,
    wlbKurumin: 0,
    wlbYouth: 0,
    ccusImplementation: 0,
    businessYears: 20,
    civilRehabilitation: false,
    disasterAgreement: false,
    suspensionOrder: false,
    instructionOrder: false,
    auditStatus: 0,
    certifiedAccountants: 0,
    firstClassAccountants: 0,
    secondClassAccountants: 0,
    rdExpense2YearAvg: 0,
    completionAmount2YearAvg: 500_000,
    constructionMachineCount: 0,
    iso9001: false,
    iso14001: false,
    ecoAction21: false,
    ...overrides,
  };
}

const baseIndustries = [
  {
    name: '土木一式',
    code: 'civil',
    avgCompletion: 200_000,
    avgSubcontract: 50_000,
    techStaffValue: 300,
  },
  {
    name: '建築一式',
    code: 'building',
    avgCompletion: 150_000,
    avgSubcontract: 40_000,
    techStaffValue: 250,
  },
];

const noOverrides: SimulationOverrides = {};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('usePRecalculation', () => {
  // Helper to render with defaults
  function renderWith(overrides: SimulationOverrides, extra?: {
    yInput?: Partial<YInput>;
    socialItems?: Partial<SocialItems>;
    equity?: number;
    ebitda?: number;
  }): SimulationResult {
    const { result } = renderHook(() =>
      usePRecalculation({
        yInput: makeYInput(extra?.yInput),
        equity: extra?.equity ?? 120_000,
        ebitda: extra?.ebitda ?? 60_000,
        socialItems: makeSocialItems(extra?.socialItems),
        industries: baseIndustries,
        overrides,
      }),
    );
    return result.current;
  }

  describe('default behavior (no overrides)', () => {
    it('returns results for each industry', () => {
      const sim = renderWith(noOverrides);

      expect(sim.industries).toHaveLength(2);
      expect(sim.industries[0].code).toBe('civil');
      expect(sim.industries[1].code).toBe('building');
    });

    it('baseline and simulated P are equal when there are no overrides', () => {
      const sim = renderWith(noOverrides);

      for (const ind of sim.industries) {
        expect(ind.simulatedP).toBe(ind.baselineP);
        expect(ind.delta).toBe(0);
      }
    });

    it('baseline and simulated sub-scores match when there are no overrides', () => {
      const sim = renderWith(noOverrides);

      for (const ind of sim.industries) {
        expect(ind.X1.simulated).toBe(ind.X1.baseline);
        expect(ind.X2.simulated).toBe(ind.X2.baseline);
        expect(ind.Y.simulated).toBe(ind.Y.baseline);
        expect(ind.Z.simulated).toBe(ind.Z.baseline);
        expect(ind.W.simulated).toBe(ind.W.baseline);
      }
    });

    it('maxDelta is 0 with no overrides', () => {
      const sim = renderWith(noOverrides);
      expect(sim.maxDelta).toBe(0);
    });

    it('P scores are within valid range (6-2160)', () => {
      const sim = renderWith(noOverrides);

      for (const ind of sim.industries) {
        expect(ind.baselineP).toBeGreaterThanOrEqual(6);
        expect(ind.baselineP).toBeLessThanOrEqual(2160);
      }
    });
  });

  describe('with equity override', () => {
    it('changes X2 and Y when equity increases', () => {
      const sim = renderWith({ equityDelta: 50_000 });

      for (const ind of sim.industries) {
        // X2 should change (via X21 lookup on higher equity)
        expect(ind.X2.simulated).toBeGreaterThanOrEqual(ind.X2.baseline);
        // Y may change because equity and retainedEarnings are bumped
        // Delta should be non-negative since we are improving financials
        expect(ind.simulatedP).toBeGreaterThanOrEqual(ind.baselineP);
      }
    });

    it('increases maxDelta when equity changes', () => {
      const sim = renderWith({ equityDelta: 50_000 });
      expect(sim.maxDelta).toBeGreaterThanOrEqual(0);
    });

    it('X1 is unchanged by equity override', () => {
      const sim = renderWith({ equityDelta: 50_000 });

      for (const ind of sim.industries) {
        expect(ind.X1.simulated).toBe(ind.X1.baseline);
      }
    });
  });

  describe('with tech staff changes', () => {
    it('changes Z score for the targeted industry', () => {
      const sim = renderWith({
        techStaffValueDelta: { civil: 100 },
      });

      const civil = sim.industries.find((i) => i.code === 'civil')!;
      const building = sim.industries.find((i) => i.code === 'building')!;

      // civil Z should change
      expect(civil.Z.simulated).not.toBe(civil.Z.baseline);
      // building Z should be unchanged
      expect(building.Z.simulated).toBe(building.Z.baseline);
    });

    it('does not affect X2, Y, or W when only tech staff changes', () => {
      const sim = renderWith({
        techStaffValueDelta: { civil: 100 },
      });

      for (const ind of sim.industries) {
        expect(ind.X2.simulated).toBe(ind.X2.baseline);
        expect(ind.Y.simulated).toBe(ind.Y.baseline);
        expect(ind.W.simulated).toBe(ind.W.baseline);
      }
    });

    it('produces non-zero delta for the affected industry', () => {
      const sim = renderWith({
        techStaffValueDelta: { civil: 100 },
      });

      const civil = sim.industries.find((i) => i.code === 'civil')!;
      expect(civil.delta).not.toBe(0);
    });
  });

  describe('with social factor changes', () => {
    it('changes W score when ISO flags are toggled', () => {
      const sim = renderWith({
        iso9001: true,
        iso14001: true,
      });

      for (const ind of sim.industries) {
        expect(ind.W.simulated).toBeGreaterThan(ind.W.baseline);
      }
    });

    it('changes W score with business years delta', () => {
      const sim = renderWith({ businessYearsDelta: 10 });

      for (const ind of sim.industries) {
        expect(ind.W.simulated).toBeGreaterThanOrEqual(ind.W.baseline);
      }
    });

    it('changes W score with CCUS implementation override', () => {
      const sim = renderWith({ ccusImplementation: 3 });

      for (const ind of sim.industries) {
        expect(ind.W.simulated).toBeGreaterThan(ind.W.baseline);
      }
    });

    it('changes W score with R&D expense delta', () => {
      const sim = renderWith({ rdExpenseDelta: 10_000 });

      for (const ind of sim.industries) {
        expect(ind.W.simulated).toBeGreaterThanOrEqual(ind.W.baseline);
      }
    });

    it('does not affect X1, X2, Y, or Z with social-only changes', () => {
      const sim = renderWith({ iso9001: true });

      for (const ind of sim.industries) {
        expect(ind.X1.simulated).toBe(ind.X1.baseline);
        expect(ind.X2.simulated).toBe(ind.X2.baseline);
        expect(ind.Y.simulated).toBe(ind.Y.baseline);
        expect(ind.Z.simulated).toBe(ind.Z.baseline);
      }
    });
  });

  describe('memoization behavior', () => {
    it('returns the same reference when inputs are stable', () => {
      const yInput = makeYInput();
      const socialItems = makeSocialItems();
      const overrides: SimulationOverrides = {};

      const { result, rerender } = renderHook(() =>
        usePRecalculation({
          yInput,
          equity: 120_000,
          ebitda: 60_000,
          socialItems,
          industries: baseIndustries,
          overrides,
        }),
      );

      const first = result.current;
      rerender();
      const second = result.current;

      // useMemo should return the same object reference if deps are unchanged
      expect(first).toBe(second);
    });

    it('returns a new reference when overrides change', () => {
      const yInput = makeYInput();
      const socialItems = makeSocialItems();
      let overrides: SimulationOverrides = {};

      const { result, rerender } = renderHook(() =>
        usePRecalculation({
          yInput,
          equity: 120_000,
          ebitda: 60_000,
          socialItems,
          industries: baseIndustries,
          overrides,
        }),
      );

      const first = result.current;
      overrides = { equityDelta: 10_000 };
      rerender();
      const second = result.current;

      // New overrides object means new computation
      expect(second).not.toBe(first);
    });
  });

  describe('combined overrides', () => {
    it('applies equity, tech staff, and social overrides simultaneously', () => {
      const sim = renderWith({
        equityDelta: 30_000,
        techStaffValueDelta: { civil: 50, building: 50 },
        iso9001: true,
        iso14001: true,
        businessYearsDelta: 5,
      });

      for (const ind of sim.industries) {
        // All three areas should be affected
        expect(ind.X2.simulated).toBeGreaterThanOrEqual(ind.X2.baseline);
        expect(ind.Z.simulated).not.toBe(ind.Z.baseline);
        expect(ind.W.simulated).toBeGreaterThan(ind.W.baseline);
        expect(ind.simulatedP).toBeGreaterThan(ind.baselineP);
      }
    });
  });

  describe('borrowing delta', () => {
    it('reduces fixed liabilities and affects Y score', () => {
      const sim = renderWith({ borrowingDelta: -20_000 });

      for (const ind of sim.industries) {
        // Y should change because fixedLiabilities and interestExpense change
        // The exact direction depends on the Y formula, but it should differ
        expect(ind.Y.simulated).not.toBe(ind.Y.baseline);
      }
    });
  });
});
