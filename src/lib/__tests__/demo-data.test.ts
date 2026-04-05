import { describe, it, expect } from 'vitest';
import {
  financials,
  demoBasicInfo,
  ebitda,
  industryInputs,
  prevData,
  demoResult,
  demoFinancialSummary,
  demoIndustrySummary,
  demoBS,
  demoPL,
} from '@/lib/demo-data';

describe('financials', () => {
  const requiredFields = [
    'sales', 'grossProfit', 'ordinaryProfit', 'interestExpense',
    'interestDividendIncome', 'currentLiabilities', 'fixedLiabilities',
    'totalCapital', 'equity', 'fixedAssets', 'retainedEarnings',
    'corporateTax', 'depreciation', 'allowanceDoubtful',
    'notesAndReceivable', 'constructionPayable',
    'inventoryAndMaterials', 'advanceReceived',
  ] as const;

  it.each(requiredFields)('has required field: %s', (field) => {
    expect(financials).toHaveProperty(field);
    expect(typeof financials[field]).toBe('number');
  });

  it('sales is positive and in a reasonable range (thousands of yen)', () => {
    expect(financials.sales).toBeGreaterThan(0);
    expect(financials.sales).toBeLessThan(100_000_000); // < 1000億
  });

  it('grossProfit is less than sales', () => {
    expect(financials.grossProfit).toBeLessThan(financials.sales);
  });

  it('equity is less than or equal to totalCapital', () => {
    expect(financials.equity).toBeLessThanOrEqual(financials.totalCapital);
  });

  it('ordinaryProfit is less than grossProfit', () => {
    expect(financials.ordinaryProfit).toBeLessThan(financials.grossProfit);
  });

  it('liabilities are positive', () => {
    expect(financials.currentLiabilities).toBeGreaterThan(0);
    expect(financials.fixedLiabilities).toBeGreaterThan(0);
  });
});

describe('demoBasicInfo', () => {
  it('has all required fields', () => {
    expect(demoBasicInfo).toHaveProperty('companyName');
    expect(demoBasicInfo).toHaveProperty('permitNumber');
    expect(demoBasicInfo).toHaveProperty('reviewBaseDate');
    expect(demoBasicInfo).toHaveProperty('periodNumber');
  });

  it('fields are non-empty strings', () => {
    expect(demoBasicInfo.companyName.length).toBeGreaterThan(0);
    expect(demoBasicInfo.permitNumber.length).toBeGreaterThan(0);
    expect(demoBasicInfo.reviewBaseDate.length).toBeGreaterThan(0);
    expect(demoBasicInfo.periodNumber.length).toBeGreaterThan(0);
  });
});

describe('ebitda', () => {
  it('is a positive number', () => {
    expect(ebitda).toBeGreaterThan(0);
  });
});

describe('industryInputs', () => {
  it('has at least one entry', () => {
    expect(industryInputs.length).toBeGreaterThan(0);
  });

  it.each(industryInputs.map((ind, i) => [ind.name, ind, i] as const))(
    '%s has all required fields',
    (_name, ind) => {
      expect(ind).toHaveProperty('name');
      expect(ind).toHaveProperty('permitType');
      expect(ind).toHaveProperty('prevCompletion');
      expect(ind).toHaveProperty('currCompletion');
      expect(ind).toHaveProperty('prevSubcontract');
      expect(ind).toHaveProperty('currSubcontract');
      expect(ind).toHaveProperty('techStaffValue');
    },
  );

  it.each(industryInputs.map((ind) => [ind.name, ind] as const))(
    '%s has valid permitType',
    (_name, ind) => {
      expect(['特定', '一般']).toContain(ind.permitType);
    },
  );

  it.each(industryInputs.map((ind) => [ind.name, ind] as const))(
    '%s completion values are positive',
    (_name, ind) => {
      expect(ind.prevCompletion).toBeGreaterThan(0);
      expect(ind.currCompletion).toBeGreaterThan(0);
    },
  );

  it.each(industryInputs.map((ind) => [ind.name, ind] as const))(
    '%s subcontract is less than completion',
    (_name, ind) => {
      expect(ind.prevSubcontract).toBeLessThan(ind.prevCompletion);
      expect(ind.currSubcontract).toBeLessThan(ind.currCompletion);
    },
  );
});

describe('prevData', () => {
  it('has all required fields', () => {
    const requiredFields = [
      'totalCapital', 'operatingCF', 'allowanceDoubtful',
      'notesAndAccountsReceivable', 'constructionPayable',
      'inventoryAndMaterials', 'advanceReceived',
    ];
    for (const field of requiredFields) {
      expect(prevData).toHaveProperty(field);
    }
  });

  it('totalCapital is positive', () => {
    expect(prevData.totalCapital).toBeGreaterThan(0);
  });
});

describe('demoBS (Balance Sheet)', () => {
  it('totalAssets equals totalLiabilitiesEquity', () => {
    expect(demoBS.totalAssets).toBe(demoBS.totalLiabilitiesEquity);
  });

  it('totalLiabilities + totalEquity equals totalLiabilitiesEquity', () => {
    expect(demoBS.totalLiabilities + demoBS.totalEquity).toBe(demoBS.totalLiabilitiesEquity);
  });

  it('currentLiabilitiesTotal + fixedLiabilitiesTotal equals totalLiabilities', () => {
    expect(demoBS.currentLiabilitiesTotal + demoBS.fixedLiabilitiesTotal).toBe(demoBS.totalLiabilities);
  });

  it('all monetary values are numbers', () => {
    for (const [key, value] of Object.entries(demoBS)) {
      expect(typeof value).toBe('number');
    }
  });
});

describe('demoPL (Profit & Loss)', () => {
  it('completedConstructionRevenue matches financials.sales', () => {
    expect(demoPL.completedConstructionRevenue).toBe(financials.sales);
  });

  it('grossProfit = totalSales - completedConstructionCost - sideBusinessCost', () => {
    expect(demoPL.grossProfit).toBe(
      demoPL.totalSales - demoPL.completedConstructionCost - demoPL.sideBusinessCost,
    );
  });

  it('operatingProfit = grossProfit - sgaTotal', () => {
    expect(demoPL.operatingProfit).toBe(demoPL.grossProfit - demoPL.sgaTotal);
  });

  it('ordinaryProfit matches financials', () => {
    expect(demoPL.ordinaryProfit).toBe(financials.ordinaryProfit);
  });

  it('costReport.totalCost equals sum of main cost categories', () => {
    const cr = demoPL.costReport;
    // laborSubcontract and personnelInExpenses are breakdowns, not additive
    expect(cr.totalCost).toBe(
      cr.materials + cr.labor + cr.subcontract + cr.expenses,
    );
  });

  it('costReport.totalCost equals completedConstructionCost', () => {
    expect(demoPL.costReport.totalCost).toBe(demoPL.completedConstructionCost);
  });

  it('all numeric fields are numbers', () => {
    for (const [key, value] of Object.entries(demoPL)) {
      if (key === 'costReport') {
        for (const [, v] of Object.entries(value as Record<string, number>)) {
          expect(typeof v).toBe('number');
        }
      } else {
        expect(typeof value).toBe('number');
      }
    }
  });
});

describe('demoResult (computed)', () => {
  it('has all required score fields', () => {
    expect(demoResult).toHaveProperty('Y');
    expect(demoResult).toHaveProperty('X2');
    expect(demoResult).toHaveProperty('X21');
    expect(demoResult).toHaveProperty('X22');
    expect(demoResult).toHaveProperty('W');
  });

  it('Y score is within valid range (0-1595)', () => {
    expect(demoResult.Y).toBeGreaterThanOrEqual(0);
    expect(demoResult.Y).toBeLessThanOrEqual(1595);
  });

  it('has industry results', () => {
    expect(demoResult.industries.length).toBe(industryInputs.length);
  });

  it.each(demoResult.industries.map((ind) => [ind.name, ind] as const))(
    '%s has P score in valid range (0-2136)',
    (_name, ind) => {
      expect(ind.P).toBeGreaterThanOrEqual(0);
      expect(ind.P).toBeLessThanOrEqual(2136);
    },
  );

  it('has previous period comparison data', () => {
    expect(typeof demoResult.prevY).toBe('number');
    expect(typeof demoResult.prevX2).toBe('number');
    expect(typeof demoResult.prevW).toBe('number');
  });

  it('companyName and period are set', () => {
    expect(demoResult.companyName).toBe(demoBasicInfo.companyName);
    expect(demoResult.period).toBe(demoBasicInfo.periodNumber);
  });
});

describe('demoFinancialSummary', () => {
  it('has entries', () => {
    expect(demoFinancialSummary.length).toBeGreaterThan(0);
  });

  it('each entry has label, value, unit', () => {
    for (const entry of demoFinancialSummary) {
      expect(typeof entry.label).toBe('string');
      expect(typeof entry.value).toBe('number');
      expect(typeof entry.unit).toBe('string');
    }
  });
});

describe('demoIndustrySummary', () => {
  it('has same count as industryInputs', () => {
    expect(demoIndustrySummary.length).toBe(industryInputs.length);
  });

  it('each entry has required fields', () => {
    for (const entry of demoIndustrySummary) {
      expect(entry).toHaveProperty('name');
      expect(entry).toHaveProperty('permitType');
      expect(entry).toHaveProperty('avgCompletion');
      expect(entry).toHaveProperty('avgSubcontract');
      expect(entry).toHaveProperty('techStaffValue');
    }
  });
});
