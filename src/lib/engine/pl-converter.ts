/**
 * PL変換エンジン
 *
 * ★重要ルール（実績検証済み）:
 * 1. 完成工事高 = 決算書の完成工事高 + 出来高工事高（全額を建設業売上として計上）
 * 2. 受取利息 + 受取配当金 → 受取利息配当金として合算
 * 3. 販管費は科目別に千円変換後に合計を再集計
 * 4. 完成工事原価の経費 = 製造経費 + (期首WIP − 期末WIP)
 * 5. 減価償却実施額 = 製造原価中の減価償却費 + 販管費中の減価償却費
 */

import type { RawFinancialData, KeishinPL } from './types';

function truncK(yen: number): number {
  if (yen >= 0) return Math.floor(yen / 1000);
  return -Math.floor(-yen / 1000);
}

export function convertPL(raw: RawFinancialData): KeishinPL {
  // ★完成工事高 = 完成工事高 + 出来高工事高
  const completedConstructionRevenue = truncK(
    raw.pl.completedConstruction + raw.pl.progressConstruction
  );

  // 兼業売上高（あれば totalSales - (完成工事高+出来高)）
  const sideBusiness = truncK(
    raw.pl.totalSales -
      raw.pl.completedConstruction -
      raw.pl.progressConstruction
  );

  const totalSales = truncK(raw.pl.totalSales);

  const completedConstructionCost = truncK(raw.pl.costOfSales);
  const sideBusinessCost = 0; // 兼業原価があれば別途
  const grossProfit = totalSales - completedConstructionCost - sideBusinessCost;

  // ★販管費は科目別に千円変換後に合計を再集計
  let sgaTotal = 0;
  for (const value of Object.values(raw.pl.sgaItems)) {
    sgaTotal += truncK(value);
  }

  const operatingProfit = grossProfit - sgaTotal;

  // ★受取利息 + 受取配当金 → 受取利息配当金
  const interestDividendIncome = truncK(
    raw.pl.interestIncome + raw.pl.dividendIncome
  );
  const otherNonOpIncome = truncK(raw.pl.miscIncome);
  const nonOpIncomeTotal = interestDividendIncome + otherNonOpIncome;

  const interestExpense = truncK(raw.pl.interestExpense);
  const otherNonOpExpense = truncK(raw.pl.miscExpense);
  const nonOpExpenseTotal = interestExpense + otherNonOpExpense;

  const ordinaryProfit = operatingProfit + nonOpIncomeTotal - nonOpExpenseTotal;

  const specialGain = truncK(raw.pl.specialGain);
  const specialLoss = truncK(raw.pl.specialLoss);

  const preTaxProfit = ordinaryProfit + specialGain - specialLoss;

  const corporateTax = truncK(raw.pl.corporateTax);
  const taxAdjustment = 0;
  const netIncome = preTaxProfit - corporateTax - taxAdjustment;

  // ★完成工事原価報告書
  const materials = truncK(raw.manufacturing.materials);
  const labor = truncK(raw.manufacturing.labor);
  const laborSubcontract = 0;
  const subcontract = truncK(raw.manufacturing.subcontract);
  // ★経費 = 製造経費 + (期首WIP − 期末WIP)
  const costReportExpenses =
    truncK(raw.manufacturing.expenses) +
    truncK(raw.manufacturing.wipBeginning) -
    truncK(raw.manufacturing.wipEnding);
  const personnelInExpenses = 0;
  const costReportTotal = materials + labor + laborSubcontract + subcontract + costReportExpenses;

  // ★減価償却実施額 = 製造原価中 + 販管費中
  const depreciation =
    truncK(raw.manufacturing.mfgDepreciation) +
    truncK(raw.sga.sgaDepreciation);

  return {
    completedConstructionRevenue,
    sideBusiness,
    totalSales,
    completedConstructionCost,
    sideBusinessCost,
    grossProfit,
    sgaTotal,
    operatingProfit,
    interestDividendIncome,
    otherNonOpIncome,
    nonOpIncomeTotal,
    interestExpense,
    otherNonOpExpense,
    nonOpExpenseTotal,
    ordinaryProfit,
    specialGain,
    specialLoss,
    preTaxProfit,
    corporateTax,
    taxAdjustment,
    netIncome,
    costReport: {
      materials,
      labor,
      laborSubcontract,
      subcontract,
      expenses: costReportExpenses,
      personnelInExpenses,
      totalCost: costReportTotal,
    },
    depreciation,
  };
}
