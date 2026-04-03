/**
 * ParsedRawBS/PL → KeishinBS/PL 変換
 *
 * file-upload.tsx の ParsedRawBS / ParsedRawPL は Gemini OCR が返す千円単位データ。
 * bs-converter.ts の convertBS は円→千円変換（truncK）を行うが、
 * ここでは既に千円単位なので truncK なしで直接マッピングする。
 *
 * Record<string, number> のキーは日本語科目名。
 * 存在しないキーは 0 として扱う。
 */

import type { KeishinBS, KeishinPL } from './types';
import type { ParsedRawBS, ParsedRawPL } from '@/components/file-upload';

function get(record: Record<string, number>, ...keys: string[]): number {
  let sum = 0;
  for (const key of keys) {
    sum += record[key] ?? 0;
  }
  return sum;
}

export function buildKeishinBSFromParsed(raw: ParsedRawBS): KeishinBS {
  const ca = raw.currentAssets;
  const tf = raw.tangibleFixed;
  const inf = raw.intangibleFixed;
  const inv = raw.investments;
  const cl = raw.currentLiabilities;
  const fl = raw.fixedLiabilities;
  const eq = raw.equity;
  const t = raw.totals;

  // セクション合計（totalsから取得）
  const currentAssetsTotal = t.currentAssets ?? t['流動資産合計'] ?? 0;
  const tangibleFixedTotal = t.tangibleFixed ?? t['有形固定資産合計'] ?? 0;
  const intangibleFixedTotal = t.intangibleFixed ?? t['無形固定資産合計'] ?? 0;
  const investmentsTotal = t.investments ?? t['投資その他の資産合計'] ?? 0;
  const fixedAssetsTotal = t.fixedAssets ?? t['固定資産合計'] ?? (tangibleFixedTotal + intangibleFixedTotal + investmentsTotal);
  const totalAssets = t.totalAssets ?? t['資産合計'] ?? 0;
  const currentLiabilitiesTotal = t.currentLiabilities ?? t['流動負債合計'] ?? 0;
  const fixedLiabilitiesTotal = t.fixedLiabilities ?? t['固定負債合計'] ?? 0;
  const totalLiabilities = t.totalLiabilities ?? t['負債合計'] ?? (currentLiabilitiesTotal + fixedLiabilitiesTotal);
  const totalEquity = t.totalEquity ?? t['純資産合計'] ?? 0;

  // 流動資産
  const cashDeposits = get(ca, '現金', '小口現金', '当座預金', '普通預金', '定期預金', '積立定期預金', '現金及び預金');
  const notesReceivable = get(ca, '受取手形');
  const accountsReceivableConstruction = get(ca, '完成工事未収入金');
  const securities = get(ca, '有価証券', '短期有価証券');
  const wipConstruction = get(ca, '未成工事支出金');
  const materialInventory = get(ca, '材料貯蔵品');
  const shortTermLoans = get(ca, '短期貸付金');
  const prepaidExpenses = get(ca, '前払費用');
  const deferredTaxAssetCurrent = get(ca, '繰延税金資産');
  const allowanceDoubtful = get(ca, '貸倒引当金');
  const otherCurrent = currentAssetsTotal - cashDeposits - notesReceivable
    - accountsReceivableConstruction - securities - wipConstruction
    - materialInventory - shortTermLoans - prepaidExpenses
    - deferredTaxAssetCurrent - allowanceDoubtful;

  // 有形固定資産
  const buildingsStructures = get(tf, '建物', '構築物', '建物付属設備');
  const machineryVehicles = get(tf, '機械装置', '車両運搬具');
  const land = get(tf, '土地');
  const toolsEquipment = tangibleFixedTotal - buildingsStructures - machineryVehicles - land;

  // 無形固定資産
  const patent = get(inf, '特許権');
  const otherIntangible = intangibleFixedTotal - patent;

  // 投資その他
  const relatedCompanyShares = get(inv, '関係会社株式', '関連会社株式', '子会社株式');
  const longTermLoans = get(inv, '長期貸付金');
  const insuranceReserve = get(inv, '保険積立金', '生命保険積立金');
  const longTermPrepaid = get(inv, '長期前払費用');
  const deferredTaxAssetFixed = get(inv, '繰延税金資産');
  const otherInvestments = investmentsTotal - relatedCompanyShares - longTermLoans
    - insuranceReserve - longTermPrepaid - deferredTaxAssetFixed;

  const deferredAssetsTotal = totalAssets - currentAssetsTotal - fixedAssetsTotal;

  // 流動負債
  const notesPayable = get(cl, '支払手形');
  const constructionPayable = get(cl, '工事未払金', '未払外注費');
  const shortTermBorrowing = get(cl, '短期借入金');
  const leaseDebt = get(cl, 'リース債務');
  const accountsPayable = get(cl, '買掛金', '未払金');
  const unpaidExpenses = get(cl, '未払給与', '未払経費');
  const unpaidCorporateTax = get(cl, '未払法人税等');
  const deferredTaxLiability = get(cl, '繰延税金負債');
  const advanceReceivedConstruction = get(cl, '未成工事受入金');
  const depositsReceived = get(cl, '預り金');
  const advanceRevenue = get(cl, '前受収益');
  const provisions = get(cl, '賞与引当金', '完成工事補償引当金', 'その他引当金');
  const unpaidConsumptionTax = get(cl, '未払消費税等');

  // 固定負債
  const longTermBorrowing = get(fl, '長期借入金');

  // 純資産
  const capitalStock = get(eq, '資本金');
  const legalReserve = get(eq, '利益準備金');
  const otherRetainedEarnings = get(eq, '積立金', 'その他利益剰余金積立金');
  const specialReserve = get(eq, '別途積立金');
  const treasuryStock = get(eq, '自己株式');
  const securitiesValuation = get(eq, 'その他有価証券評価差額金');

  const retainedEarningsTotal = totalEquity - capitalStock - treasuryStock - securitiesValuation;
  const retainedEarningsCF = retainedEarningsTotal - legalReserve - otherRetainedEarnings - specialReserve;
  const shareholdersEquityTotal = capitalStock + retainedEarningsTotal + treasuryStock;
  const evaluationTotal = securitiesValuation;
  const totalLiabilitiesEquity = totalLiabilities + totalEquity;

  return {
    cashDeposits, notesReceivable, accountsReceivableConstruction, securities,
    wipConstruction, materialInventory, shortTermLoans, prepaidExpenses,
    deferredTaxAssetCurrent, otherCurrent, allowanceDoubtful, currentAssetsTotal,
    buildingsStructures, machineryVehicles, toolsEquipment, land, tangibleFixedTotal,
    patent, otherIntangible, intangibleFixedTotal,
    relatedCompanyShares, longTermLoans, insuranceReserve, longTermPrepaid,
    deferredTaxAssetFixed, otherInvestments, investmentsTotal, fixedAssetsTotal,
    deferredAssetsTotal, totalAssets,
    notesPayable, constructionPayable, shortTermBorrowing, leaseDebt,
    accountsPayable, unpaidExpenses, unpaidCorporateTax, deferredTaxLiability,
    advanceReceivedConstruction, depositsReceived, advanceRevenue, provisions,
    unpaidConsumptionTax, currentLiabilitiesTotal,
    longTermBorrowing, fixedLiabilitiesTotal, totalLiabilities,
    capitalStock, legalReserve, otherRetainedEarnings, specialReserve,
    retainedEarningsCF, retainedEarningsTotal, treasuryStock,
    shareholdersEquityTotal, securitiesValuation, evaluationTotal,
    totalEquity, totalLiabilitiesEquity,
  };
}

export function buildKeishinPLFromParsed(raw: ParsedRawPL): KeishinPL {
  const completedConstructionRevenue = raw.completedConstruction;
  const sideBusiness = raw.totalSales - raw.completedConstruction;
  const totalSales = raw.totalSales;
  const completedConstructionCost = raw.costOfSales;
  const sideBusinessCost = 0;
  const grossProfit = raw.grossProfit;
  const sgaTotal = raw.sgaTotal;
  const operatingProfit = raw.operatingProfit;

  const interestDividendIncome = raw.interestIncome + raw.dividendIncome;
  const otherNonOpIncome = 0;
  const nonOpIncomeTotal = interestDividendIncome + otherNonOpIncome;

  const interestExpense = raw.interestExpense;
  const otherNonOpExpense = 0;
  const nonOpExpenseTotal = interestExpense + otherNonOpExpense;

  const ordinaryProfit = raw.ordinaryProfit;
  const specialGain = raw.specialGain;
  const specialLoss = raw.specialLoss;
  const preTaxProfit = raw.preTaxProfit;
  const corporateTax = raw.corporateTax;
  const taxAdjustment = 0;
  const netIncome = raw.netIncome;

  return {
    completedConstructionRevenue, sideBusiness, totalSales,
    completedConstructionCost, sideBusinessCost, grossProfit,
    sgaTotal, operatingProfit,
    interestDividendIncome, otherNonOpIncome, nonOpIncomeTotal,
    interestExpense, otherNonOpExpense, nonOpExpenseTotal,
    ordinaryProfit, specialGain, specialLoss, preTaxProfit,
    corporateTax, taxAdjustment, netIncome,
    costReport: {
      materials: 0, labor: 0, laborSubcontract: 0,
      subcontract: 0, expenses: 0, personnelInExpenses: 0, totalCost: 0,
    },
    depreciation: 0,
  };
}
