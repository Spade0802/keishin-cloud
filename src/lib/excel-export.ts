/**
 * Excel出力モジュール
 *
 * 経審シミュレーション結果をExcelワークブックとして生成する。
 * xlsxパッケージを使用。
 */

import * as XLSX from 'xlsx';
import type { KeishinBS, KeishinPL } from '@/lib/engine/types';

// --- 型定義 ---

interface IndustryRow {
  name: string;
  X1: number;
  Z: number;
  Z1: number;
  Z2: number;
  P: number;
}

interface YResultData {
  indicators: Record<string, number>;
  indicatorsRaw: Record<string, number>;
  A: number;
  Y: number;
  operatingCF: number;
  operatingCFDetail: Record<string, number>;
}

interface PScoreData {
  companyName?: string;
  period?: string;
  industries: IndustryRow[];
  Y: number;
  X2: number;
  X21: number;
  X22: number;
  W: number;
  wTotal: number;
  yResult: YResultData;
  bs?: KeishinBS;
  pl?: KeishinPL;
}

// --- 指標名マッピング ---

const INDICATOR_LABELS: Record<string, string> = {
  x1: '純支払利息比率',
  x2: '負債回転期間',
  x3: '総資本売上総利益率',
  x4: '売上高経常利益率',
  x5: '自己資本対固定資産比率',
  x6: '自己資本比率',
  x7: '営業キャッシュフロー(絶対額)',
  x8: '利益剰余金(絶対額)',
};

const INDICATOR_UNITS: Record<string, string> = {
  x1: '%',
  x2: 'ヶ月',
  x3: '%',
  x4: '%',
  x5: '%',
  x6: '%',
  x7: '億円',
  x8: '億円',
};

const CF_DETAIL_LABELS: Record<string, string> = {
  ordinaryProfit: '経常利益',
  depreciation: '減価償却実施額',
  corporateTax: '法人税等',
  allowanceChange: '貸倒引当金増減',
  receivableChange: '売掛債権増減',
  payableChange: '仕入債務増減',
  inventoryChange: '棚卸資産増減',
  advanceChange: '前受金増減',
};

// --- ユーティリティ ---

function setColWidths(ws: XLSX.WorkSheet, widths: number[]) {
  ws['!cols'] = widths.map((wch) => ({ wch }));
}

function ratingForIndicator(key: string, value: number): string {
  // 簡易評価: x1/x2 は低いほど良い、他は高いほど良い
  const lowerIsBetter = key === 'x1' || key === 'x2';
  if (lowerIsBetter) {
    if (value <= 1) return 'A';
    if (value <= 3) return 'B';
    return 'C';
  }
  // x7, x8 は絶対額（億円）
  if (key === 'x7' || key === 'x8') {
    if (value >= 5) return 'A';
    if (value >= 0) return 'B';
    return 'C';
  }
  // %系指標
  if (value >= 30) return 'A';
  if (value >= 10) return 'B';
  return 'C';
}

// --- P点サマリーシート ---

function buildPScoreSummarySheet(data: PScoreData): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  // ヘッダー情報
  if (data.companyName) {
    rows.push(['会社名', data.companyName]);
  }
  if (data.period) {
    rows.push(['決算期', data.period]);
  }
  rows.push([]);

  // 算式説明
  rows.push(['P = 0.25*X1 + 0.15*X2 + 0.20*Y + 0.25*Z + 0.15*W']);
  rows.push([]);

  // 共通スコア
  rows.push([
    '共通スコア',
    `Y=${data.Y}`,
    `X2=${data.X2} (X21=${data.X21}/X22=${data.X22})`,
    `W=${data.W}`,
  ]);
  rows.push([]);

  // 業種別テーブルヘッダー
  rows.push(['業種', 'X1', 'X2', 'Y', 'Z', 'W', 'P']);

  // 業種別データ行
  for (const ind of data.industries) {
    rows.push([ind.name, ind.X1, data.X2, data.Y, ind.Z, data.W, ind.P]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [20, 10, 10, 10, 10, 10, 10]);
  return ws;
}

// --- Y点詳細シート ---

function buildYScoreDetailSheet(yResult: YResultData): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push(['Y点詳細']);
  rows.push([]);

  // 8指標テーブル
  rows.push(['指標', '算出値', '制限後', '単位', '評価']);

  const indicatorKeys = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'];
  for (const key of indicatorKeys) {
    const rawVal = yResult.indicatorsRaw[key] ?? 0;
    const clampedVal = yResult.indicators[key] ?? 0;
    const label = INDICATOR_LABELS[key] ?? key;
    const unit = INDICATOR_UNITS[key] ?? '';
    const rating = ratingForIndicator(key, clampedVal);

    rows.push([
      label,
      Math.round(rawVal * 1000) / 1000,
      Math.round(clampedVal * 1000) / 1000,
      unit,
      rating,
    ]);
  }

  rows.push([]);
  rows.push(['A値', Math.round(yResult.A * 10000) / 10000]);
  rows.push(['Y点', yResult.Y]);
  rows.push([]);

  // 営業CF概要
  rows.push(['営業キャッシュフロー', yResult.operatingCF]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [30, 14, 14, 10, 8]);
  return ws;
}

// --- 営業CF明細シート ---

function buildOperatingCFSheet(yResult: YResultData): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push(['営業キャッシュフロー明細']);
  rows.push([]);
  rows.push(['項目', '金額（千円）', '加減']);

  const detail = yResult.operatingCFDetail;
  const detailKeys = [
    'ordinaryProfit',
    'depreciation',
    'corporateTax',
    'allowanceChange',
    'receivableChange',
    'payableChange',
    'inventoryChange',
    'advanceChange',
  ];

  // 加減の方向を示す
  const signLabels: Record<string, string> = {
    ordinaryProfit: '+',
    depreciation: '+',
    corporateTax: '-',
    allowanceChange: '+',
    receivableChange: '-',
    payableChange: '+',
    inventoryChange: '-',
    advanceChange: '+',
  };

  for (const key of detailKeys) {
    const value = detail[key] ?? 0;
    const label = CF_DETAIL_LABELS[key] ?? key;
    const sign = signLabels[key] ?? '';
    rows.push([label, value, sign]);
  }

  rows.push([]);
  rows.push(['営業CF合計', yResult.operatingCF, '']);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [28, 16, 8]);
  return ws;
}

// --- BSシート ---

function buildBSSheet(bs: KeishinBS): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push(['経審用貸借対照表（様式第十五号）']);
  rows.push(['単位：千円']);
  rows.push([]);

  rows.push(['【資産の部】', '金額', '', '【負債・純資産の部】', '金額']);
  rows.push([]);

  // Assets
  const assetRows: (string | number)[][] = [
    ['＜流動資産＞', 0],
    ['  現金預金', bs.cashDeposits],
    ['  受取手形', bs.notesReceivable],
    ['  完成工事未収入金', bs.accountsReceivableConstruction],
    ['  有価証券', bs.securities],
    ['  未成工事支出金', bs.wipConstruction],
    ['  材料貯蔵品', bs.materialInventory],
    ['  短期貸付金', bs.shortTermLoans],
    ['  前払費用', bs.prepaidExpenses],
    ['  繰延税金資産(流動)', bs.deferredTaxAssetCurrent],
    ['  その他', bs.otherCurrent],
    ['  貸倒引当金', bs.allowanceDoubtful],
    ['流動資産合計', bs.currentAssetsTotal],
    [''],
    ['＜有形固定資産＞', 0],
    ['  建物・構築物', bs.buildingsStructures],
    ['  機械・運搬具', bs.machineryVehicles],
    ['  工具器具・備品', bs.toolsEquipment],
    ['  土地', bs.land],
    ['有形固定資産合計', bs.tangibleFixedTotal],
    [''],
    ['＜無形固定資産＞', 0],
    ['  特許権', bs.patent],
    ['  その他', bs.otherIntangible],
    ['無形固定資産合計', bs.intangibleFixedTotal],
    [''],
    ['＜投資その他の資産＞', 0],
    ['  関係会社株式', bs.relatedCompanyShares],
    ['  長期貸付金', bs.longTermLoans],
    ['  保険積立金', bs.insuranceReserve],
    ['  長期前払費用', bs.longTermPrepaid],
    ['  繰延税金資産(固定)', bs.deferredTaxAssetFixed],
    ['  その他', bs.otherInvestments],
    ['投資その他合計', bs.investmentsTotal],
    [''],
    ['固定資産合計', bs.fixedAssetsTotal],
    ['繰延資産合計', bs.deferredAssetsTotal],
    ['資産合計', bs.totalAssets],
  ];

  // Liabilities + Equity
  const liabRows: (string | number)[][] = [
    ['＜流動負債＞', 0],
    ['  支払手形', bs.notesPayable],
    ['  工事未払金', bs.constructionPayable],
    ['  短期借入金', bs.shortTermBorrowing],
    ['  リース債務', bs.leaseDebt],
    ['  未払金', bs.accountsPayable],
    ['  未払費用', bs.unpaidExpenses],
    ['  未払法人税等', bs.unpaidCorporateTax],
    ['  繰延税金負債', bs.deferredTaxLiability],
    ['  未成工事受入金', bs.advanceReceivedConstruction],
    ['  預り金', bs.depositsReceived],
    ['  前受収益', bs.advanceRevenue],
    ['  引当金', bs.provisions],
    ['  未払消費税等', bs.unpaidConsumptionTax],
    ['流動負債合計', bs.currentLiabilitiesTotal],
    [''],
    ['＜固定負債＞', 0],
    ['  長期借入金', bs.longTermBorrowing],
    ['固定負債合計', bs.fixedLiabilitiesTotal],
    ['負債合計', bs.totalLiabilities],
    [''],
    ['＜純資産の部＞', 0],
    ['  資本金', bs.capitalStock],
    ['  利益準備金', bs.legalReserve],
    ['  その他利益剰余金', bs.otherRetainedEarnings],
    ['    別途積立金', bs.specialReserve],
    ['    繰越利益剰余金', bs.retainedEarningsCF],
    ['  利益剰余金合計', bs.retainedEarningsTotal],
    ['  自己株式', bs.treasuryStock],
    ['株主資本合計', bs.shareholdersEquityTotal],
    ['  有価証券評価差額金', bs.securitiesValuation],
    ['評価差額等合計', bs.evaluationTotal],
    ['純資産合計', bs.totalEquity],
    ['負債・純資産合計', bs.totalLiabilitiesEquity],
  ];

  const maxLen = Math.max(assetRows.length, liabRows.length);
  for (let i = 0; i < maxLen; i++) {
    const a = assetRows[i];
    const l = liabRows[i];
    const row: (string | number)[] = [];

    if (a && a.length > 1) {
      const label = a[0] as string;
      row.push(label, label.startsWith('＜') ? '' : a[1]);
    } else {
      row.push('', '');
    }
    row.push(''); // spacer
    if (l && l.length > 1) {
      const label = l[0] as string;
      row.push(label, label.startsWith('＜') ? '' : l[1]);
    } else {
      row.push('', '');
    }
    rows.push(row);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [28, 14, 4, 28, 14]);
  return ws;
}

// --- PLシート ---

function buildPLSheet(pl: KeishinPL): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push(['経審用損益計算書（様式第十六号）']);
  rows.push(['単位：千円']);
  rows.push([]);

  rows.push(['科目', '金額']);
  rows.push([]);

  const plRows: (string | number | boolean)[][] = [
    ['完成工事高', pl.completedConstructionRevenue],
    ['兼業事業売上高', pl.sideBusiness],
    ['売上高合計', pl.totalSales, true],
    [''],
    ['完成工事原価', pl.completedConstructionCost],
    ['兼業事業売上原価', pl.sideBusinessCost],
    ['売上総利益', pl.grossProfit, true],
    [''],
    ['販売費及び一般管理費', pl.sgaTotal],
    ['営業利益', pl.operatingProfit, true],
    [''],
    ['＜営業外収益＞', 0],
    ['  受取利息配当金', pl.interestDividendIncome],
    ['  その他', pl.otherNonOpIncome],
    ['営業外収益合計', pl.nonOpIncomeTotal, true],
    [''],
    ['＜営業外費用＞', 0],
    ['  支払利息', pl.interestExpense],
    ['  その他', pl.otherNonOpExpense],
    ['営業外費用合計', pl.nonOpExpenseTotal, true],
    [''],
    ['経常利益', pl.ordinaryProfit, true],
    [''],
    ['特別利益', pl.specialGain],
    ['特別損失', pl.specialLoss],
    ['税引前当期純利益', pl.preTaxProfit, true],
    [''],
    ['法人税、住民税及び事業税', pl.corporateTax],
    ['法人税等調整額', pl.taxAdjustment],
    ['当期純利益', pl.netIncome, true],
  ];

  for (const item of plRows) {
    if (item[0] === '') {
      rows.push([]);
    } else if ((item[0] as string).startsWith('＜')) {
      rows.push([item[0] as string, '']);
    } else {
      rows.push([item[0] as string, item[1] as number]);
    }
  }

  rows.push([]);
  rows.push(['【完成工事原価報告書】', '']);
  rows.push(['科目', '金額']);
  rows.push(['材料費', pl.costReport.materials]);
  rows.push(['労務費', pl.costReport.labor]);
  rows.push(['（うち労務外注費）', pl.costReport.laborSubcontract]);
  rows.push(['外注費', pl.costReport.subcontract]);
  rows.push(['経費', pl.costReport.expenses]);
  rows.push(['（うち人件費）', pl.costReport.personnelInExpenses]);
  rows.push(['完成工事原価合計', pl.costReport.totalCost]);
  rows.push([]);
  rows.push(['減価償却実施額', pl.depreciation]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [30, 14]);
  return ws;
}

// --- 公開関数 ---

/**
 * P点サマリーExcelを生成
 *
 * Sheet 1: P点サマリー（業種別テーブル + 共通スコア + 算式）
 * Sheet 2: Y点詳細（8指標 + A値 + Y値 + 営業CF）
 * Sheet 3: 営業CF明細（ウォーターフォール内訳）
 * Sheet 4: 貸借対照表（BSデータがある場合）
 * Sheet 5: 損益計算書（PLデータがある場合）
 */
export function generatePScoreExcel(data: PScoreData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const summarySheet = buildPScoreSummarySheet(data);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'P点サマリー');

  const yDetailSheet = buildYScoreDetailSheet(data.yResult);
  XLSX.utils.book_append_sheet(wb, yDetailSheet, 'Y点詳細');

  const cfSheet = buildOperatingCFSheet(data.yResult);
  XLSX.utils.book_append_sheet(wb, cfSheet, '営業CF明細');

  if (data.bs) {
    const bsSheet = buildBSSheet(data.bs);
    XLSX.utils.book_append_sheet(wb, bsSheet, '貸借対照表');
  }

  if (data.pl) {
    const plSheet = buildPLSheet(data.pl);
    XLSX.utils.book_append_sheet(wb, plSheet, '損益計算書');
  }

  return wb;
}

/**
 * Y点詳細Excelを生成
 *
 * 単一シートでY点の指標詳細を出力する。
 */
export function generateYScoreExcel(yResult: YResultData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const rows: (string | number)[][] = [];

  rows.push(['Y点詳細レポート']);
  rows.push([]);

  // 8指標テーブル
  rows.push(['指標', '算出値', '制限後', '単位', '評価']);

  const indicatorKeys = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'];
  for (const key of indicatorKeys) {
    const rawVal = yResult.indicatorsRaw[key] ?? 0;
    const clampedVal = yResult.indicators[key] ?? 0;
    const label = INDICATOR_LABELS[key] ?? key;
    const unit = INDICATOR_UNITS[key] ?? '';
    const rating = ratingForIndicator(key, clampedVal);

    rows.push([
      label,
      Math.round(rawVal * 1000) / 1000,
      Math.round(clampedVal * 1000) / 1000,
      unit,
      rating,
    ]);
  }

  rows.push([]);
  rows.push(['A値', Math.round(yResult.A * 10000) / 10000]);
  rows.push(['Y点', yResult.Y]);
  rows.push([]);

  // 営業CF
  rows.push(['営業キャッシュフロー', yResult.operatingCF]);
  rows.push([]);

  // CF内訳
  rows.push(['--- 営業CF内訳 ---']);
  rows.push(['項目', '金額（千円）']);

  const detail = yResult.operatingCFDetail;
  const detailKeys = [
    'ordinaryProfit',
    'depreciation',
    'corporateTax',
    'allowanceChange',
    'receivableChange',
    'payableChange',
    'inventoryChange',
    'advanceChange',
  ];

  for (const key of detailKeys) {
    const value = detail[key] ?? 0;
    const label = CF_DETAIL_LABELS[key] ?? key;
    rows.push([label, value]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [30, 14, 14, 10, 8]);
  XLSX.utils.book_append_sheet(wb, ws, 'Y点詳細');

  return wb;
}
