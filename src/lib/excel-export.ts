/**
 * Excel出力モジュール
 *
 * 経審シミュレーション結果をExcelワークブックとして生成する。
 * xlsxパッケージを使用。
 */

import * as XLSX from 'xlsx';

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

// --- 公開関数 ---

/**
 * P点サマリーExcelを生成
 *
 * Sheet 1: P点サマリー（業種別テーブル + 共通スコア + 算式）
 * Sheet 2: Y点詳細（8指標 + A値 + Y値 + 営業CF）
 * Sheet 3: 営業CF明細（ウォーターフォール内訳）
 */
export function generatePScoreExcel(data: PScoreData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  const summarySheet = buildPScoreSummarySheet(data);
  XLSX.utils.book_append_sheet(wb, summarySheet, 'P点サマリー');

  const yDetailSheet = buildYScoreDetailSheet(data.yResult);
  XLSX.utils.book_append_sheet(wb, yDetailSheet, 'Y点詳細');

  const cfSheet = buildOperatingCFSheet(data.yResult);
  XLSX.utils.book_append_sheet(wb, cfSheet, '営業CF明細');

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
