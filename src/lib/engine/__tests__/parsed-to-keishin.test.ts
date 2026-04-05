import { describe, it, expect } from 'vitest';
import { buildKeishinBSFromParsed, buildKeishinPLFromParsed } from '../parsed-to-keishin';
import type { ParsedRawBS, ParsedRawPL } from '@/components/file-upload';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Minimal empty BS input -- all sections are empty records */
function emptyRawBS(): ParsedRawBS {
  return {
    currentAssets: {},
    tangibleFixed: {},
    intangibleFixed: {},
    investments: {},
    currentLiabilities: {},
    fixedLiabilities: {},
    equity: {},
    totals: {},
  };
}

/** Minimal empty PL input -- all fields 0 */
function emptyRawPL(): ParsedRawPL {
  return {
    completedConstruction: 0,
    totalSales: 0,
    costOfSales: 0,
    grossProfit: 0,
    sgaTotal: 0,
    operatingProfit: 0,
    interestIncome: 0,
    dividendIncome: 0,
    interestExpense: 0,
    ordinaryProfit: 0,
    specialGain: 0,
    specialLoss: 0,
    preTaxProfit: 0,
    corporateTax: 0,
    netIncome: 0,
  };
}

// ---------------------------------------------------------------------------
// buildKeishinBSFromParsed
// ---------------------------------------------------------------------------

describe('buildKeishinBSFromParsed', () => {
  it('returns all zeros when given empty input', () => {
    const result = buildKeishinBSFromParsed(emptyRawBS());

    // Every field should be 0
    for (const [key, value] of Object.entries(result)) {
      expect(value, `${key} should be 0`).toBe(0);
    }
  });

  it('maps cash-related current assets correctly', () => {
    const raw = emptyRawBS();
    raw.currentAssets = {
      '現金': 100,
      '普通預金': 200,
      '定期預金': 50,
    };
    raw.totals = { currentAssets: 350, totalAssets: 350 };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.cashDeposits).toBe(350);
    expect(result.currentAssetsTotal).toBe(350);
    expect(result.totalAssets).toBe(350);
  });

  it('maps individual current asset line items', () => {
    const raw = emptyRawBS();
    raw.currentAssets = {
      '受取手形': 10,
      '完成工事未収入金': 20,
      '有価証券': 5,
      '未成工事支出金': 30,
      '材料貯蔵品': 15,
      '短期貸付金': 8,
      '前払費用': 3,
      '繰延税金資産': 2,
      '貸倒引当金': -1,
    };
    const itemsSum = 10 + 20 + 5 + 30 + 15 + 8 + 3 + 2 + (-1);
    raw.totals = { currentAssets: itemsSum, totalAssets: itemsSum };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.notesReceivable).toBe(10);
    expect(result.accountsReceivableConstruction).toBe(20);
    expect(result.securities).toBe(5);
    expect(result.wipConstruction).toBe(30);
    expect(result.materialInventory).toBe(15);
    expect(result.shortTermLoans).toBe(8);
    expect(result.prepaidExpenses).toBe(3);
    expect(result.deferredTaxAssetCurrent).toBe(2);
    expect(result.allowanceDoubtful).toBe(-1);
    expect(result.otherCurrent).toBe(0);
  });

  it('calculates otherCurrent as remainder from currentAssetsTotal', () => {
    const raw = emptyRawBS();
    raw.currentAssets = { '現金': 100 };
    raw.totals = { currentAssets: 250, totalAssets: 250 };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.cashDeposits).toBe(100);
    // otherCurrent = 250 - 100 = 150
    expect(result.otherCurrent).toBe(150);
  });

  it('maps tangible fixed assets and derives toolsEquipment as remainder', () => {
    const raw = emptyRawBS();
    raw.tangibleFixed = {
      '建物': 100,
      '構築物': 20,
      '機械装置': 50,
      '車両運搬具': 10,
      '土地': 300,
    };
    raw.totals = { tangibleFixed: 500, totalAssets: 500 };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.buildingsStructures).toBe(120); // 100+20
    expect(result.machineryVehicles).toBe(60);     // 50+10
    expect(result.land).toBe(300);
    expect(result.toolsEquipment).toBe(20);        // 500 - 120 - 60 - 300
    expect(result.tangibleFixedTotal).toBe(500);
  });

  it('maps intangible fixed assets', () => {
    const raw = emptyRawBS();
    raw.intangibleFixed = { '特許権': 10 };
    raw.totals = { intangibleFixed: 30, totalAssets: 30 };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.patent).toBe(10);
    expect(result.otherIntangible).toBe(20); // 30 - 10
    expect(result.intangibleFixedTotal).toBe(30);
  });

  it('maps investments section', () => {
    const raw = emptyRawBS();
    raw.investments = {
      '関係会社株式': 50,
      '長期貸付金': 20,
      '保険積立金': 10,
      '長期前払費用': 5,
      '繰延税金資産': 3,
    };
    raw.totals = { investments: 100, totalAssets: 100 };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.relatedCompanyShares).toBe(50);
    expect(result.longTermLoans).toBe(20);
    expect(result.insuranceReserve).toBe(10);
    expect(result.longTermPrepaid).toBe(5);
    expect(result.deferredTaxAssetFixed).toBe(3);
    expect(result.otherInvestments).toBe(12); // 100 - 50 - 20 - 10 - 5 - 3
    expect(result.investmentsTotal).toBe(100);
  });

  it('computes fixedAssetsTotal from sub-totals when totals.fixedAssets is absent', () => {
    const raw = emptyRawBS();
    raw.totals = {
      tangibleFixed: 100,
      intangibleFixed: 20,
      investments: 30,
      totalAssets: 150,
    };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.fixedAssetsTotal).toBe(150); // 100+20+30
  });

  it('maps current liabilities', () => {
    const raw = emptyRawBS();
    raw.currentLiabilities = {
      '支払手形': 10,
      '工事未払金': 20,
      '短期借入金': 30,
      'リース債務': 5,
      '未払金': 15,
      '未払法人税等': 8,
      '未成工事受入金': 12,
      '預り金': 3,
      '未払消費税等': 7,
    };
    raw.totals = { currentLiabilities: 110, totalAssets: 0 };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.notesPayable).toBe(10);
    expect(result.constructionPayable).toBe(20);
    expect(result.shortTermBorrowing).toBe(30);
    expect(result.leaseDebt).toBe(5);
    expect(result.accountsPayable).toBe(15);
    expect(result.unpaidCorporateTax).toBe(8);
    expect(result.advanceReceivedConstruction).toBe(12);
    expect(result.depositsReceived).toBe(3);
    expect(result.unpaidConsumptionTax).toBe(7);
    expect(result.currentLiabilitiesTotal).toBe(110);
  });

  it('maps fixed liabilities', () => {
    const raw = emptyRawBS();
    raw.fixedLiabilities = { '長期借入金': 500 };
    raw.totals = { fixedLiabilities: 500, totalAssets: 0 };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.longTermBorrowing).toBe(500);
    expect(result.fixedLiabilitiesTotal).toBe(500);
  });

  it('maps equity section and derives retained earnings', () => {
    const raw = emptyRawBS();
    raw.equity = {
      '資本金': 1000,
      '利益準備金': 50,
      '積立金': 100,
      '別途積立金': 200,
      '自己株式': -30,
      'その他有価証券評価差額金': 10,
    };
    raw.totals = { totalEquity: 2000, totalAssets: 2000 };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.capitalStock).toBe(1000);
    expect(result.legalReserve).toBe(50);
    expect(result.otherRetainedEarnings).toBe(100);
    expect(result.specialReserve).toBe(200);
    expect(result.treasuryStock).toBe(-30);
    expect(result.securitiesValuation).toBe(10);
    expect(result.totalEquity).toBe(2000);

    // retainedEarningsTotal = totalEquity - capitalStock - treasuryStock - securitiesValuation
    // = 2000 - 1000 - (-30) - 10 = 1020
    expect(result.retainedEarningsTotal).toBe(1020);

    // retainedEarningsCF = retainedEarningsTotal - legalReserve - otherRetainedEarnings - specialReserve
    // = 1020 - 50 - 100 - 200 = 670
    expect(result.retainedEarningsCF).toBe(670);

    // shareholdersEquityTotal = capitalStock + retainedEarningsTotal + treasuryStock
    // = 1000 + 1020 + (-30) = 1990
    expect(result.shareholdersEquityTotal).toBe(1990);

    expect(result.evaluationTotal).toBe(10);
  });

  it('computes totalLiabilitiesEquity = totalLiabilities + totalEquity', () => {
    const raw = emptyRawBS();
    raw.totals = {
      currentLiabilities: 100,
      fixedLiabilities: 200,
      totalLiabilities: 300,
      totalEquity: 500,
      totalAssets: 800,
    };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.totalLiabilities).toBe(300);
    expect(result.totalEquity).toBe(500);
    expect(result.totalLiabilitiesEquity).toBe(800);
  });

  it('computes deferredAssetsTotal = totalAssets - currentAssetsTotal - fixedAssetsTotal', () => {
    const raw = emptyRawBS();
    raw.totals = {
      currentAssets: 100,
      tangibleFixed: 50,
      intangibleFixed: 20,
      investments: 10,
      totalAssets: 200,
    };

    const result = buildKeishinBSFromParsed(raw);

    // fixedAssetsTotal = 50 + 20 + 10 = 80
    // deferredAssetsTotal = 200 - 100 - 80 = 20
    expect(result.deferredAssetsTotal).toBe(20);
  });

  it('uses Japanese key fallback in totals (e.g. 流動資産合計)', () => {
    const raw = emptyRawBS();
    raw.currentAssets = { '現金': 100 };
    raw.totals = { '流動資産合計': 100, '資産合計': 100 } as Record<string, number>;

    const result = buildKeishinBSFromParsed(raw);

    expect(result.currentAssetsTotal).toBe(100);
    expect(result.totalAssets).toBe(100);
  });

  it('sums multiple keys for the same field (e.g. 関係会社株式 + 子会社株式)', () => {
    const raw = emptyRawBS();
    raw.investments = {
      '関係会社株式': 30,
      '子会社株式': 20,
    };
    raw.totals = { investments: 50, totalAssets: 50 };

    const result = buildKeishinBSFromParsed(raw);

    expect(result.relatedCompanyShares).toBe(50);
  });

  it('handles totals.totalLiabilities fallback to sum of current + fixed', () => {
    const raw = emptyRawBS();
    raw.totals = {
      currentLiabilities: 100,
      fixedLiabilities: 200,
      totalAssets: 0,
    };
    // totalLiabilities not set -- should fall back to 100 + 200

    const result = buildKeishinBSFromParsed(raw);

    expect(result.totalLiabilities).toBe(300);
  });
});

// ---------------------------------------------------------------------------
// buildKeishinPLFromParsed
// ---------------------------------------------------------------------------

describe('buildKeishinPLFromParsed', () => {
  it('returns all zeros (and zero costReport) when given empty input', () => {
    const result = buildKeishinPLFromParsed(emptyRawPL());

    expect(result.completedConstructionRevenue).toBe(0);
    expect(result.sideBusiness).toBe(0);
    expect(result.totalSales).toBe(0);
    expect(result.grossProfit).toBe(0);
    expect(result.operatingProfit).toBe(0);
    expect(result.netIncome).toBe(0);
    expect(result.depreciation).toBe(0);
    expect(result.costReport).toEqual({
      materials: 0,
      labor: 0,
      laborSubcontract: 0,
      subcontract: 0,
      expenses: 0,
      personnelInExpenses: 0,
      totalCost: 0,
    });
  });

  it('maps basic PL fields directly', () => {
    const raw: ParsedRawPL = {
      completedConstruction: 5000,
      totalSales: 6000,
      costOfSales: 3000,
      grossProfit: 3000,
      sgaTotal: 1000,
      operatingProfit: 2000,
      interestIncome: 10,
      dividendIncome: 5,
      interestExpense: 20,
      ordinaryProfit: 1995,
      specialGain: 50,
      specialLoss: 30,
      preTaxProfit: 2015,
      corporateTax: 600,
      netIncome: 1415,
    };

    const result = buildKeishinPLFromParsed(raw);

    expect(result.completedConstructionRevenue).toBe(5000);
    expect(result.totalSales).toBe(6000);
    expect(result.completedConstructionCost).toBe(3000);
    expect(result.grossProfit).toBe(3000);
    expect(result.sgaTotal).toBe(1000);
    expect(result.operatingProfit).toBe(2000);
    expect(result.ordinaryProfit).toBe(1995);
    expect(result.specialGain).toBe(50);
    expect(result.specialLoss).toBe(30);
    expect(result.preTaxProfit).toBe(2015);
    expect(result.corporateTax).toBe(600);
    expect(result.netIncome).toBe(1415);
  });

  it('computes sideBusiness = totalSales - completedConstruction', () => {
    const raw = emptyRawPL();
    raw.totalSales = 10000;
    raw.completedConstruction = 8000;

    const result = buildKeishinPLFromParsed(raw);

    expect(result.sideBusiness).toBe(2000);
  });

  it('computes interestDividendIncome = interestIncome + dividendIncome', () => {
    const raw = emptyRawPL();
    raw.interestIncome = 100;
    raw.dividendIncome = 50;

    const result = buildKeishinPLFromParsed(raw);

    expect(result.interestDividendIncome).toBe(150);
    expect(result.nonOpIncomeTotal).toBe(150); // otherNonOpIncome is always 0
  });

  it('maps interestExpense and nonOpExpenseTotal', () => {
    const raw = emptyRawPL();
    raw.interestExpense = 80;

    const result = buildKeishinPLFromParsed(raw);

    expect(result.interestExpense).toBe(80);
    expect(result.nonOpExpenseTotal).toBe(80); // otherNonOpExpense is always 0
  });

  it('always sets sideBusinessCost, taxAdjustment, depreciation to 0', () => {
    const raw: ParsedRawPL = {
      completedConstruction: 5000,
      totalSales: 5000,
      costOfSales: 3000,
      grossProfit: 2000,
      sgaTotal: 500,
      operatingProfit: 1500,
      interestIncome: 10,
      dividendIncome: 5,
      interestExpense: 20,
      ordinaryProfit: 1495,
      specialGain: 0,
      specialLoss: 0,
      preTaxProfit: 1495,
      corporateTax: 400,
      netIncome: 1095,
    };

    const result = buildKeishinPLFromParsed(raw);

    expect(result.sideBusinessCost).toBe(0);
    expect(result.taxAdjustment).toBe(0);
    expect(result.depreciation).toBe(0);
    expect(result.otherNonOpIncome).toBe(0);
    expect(result.otherNonOpExpense).toBe(0);
  });

  it('always sets costReport to all zeros', () => {
    const raw = emptyRawPL();
    raw.totalSales = 99999;

    const result = buildKeishinPLFromParsed(raw);

    expect(result.costReport).toEqual({
      materials: 0,
      labor: 0,
      laborSubcontract: 0,
      subcontract: 0,
      expenses: 0,
      personnelInExpenses: 0,
      totalCost: 0,
    });
  });

  it('handles negative sideBusiness when completedConstruction > totalSales', () => {
    const raw = emptyRawPL();
    raw.totalSales = 1000;
    raw.completedConstruction = 1500;

    const result = buildKeishinPLFromParsed(raw);

    expect(result.sideBusiness).toBe(-500);
  });
});
