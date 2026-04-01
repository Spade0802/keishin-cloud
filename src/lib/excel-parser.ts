/**
 * Excel決算書パーサー
 *
 * 決算書のExcelファイルからBS/PL/原価報告書の数値を自動抽出する。
 * 対応フォーマット: 一般的な中小建設会社の決算書Excel
 */

import * as XLSX from 'xlsx';
import type { RawFinancialData } from './engine/types';

interface ParseResult {
  data: Partial<RawFinancialData>;
  warnings: string[];
  mappings: { source: string; target: string; value: number }[];
}

// BS科目マッピング（決算書の科目名 → 内部区分 + 科目名）
const BS_CURRENT_ASSETS_KEYWORDS: Record<string, string> = {
  '現金': '現金',
  '小口現金': '小口現金',
  '当座預金': '当座預金',
  '普通預金': '普通預金',
  '定期預金': '定期預金',
  '積立定期預金': '積立定期預金',
  '現金及び預金': '現金及び預金',
  '受取手形': '受取手形',
  '完成工事未収入金': '完成工事未収入金',
  '有価証券': '有価証券',
  '未成工事支出金': '未成工事支出金',
  '材料貯蔵品': '材料貯蔵品',
  '短期貸付金': '短期貸付金',
  '前払費用': '前払費用',
  '繰延税金資産': '繰延税金資産',
  '貸倒引当金': '貸倒引当金',
};

const BS_TANGIBLE_FIXED_KEYWORDS: Record<string, string> = {
  '建物': '建物',
  '構築物': '構築物',
  '建物付属設備': '建物付属設備',
  '機械装置': '機械装置',
  '車両運搬具': '車両運搬具',
  '土地': '土地',
  '工具器具備品': '工具器具備品',
};

const BS_CURRENT_LIABILITIES_KEYWORDS: Record<string, string> = {
  '支払手形': '支払手形',
  '工事未払金': '工事未払金',
  '未払外注費': '未払外注費',
  '短期借入金': '短期借入金',
  'リース債務': 'リース債務',
  '買掛金': '買掛金',
  '未払金': '未払金',
  '未払給与': '未払給与',
  '未払経費': '未払経費',
  '未払法人税等': '未払法人税等',
  '未成工事受入金': '未成工事受入金',
  '預り金': '預り金',
  '未払消費税等': '未払消費税等',
};

/**
 * Excelファイルのバイナリから決算書データを抽出
 */
export function parseExcel(buffer: ArrayBuffer): ParseResult {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const warnings: string[] = [];
  const mappings: { source: string; target: string; value: number }[] = [];

  const data: Partial<RawFinancialData> = {
    bs: {
      currentAssets: {},
      tangibleFixed: {},
      intangibleFixed: {},
      investments: {},
      currentLiabilities: {},
      fixedLiabilities: {},
      equity: {},
      totals: {
        currentAssets: 0,
        tangibleFixed: 0,
        intangibleFixed: 0,
        investments: 0,
        fixedAssets: 0,
        totalAssets: 0,
        currentLiabilities: 0,
        fixedLiabilities: 0,
        totalLiabilities: 0,
        totalEquity: 0,
      },
    },
    pl: {
      completedConstruction: 0,
      progressConstruction: 0,
      totalSales: 0,
      costOfSales: 0,
      grossProfit: 0,
      sgaItems: {},
      sgaTotal: 0,
      operatingProfit: 0,
      interestIncome: 0,
      dividendIncome: 0,
      miscIncome: 0,
      interestExpense: 0,
      miscExpense: 0,
      ordinaryProfit: 0,
      specialGain: 0,
      specialLoss: 0,
      preTaxProfit: 0,
      corporateTax: 0,
      netIncome: 0,
    },
    manufacturing: {
      materials: 0,
      labor: 0,
      expenses: 0,
      subcontract: 0,
      mfgDepreciation: 0,
      wipBeginning: 0,
      wipEnding: 0,
      totalCost: 0,
    },
    sga: {
      sgaDepreciation: 0,
    },
  };

  // 各シートを走査
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: '',
    }) as unknown as unknown[][];

    const nameLower = sheetName.toLowerCase();

    if (
      nameLower.includes('bs') ||
      nameLower.includes('貸借') ||
      nameLower.includes('バランス')
    ) {
      parseBS(rows, data, mappings, warnings);
    } else if (
      nameLower.includes('pl') ||
      nameLower.includes('損益') ||
      nameLower.includes('プロフィット')
    ) {
      parsePL(rows, data, mappings, warnings);
    } else if (
      nameLower.includes('原価') ||
      nameLower.includes('製造') ||
      nameLower.includes('工事原価')
    ) {
      parseManufacturing(rows, data, mappings, warnings);
    } else {
      // シート名で判別できない場合、内容から推測
      const content = rows
        .slice(0, 10)
        .flat()
        .filter((c) => typeof c === 'string')
        .join(' ');
      if (content.includes('流動資産') || content.includes('固定資産')) {
        parseBS(rows, data, mappings, warnings);
      } else if (
        content.includes('売上') ||
        content.includes('完成工事高')
      ) {
        parsePL(rows, data, mappings, warnings);
      }
    }
  }

  if (mappings.length === 0) {
    warnings.push(
      'データを自動認識できませんでした。シート名に「BS」「PL」「原価」を含めると認識精度が向上します。'
    );
  }

  return { data, warnings, mappings };
}

function parseBS(
  rows: unknown[][],
  data: Partial<RawFinancialData>,
  mappings: { source: string; target: string; value: number }[],
  warnings: string[]
) {
  if (!data.bs) return;

  for (const row of rows) {
    if (!row || row.length < 2) continue;

    const label = String(row[0] ?? '').trim();
    const valueCell = row.find(
      (cell, i) => i > 0 && typeof cell === 'number' && cell !== 0
    );
    if (!label || valueCell === undefined) continue;
    const value = Number(valueCell);

    // 流動資産科目
    if (BS_CURRENT_ASSETS_KEYWORDS[label]) {
      data.bs.currentAssets[BS_CURRENT_ASSETS_KEYWORDS[label]] = value;
      mappings.push({ source: label, target: `流動資産/${label}`, value });
    }
    // 有形固定資産科目
    else if (BS_TANGIBLE_FIXED_KEYWORDS[label]) {
      data.bs.tangibleFixed[BS_TANGIBLE_FIXED_KEYWORDS[label]] = value;
      mappings.push({ source: label, target: `有形固定資産/${label}`, value });
    }
    // 流動負債科目
    else if (BS_CURRENT_LIABILITIES_KEYWORDS[label]) {
      data.bs.currentLiabilities[BS_CURRENT_LIABILITIES_KEYWORDS[label]] =
        value;
      mappings.push({ source: label, target: `流動負債/${label}`, value });
    }
    // 合計行
    else if (label.includes('流動資産合計')) {
      data.bs.totals.currentAssets = value;
    } else if (label.includes('有形固定資産合計')) {
      data.bs.totals.tangibleFixed = value;
    } else if (label.includes('無形固定資産合計')) {
      data.bs.totals.intangibleFixed = value;
    } else if (label.includes('投資その他') && label.includes('合計')) {
      data.bs.totals.investments = value;
    } else if (label === '固定資産合計') {
      data.bs.totals.fixedAssets = value;
    } else if (label === '資産合計' || label === '資産の部合計') {
      data.bs.totals.totalAssets = value;
    } else if (label.includes('流動負債合計')) {
      data.bs.totals.currentLiabilities = value;
    } else if (label.includes('固定負債合計')) {
      data.bs.totals.fixedLiabilities = value;
    } else if (label === '負債合計' || label === '負債の部合計') {
      data.bs.totals.totalLiabilities = value;
    } else if (label === '純資産合計' || label === '純資産の部合計') {
      data.bs.totals.totalEquity = value;
    }
    // 純資産科目
    else if (label === '資本金') {
      data.bs.equity['資本金'] = value;
      mappings.push({ source: label, target: `純資産/${label}`, value });
    } else if (label === '利益準備金') {
      data.bs.equity['利益準備金'] = value;
      mappings.push({ source: label, target: `純資産/${label}`, value });
    } else if (label === '別途積立金') {
      data.bs.equity['別途積立金'] = value;
      mappings.push({ source: label, target: `純資産/${label}`, value });
    } else if (label.includes('繰越利益')) {
      data.bs.equity['繰越利益剰余金'] = value;
      mappings.push({ source: label, target: '純資産/繰越利益剰余金', value });
    } else if (label === '自己株式') {
      data.bs.equity['自己株式'] = value;
      mappings.push({ source: label, target: `純資産/${label}`, value });
    }
    // 固定負債
    else if (label === '長期借入金') {
      data.bs.fixedLiabilities['長期借入金'] = value;
      mappings.push({ source: label, target: `固定負債/${label}`, value });
    }
    // 投資
    else if (label.includes('保険積立金') || label.includes('生命保険')) {
      data.bs.investments['保険積立金'] = value;
      mappings.push({ source: label, target: '投資/保険積立金', value });
    } else if (label === '長期前払費用') {
      data.bs.investments['長期前払費用'] = value;
      mappings.push({ source: label, target: `投資/${label}`, value });
    }
  }
}

function parsePL(
  rows: unknown[][],
  data: Partial<RawFinancialData>,
  mappings: { source: string; target: string; value: number }[],
  _warnings: string[]
) {
  if (!data.pl) return;

  for (const row of rows) {
    if (!row || row.length < 2) continue;

    const label = String(row[0] ?? '').trim();
    const valueCell = row.find(
      (cell, i) => i > 0 && typeof cell === 'number'
    );
    if (!label || valueCell === undefined) continue;
    const value = Number(valueCell);

    if (label === '完成工事高') {
      data.pl.completedConstruction = value;
      mappings.push({ source: label, target: 'PL/完成工事高', value });
    } else if (label.includes('出来高')) {
      data.pl.progressConstruction = value;
      mappings.push({ source: label, target: 'PL/出来高工事高', value });
    } else if (label === '売上高' || label === '売上高合計') {
      data.pl.totalSales = value;
    } else if (label.includes('完成工事原価')) {
      data.pl.costOfSales = value;
    } else if (label === '売上総利益') {
      data.pl.grossProfit = value;
    } else if (label.includes('販売費及び一般管理費') && label.includes('合計')) {
      data.pl.sgaTotal = value;
    } else if (label === '営業利益') {
      data.pl.operatingProfit = value;
    } else if (label === '受取利息') {
      data.pl.interestIncome = value;
      mappings.push({ source: label, target: 'PL/受取利息', value });
    } else if (label === '受取配当金') {
      data.pl.dividendIncome = value;
      mappings.push({ source: label, target: 'PL/受取配当金', value });
    } else if (label.includes('支払利息')) {
      data.pl.interestExpense = value;
      mappings.push({ source: label, target: 'PL/支払利息', value });
    } else if (label === '経常利益') {
      data.pl.ordinaryProfit = value;
    } else if (label.includes('特別利益')) {
      data.pl.specialGain = value;
    } else if (label.includes('特別損失')) {
      data.pl.specialLoss = value;
    } else if (label.includes('法人税') && !label.includes('未払')) {
      data.pl.corporateTax = value;
    } else if (label.includes('当期純利益')) {
      data.pl.netIncome = value;
    }
  }
}

function parseManufacturing(
  rows: unknown[][],
  data: Partial<RawFinancialData>,
  mappings: { source: string; target: string; value: number }[],
  _warnings: string[]
) {
  if (!data.manufacturing) return;

  for (const row of rows) {
    if (!row || row.length < 2) continue;

    const label = String(row[0] ?? '').trim();
    const valueCell = row.find(
      (cell, i) => i > 0 && typeof cell === 'number'
    );
    if (!label || valueCell === undefined) continue;
    const value = Number(valueCell);

    if (label === '材料費') {
      data.manufacturing.materials = value;
      mappings.push({ source: label, target: '原価/材料費', value });
    } else if (label === '労務費') {
      data.manufacturing.labor = value;
      mappings.push({ source: label, target: '原価/労務費', value });
    } else if (label === '外注費') {
      data.manufacturing.subcontract = value;
      mappings.push({ source: label, target: '原価/外注費', value });
    } else if (label === '経費' || label === '製造経費') {
      data.manufacturing.expenses = value;
      mappings.push({ source: label, target: '原価/経費', value });
    } else if (label.includes('減価償却費')) {
      data.manufacturing.mfgDepreciation = value;
      mappings.push({ source: label, target: '原価/減価償却費', value });
    } else if (label.includes('期首未成工事支出金')) {
      data.manufacturing.wipBeginning = value;
    } else if (label.includes('期末未成工事支出金')) {
      data.manufacturing.wipEnding = value;
    } else if (label.includes('完成工事原価') || label === '当期製造原価') {
      data.manufacturing.totalCost = value;
    }
  }
}

/**
 * Excelアップロード用のAPI Route handler向けヘルパー
 */
export function parseExcelFromBase64(base64: string): ParseResult {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return parseExcel(bytes.buffer);
}
