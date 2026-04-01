/**
 * BS変換エンジン
 *
 * 決算書BS（円）→ 経審用BS（千円）変換
 *
 * ★重要ルール（実績検証済み）:
 * 1. セクション合計を千円切捨てで先に確定（残差配分法）
 * 2. 建物付属設備 → 建物・構築物に含める（工具器具備品ではない）
 * 3. 工事未払金 = 工事未払金 + 未払外注費（未払経費は含めない）
 * 4. 未払費用 = 未払給与 + 未払経費
 * 5. 「その他」「工具器具備品」は残差（セクション合計 − 明示科目）
 * 6. 純資産合計の千円値を先に確定し、繰越利益剰余金を残差で算出
 */

import type { RawFinancialData, KeishinBS } from './types';

/** 千円切捨て（正数は切捨て、負数は絶対値切捨ての負数） */
function truncK(yen: number): number {
  if (yen >= 0) return Math.floor(yen / 1000);
  return -Math.floor(-yen / 1000);
}

function get(record: Record<string, number>, ...keys: string[]): number {
  let sum = 0;
  for (const key of keys) {
    sum += record[key] ?? 0;
  }
  return sum;
}

export function convertBS(raw: RawFinancialData): KeishinBS {
  // 各セクション合計を千円切捨てで確定
  const currentAssetsTotal = truncK(raw.bs.totals.currentAssets);
  const tangibleFixedTotal = truncK(raw.bs.totals.tangibleFixed);
  const intangibleFixedTotal = truncK(raw.bs.totals.intangibleFixed);
  const investmentsTotal = truncK(raw.bs.totals.investments);
  const fixedAssetsTotal = truncK(raw.bs.totals.fixedAssets);
  const totalAssets = truncK(raw.bs.totals.totalAssets);
  const currentLiabilitiesTotal = truncK(raw.bs.totals.currentLiabilities);
  const fixedLiabilitiesTotal = truncK(raw.bs.totals.fixedLiabilities);
  const totalLiabilities = truncK(raw.bs.totals.totalLiabilities);
  const totalEquity = truncK(raw.bs.totals.totalEquity);

  // ── 流動資産 ──
  const cashDeposits = truncK(
    get(
      raw.bs.currentAssets,
      '現金',
      '小口現金',
      '当座預金',
      '普通預金',
      '定期預金',
      '積立定期預金',
      '現金及び預金'
    )
  );
  const notesReceivable = truncK(
    get(raw.bs.currentAssets, '受取手形')
  );
  const accountsReceivableConstruction = truncK(
    get(raw.bs.currentAssets, '完成工事未収入金')
  );
  const securities = truncK(
    get(raw.bs.currentAssets, '有価証券', '短期有価証券')
  );
  const wipConstruction = truncK(
    get(raw.bs.currentAssets, '未成工事支出金')
  );
  const materialInventory = truncK(
    get(raw.bs.currentAssets, '材料貯蔵品')
  );
  const shortTermLoans = truncK(
    get(raw.bs.currentAssets, '短期貸付金')
  );
  const prepaidExpenses = truncK(
    get(raw.bs.currentAssets, '前払費用')
  );
  const deferredTaxAssetCurrent = truncK(
    get(raw.bs.currentAssets, '繰延税金資産')
  );
  const allowanceDoubtful = truncK(
    get(raw.bs.currentAssets, '貸倒引当金')
  );
  // ★その他は残差
  const otherCurrent =
    currentAssetsTotal -
    cashDeposits -
    notesReceivable -
    accountsReceivableConstruction -
    securities -
    wipConstruction -
    materialInventory -
    shortTermLoans -
    prepaidExpenses -
    deferredTaxAssetCurrent -
    allowanceDoubtful;

  // ── 有形固定資産 ──
  // ★建物付属設備は建物・構築物に含める
  const buildingsStructures = truncK(
    get(raw.bs.tangibleFixed, '建物', '構築物', '建物付属設備')
  );
  const machineryVehicles = truncK(
    get(raw.bs.tangibleFixed, '機械装置', '車両運搬具')
  );
  const land = truncK(get(raw.bs.tangibleFixed, '土地'));
  // ★工具器具備品は残差
  const toolsEquipment =
    tangibleFixedTotal - buildingsStructures - machineryVehicles - land;

  // ── 無形固定資産 ──
  const patent = truncK(get(raw.bs.intangibleFixed, '特許権'));
  // ★その他は残差
  const otherIntangible = intangibleFixedTotal - patent;

  // ── 投資その他 ──
  const relatedCompanyShares = truncK(
    get(raw.bs.investments, '関係会社株式', '関連会社株式', '子会社株式')
  );
  const longTermLoans = truncK(
    get(raw.bs.investments, '長期貸付金')
  );
  const insuranceReserve = truncK(
    get(raw.bs.investments, '保険積立金', '生命保険積立金')
  );
  const longTermPrepaid = truncK(
    get(raw.bs.investments, '長期前払費用')
  );
  const deferredTaxAssetFixed = truncK(
    get(raw.bs.investments, '繰延税金資産')
  );
  // ★その他は残差
  const otherInvestments =
    investmentsTotal -
    relatedCompanyShares -
    longTermLoans -
    insuranceReserve -
    longTermPrepaid -
    deferredTaxAssetFixed;

  // 繰延資産（通常はゼロ）
  const deferredAssetsTotal = totalAssets - currentAssetsTotal - fixedAssetsTotal;

  // ── 流動負債 ──
  const notesPayable = truncK(
    get(raw.bs.currentLiabilities, '支払手形')
  );
  // ★工事未払金 = 工事未払金 + 未払外注費（未払経費は含めない）
  const constructionPayable = truncK(
    get(raw.bs.currentLiabilities, '工事未払金', '未払外注費')
  );
  const shortTermBorrowing = truncK(
    get(raw.bs.currentLiabilities, '短期借入金')
  );
  const leaseDebt = truncK(
    get(raw.bs.currentLiabilities, 'リース債務')
  );
  const accountsPayable = truncK(
    get(raw.bs.currentLiabilities, '買掛金', '未払金')
  );
  // ★未払費用 = 未払給与 + 未払経費
  const unpaidExpenses = truncK(
    get(raw.bs.currentLiabilities, '未払給与', '未払経費')
  );
  const unpaidCorporateTax = truncK(
    get(raw.bs.currentLiabilities, '未払法人税等')
  );
  const deferredTaxLiability = truncK(
    get(raw.bs.currentLiabilities, '繰延税金負債')
  );
  const advanceReceivedConstruction = truncK(
    get(raw.bs.currentLiabilities, '未成工事受入金')
  );
  const depositsReceived = truncK(
    get(raw.bs.currentLiabilities, '預り金')
  );
  const advanceRevenue = truncK(
    get(raw.bs.currentLiabilities, '前受収益')
  );
  const provisions = truncK(
    get(
      raw.bs.currentLiabilities,
      '賞与引当金',
      '完成工事補償引当金',
      'その他引当金'
    )
  );
  const unpaidConsumptionTax = truncK(
    get(raw.bs.currentLiabilities, '未払消費税等')
  );

  // ── 固定負債 ──
  const longTermBorrowing = truncK(
    get(raw.bs.fixedLiabilities, '長期借入金')
  );

  // ── 純資産 ──
  const capitalStock = truncK(get(raw.bs.equity, '資本金'));
  const legalReserve = truncK(get(raw.bs.equity, '利益準備金'));
  const otherRetainedEarnings = truncK(
    get(raw.bs.equity, '積立金', 'その他利益剰余金積立金')
  );
  const specialReserve = truncK(get(raw.bs.equity, '別途積立金'));
  const treasuryStock = truncK(get(raw.bs.equity, '自己株式'));
  const securitiesValuation = truncK(
    get(raw.bs.equity, 'その他有価証券評価差額金')
  );

  // 利益剰余金合計（資本金・自己株式・評価差額を除く純資産の部分）
  const retainedEarningsTotal =
    totalEquity -
    capitalStock -
    treasuryStock -
    securitiesValuation;

  // 繰越利益剰余金は残差で算出
  const retainedEarningsCF =
    retainedEarningsTotal - legalReserve - otherRetainedEarnings - specialReserve;

  const shareholdersEquityTotal =
    capitalStock + retainedEarningsTotal + treasuryStock;
  const evaluationTotal = securitiesValuation;

  const totalLiabilitiesEquity = totalLiabilities + totalEquity;

  return {
    cashDeposits,
    notesReceivable,
    accountsReceivableConstruction,
    securities,
    wipConstruction,
    materialInventory,
    shortTermLoans,
    prepaidExpenses,
    deferredTaxAssetCurrent,
    otherCurrent,
    allowanceDoubtful,
    currentAssetsTotal,
    buildingsStructures,
    machineryVehicles,
    toolsEquipment,
    land,
    tangibleFixedTotal,
    patent,
    otherIntangible,
    intangibleFixedTotal,
    relatedCompanyShares,
    longTermLoans,
    insuranceReserve,
    longTermPrepaid,
    deferredTaxAssetFixed,
    otherInvestments,
    investmentsTotal,
    fixedAssetsTotal,
    deferredAssetsTotal,
    totalAssets,
    notesPayable,
    constructionPayable,
    shortTermBorrowing,
    leaseDebt,
    accountsPayable,
    unpaidExpenses,
    unpaidCorporateTax,
    deferredTaxLiability,
    advanceReceivedConstruction,
    depositsReceived,
    advanceRevenue,
    provisions,
    unpaidConsumptionTax,
    currentLiabilitiesTotal,
    longTermBorrowing,
    fixedLiabilitiesTotal,
    totalLiabilities,
    capitalStock,
    legalReserve,
    otherRetainedEarnings,
    specialReserve,
    retainedEarningsCF,
    retainedEarningsTotal,
    treasuryStock,
    shareholdersEquityTotal,
    securitiesValuation,
    evaluationTotal,
    totalEquity,
    totalLiabilitiesEquity,
  };
}
