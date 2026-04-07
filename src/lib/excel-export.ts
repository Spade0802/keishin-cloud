/**
 * Excel出力モジュール
 *
 * 経審シミュレーション結果を10シートのExcelワークブックとして生成する。
 * xlsxパッケージ（SheetJS）を使用。
 *
 * シート構成:
 *  1. 表紙           - 会社情報・審査基準日
 *  2. 貸借対照表      - 様式第十五号
 *  3. 損益計算書      - 様式第十六号 + 完成工事原価報告書
 *  4. Y点試算        - 8指標 + 営業CF
 *  5. 工事種類別完工高 - 業種別完成工事高・X1
 *  6. 技術職員一覧    - 資格・業種別
 *  7. 社会性等W      - W1-W8 明細
 *  8. P点試算        - 業種別P点
 *  9. 前期比較       - 前期 vs 当期
 * 10. 改善提案       - P点改善インパクト順
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

export interface TechStaffRow {
  index: number;
  name?: string;
  industryCode1: number;
  qualCode1: number;
  lectureFlag1: number;
  industryCode2?: number;
  qualCode2?: number;
  lectureFlag2?: number;
  supervisorCert?: string;
}

export interface SocialItemsData {
  w1Items: Record<string, boolean | number>;
  w1: number;
  w2: number;
  w3: number;
  w4: number;
  w5: number;
  w6: number;
  w7: number;
  w8: number;
  total: number;
}

export interface PrevResultData {
  Y: number;
  X2: number;
  W: number;
  industries: Array<{ name: string; P: number; X1: number; Z: number }>;
}

export interface PScoreData {
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
  // Feature 3 追加フィールド
  techStaff?: TechStaffRow[];
  socialItems?: SocialItemsData;
  prevResult?: PrevResultData;
  reviewBaseDate?: string;
  permitNumber?: string;
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

/** Y指標の上限・下限テーブル */
const INDICATOR_BOUNDS: Record<string, { upper: number; lower: number }> = {
  x1: { upper: 5.1, lower: -0.3 },
  x2: { upper: 18.0, lower: 0.9 },
  x3: { upper: 63.6, lower: 6.5 },
  x4: { upper: 8.5, lower: -8.5 },
  x5: { upper: 350.0, lower: -76.5 },
  x6: { upper: 68.5, lower: -68.6 },
  x7: { upper: 15.0, lower: -10.0 },
  x8: { upper: 100.0, lower: -3.0 },
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
  const lowerIsBetter = key === 'x1' || key === 'x2';
  if (lowerIsBetter) {
    if (value <= 1) return 'A';
    if (value <= 3) return 'B';
    return 'C';
  }
  if (key === 'x7' || key === 'x8') {
    if (value >= 5) return 'A';
    if (value >= 0) return 'B';
    return 'C';
  }
  if (value >= 30) return 'A';
  if (value >= 10) return 'B';
  return 'C';
}

function formatDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}/${m}/${day}`;
}

// --- Sheet 1: 表紙 ---

function buildCoverSheet(data: PScoreData): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push([]);
  rows.push(['', '経営事項審査 試算結果']);
  rows.push([]);
  rows.push(['', '試算版']);
  rows.push([]);
  rows.push(['会社名', data.companyName ?? '']);
  rows.push(['許可番号', data.permitNumber ?? '']);
  rows.push(['審査基準日', data.reviewBaseDate ?? '']);
  rows.push(['決算期', data.period ?? '']);
  rows.push([]);
  rows.push(['出力日', formatDate(new Date())]);
  rows.push([]);
  rows.push(['業種数', data.industries.length]);
  rows.push([]);

  // 主要スコアサマリー
  rows.push(['--- 主要スコア ---']);
  rows.push(['Y点', data.Y]);
  rows.push(['X2点', data.X2]);
  rows.push(['W点', data.W]);
  rows.push([]);

  if (data.industries.length > 0) {
    rows.push(['業種', 'P点']);
    for (const ind of data.industries) {
      rows.push([ind.name, ind.P]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [20, 30]);
  return ws;
}

// --- Sheet 2: BSシート ---

function buildBSSheet(bs: KeishinBS): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push(['経審用貸借対照表（様式第十五号）']);
  rows.push(['単位：千円']);
  rows.push([]);

  rows.push(['【資産の部】', '金額', '', '【負債・純資産の部】', '金額']);
  rows.push([]);

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

// --- Sheet 3: PLシート ---

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

// --- Sheet 4: Y点試算シート ---

function buildYScoreSheet(yResult: YResultData): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push(['Y点試算']);
  rows.push([]);

  // 8指標テーブル
  rows.push(['指標', '算出値', '制限後', '単位', '上限', '下限', '評価']);

  const indicatorKeys = ['x1', 'x2', 'x3', 'x4', 'x5', 'x6', 'x7', 'x8'];
  for (const key of indicatorKeys) {
    const rawVal = yResult.indicatorsRaw[key] ?? 0;
    const clampedVal = yResult.indicators[key] ?? 0;
    const label = INDICATOR_LABELS[key] ?? key;
    const unit = INDICATOR_UNITS[key] ?? '';
    const bounds = INDICATOR_BOUNDS[key];
    const rating = ratingForIndicator(key, clampedVal);

    rows.push([
      label,
      Math.round(rawVal * 1000) / 1000,
      Math.round(clampedVal * 1000) / 1000,
      unit,
      bounds?.upper ?? 0,
      bounds?.lower ?? 0,
      rating,
    ]);
  }

  rows.push([]);
  rows.push(['A値', Math.round(yResult.A * 10000) / 10000]);
  rows.push(['Y点', yResult.Y]);
  rows.push([]);

  // 営業CF セクション
  rows.push(['--- 営業キャッシュフロー ---']);
  rows.push(['営業CF合計', yResult.operatingCF]);
  rows.push([]);
  rows.push(['項目', '金額（千円）', '加減']);

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
    const value = yResult.operatingCFDetail[key] ?? 0;
    const label = CF_DETAIL_LABELS[key] ?? key;
    const sign = signLabels[key] ?? '';
    rows.push([label, value, sign]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [30, 14, 14, 10, 10, 10, 8]);
  return ws;
}

// --- Sheet 5: 工事種類別完成工事高 ---

function buildIndustryCompletionSheet(data: PScoreData): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push(['工事種類別完成工事高']);
  rows.push(['単位：千円']);
  rows.push([]);

  rows.push([
    '業種',
    'Z1（技術職員）',
    'Z2（完工高）',
    'Z点',
    'X1点',
    'P点',
  ]);

  for (const ind of data.industries) {
    rows.push([ind.name, ind.Z1, ind.Z2, ind.Z, ind.X1, ind.P]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [20, 16, 16, 10, 10, 10]);
  return ws;
}

// --- Sheet 6: 技術職員一覧 ---

function buildTechStaffSheet(techStaff: TechStaffRow[]): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push(['技術職員一覧']);
  rows.push([]);

  rows.push([
    'No.',
    '氏名',
    '業種コード1',
    '資格コード1',
    '講習フラグ1',
    '業種コード2',
    '資格コード2',
    '講習フラグ2',
    '監理技術者資格',
  ]);

  for (const staff of techStaff) {
    rows.push([
      staff.index,
      staff.name ?? '',
      staff.industryCode1,
      staff.qualCode1,
      staff.lectureFlag1,
      staff.industryCode2 ?? '',
      staff.qualCode2 ?? '',
      staff.lectureFlag2 ?? '',
      staff.supervisorCert ?? '',
    ]);
  }

  rows.push([]);
  rows.push(['技術職員数合計', techStaff.length]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [6, 14, 14, 14, 14, 14, 14, 14, 16]);
  return ws;
}

// --- Sheet 7: 社会性等W ---

function buildSocialWSheet(
  socialItems: SocialItemsData,
  wTotal: number,
  W: number
): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push(['社会性等（W）評点明細']);
  rows.push([]);

  rows.push(['項目', '評点']);
  rows.push(['W1 社会保険等・労働福祉', socialItems.w1]);
  rows.push(['W2 営業年数', socialItems.w2]);
  rows.push(['W3 防災活動への貢献', socialItems.w3]);
  rows.push(['W4 法令遵守の状況', socialItems.w4]);
  rows.push(['W5 建設業の経理の状況', socialItems.w5]);
  rows.push(['W6 研究開発の状況', socialItems.w6]);
  rows.push(['W7 建設機械の保有状況', socialItems.w7]);
  rows.push(['W8 国際標準化機構登録', socialItems.w8]);
  rows.push([]);
  rows.push(['素点合計', socialItems.total]);
  rows.push(['W点（換算後）', W]);
  rows.push([]);

  // W1 内訳
  rows.push(['--- W1 内訳 ---']);
  const w1Items = socialItems.w1Items ?? {};
  const w1Labels: Record<string, string> = {
    employmentInsurance: '雇用保険',
    healthInsurance: '健康保険',
    pensionInsurance: '厚生年金保険',
    constructionRetirementMutualAid: '建退共',
    retirementSystem: '退職金制度',
    nonStatutoryAccidentInsurance: '法定外労災',
    youngTechContinuous: '若年技術者継続育成',
    youngTechNew: '新規若年技術者',
    cpd: 'CPD単位',
    skillLevelUp: '技能レベル向上',
    wlbEruboshi: 'えるぼし認定',
    wlbKurumin: 'くるみん認定',
    wlbYouth: 'ユースエール認定',
    ccusImplementation: 'CCUS活用レベル',
  };

  for (const [key, label] of Object.entries(w1Labels)) {
    const val = w1Items[key];
    const display =
      typeof val === 'boolean' ? (val ? 'YES' : 'NO') : (val ?? '-');
    rows.push([label, display as string | number]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [30, 14]);
  return ws;
}

// --- Sheet 8: P点試算 ---

function buildPScoreSheet(data: PScoreData): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  if (data.companyName) {
    rows.push(['会社名', data.companyName]);
  }
  if (data.period) {
    rows.push(['決算期', data.period]);
  }
  rows.push([]);

  rows.push(['P = 0.25*X1 + 0.15*X2 + 0.20*Y + 0.25*Z + 0.15*W']);
  rows.push([]);

  rows.push([
    '共通スコア',
    `Y=${data.Y}`,
    `X2=${data.X2} (X21=${data.X21}/X22=${data.X22})`,
    `W=${data.W}`,
  ]);
  rows.push([]);

  rows.push(['業種', 'X1', 'X2', 'Y', 'Z', 'W', 'P']);

  for (const ind of data.industries) {
    rows.push([ind.name, ind.X1, data.X2, data.Y, ind.Z, data.W, ind.P]);
  }

  rows.push([]);
  rows.push(['--- 算式明細 ---']);
  rows.push([
    '業種',
    '0.25*X1',
    '0.15*X2',
    '0.20*Y',
    '0.25*Z',
    '0.15*W',
    'P',
  ]);
  for (const ind of data.industries) {
    rows.push([
      ind.name,
      Math.round(0.25 * ind.X1 * 10) / 10,
      Math.round(0.15 * data.X2 * 10) / 10,
      Math.round(0.2 * data.Y * 10) / 10,
      Math.round(0.25 * ind.Z * 10) / 10,
      Math.round(0.15 * data.W * 10) / 10,
      ind.P,
    ]);
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [20, 10, 10, 10, 10, 10, 10]);
  return ws;
}

// --- Sheet 9: 前期比較 ---

function buildPrevComparisonSheet(
  data: PScoreData,
  prev: PrevResultData
): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push(['前期比較']);
  rows.push([]);

  // 共通スコア比較
  rows.push(['指標', '前期', '当期', '増減']);
  rows.push(['Y点', prev.Y, data.Y, data.Y - prev.Y]);
  rows.push(['X2点', prev.X2, data.X2, data.X2 - prev.X2]);
  rows.push(['W点', prev.W, data.W, data.W - prev.W]);
  rows.push([]);

  // 業種別P点比較
  rows.push(['--- 業種別P点比較 ---']);
  rows.push(['業種', '前期P', '当期P', '増減', '前期X1', '当期X1', '前期Z', '当期Z']);

  for (const ind of data.industries) {
    const prevInd = prev.industries.find((p) => p.name === ind.name);
    if (prevInd) {
      rows.push([
        ind.name,
        prevInd.P,
        ind.P,
        ind.P - prevInd.P,
        prevInd.X1,
        ind.X1,
        prevInd.Z,
        ind.Z,
      ]);
    } else {
      rows.push([ind.name, '-', ind.P, '-', '-', ind.X1, '-', ind.Z]);
    }
  }

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [20, 10, 10, 10, 10, 10, 10, 10]);
  return ws;
}

// --- Sheet 10: 改善提案 ---

function buildImprovementSheet(data: PScoreData): XLSX.WorkSheet {
  const rows: (string | number)[][] = [];

  rows.push(['改善提案']);
  rows.push([]);
  rows.push([
    '改善項目',
    '対象スコア',
    '想定P点影響',
    '難易度',
    '備考',
  ]);

  // 定型の改善提案を生成（実データに基づくヒューリスティック）
  interface Suggestion {
    item: string;
    target: string;
    impact: string;
    difficulty: string;
    note: string;
  }
  const suggestions: Suggestion[] = [];

  // Y点関連の改善提案
  const yResult = data.yResult;
  const x1Val = yResult.indicators['x1'] ?? 0;
  const x6Val = yResult.indicators['x6'] ?? 0;
  const x7Val = yResult.indicators['x7'] ?? 0;

  if (x1Val > 2) {
    suggestions.push({
      item: '支払利息の削減',
      target: 'Y（x1）',
      impact: '中',
      difficulty: '中',
      note: `現在x1=${Math.round(x1Val * 100) / 100}%。借入金利の見直しで改善可能`,
    });
  }

  if (x6Val < 30) {
    suggestions.push({
      item: '自己資本比率の改善',
      target: 'Y（x6）',
      impact: '中',
      difficulty: '高',
      note: `現在x6=${Math.round(x6Val * 100) / 100}%。利益の内部留保が有効`,
    });
  }

  if (x7Val < 3) {
    suggestions.push({
      item: '営業CFの改善',
      target: 'Y（x7）',
      impact: '中',
      difficulty: '中',
      note: '売掛金回収の早期化、仕入債務の適正管理',
    });
  }

  // W点関連
  if (data.socialItems) {
    if (data.socialItems.w7 < 10) {
      suggestions.push({
        item: '建設機械の保有増',
        target: 'W（W7）',
        impact: '小',
        difficulty: '中',
        note: `現在W7=${data.socialItems.w7}点。機械購入/リースで加点`,
      });
    }
    if (data.socialItems.w8 < 10) {
      suggestions.push({
        item: 'ISO認証の取得',
        target: 'W（W8）',
        impact: '小',
        difficulty: '中',
        note: 'ISO9001/14001取得で最大10点加点',
      });
    }
  }

  // 完工高関連
  suggestions.push({
    item: '完成工事高の増加',
    target: 'X1',
    impact: '大',
    difficulty: '高',
    note: 'X1はP点の25%を占める。受注拡大が最もインパクト大',
  });

  // 技術職員関連
  suggestions.push({
    item: '技術職員の資格取得推進',
    target: 'Z（Z1）',
    impact: '中',
    difficulty: '中',
    note: '1級資格取得でZ1加点。監理技術者資格も有効',
  });

  // 提案がない場合のプレースホルダー
  if (suggestions.length === 0) {
    suggestions.push({
      item: '（データ不足のため具体的提案なし）',
      target: '-',
      impact: '-',
      difficulty: '-',
      note: '詳細データを入力すると改善提案が生成されます',
    });
  }

  for (const s of suggestions) {
    rows.push([s.item, s.target, s.impact, s.difficulty, s.note]);
  }

  rows.push([]);
  rows.push([
    '※ 上記は試算に基づく参考提案です。実際の改善効果は条件により異なります。',
  ]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  setColWidths(ws, [26, 14, 14, 10, 50]);
  return ws;
}

// --- 公開関数 ---

/**
 * P点サマリーExcelを生成（10シート構成）
 *
 * Sheet 1:  表紙
 * Sheet 2:  貸借対照表（様式第十五号）
 * Sheet 3:  損益計算書（様式第十六号）
 * Sheet 4:  Y点試算
 * Sheet 5:  工事種類別完工高
 * Sheet 6:  技術職員一覧
 * Sheet 7:  社会性等W
 * Sheet 8:  P点試算
 * Sheet 9:  前期比較
 * Sheet 10: 改善提案
 */
export function generatePScoreExcel(data: PScoreData): XLSX.WorkBook {
  const wb = XLSX.utils.book_new();

  // Sheet 1: 表紙
  const coverSheet = buildCoverSheet(data);
  XLSX.utils.book_append_sheet(wb, coverSheet, '表紙');

  // Sheet 2: 貸借対照表
  if (data.bs) {
    const bsSheet = buildBSSheet(data.bs);
    XLSX.utils.book_append_sheet(wb, bsSheet, '貸借対照表');
  }

  // Sheet 3: 損益計算書
  if (data.pl) {
    const plSheet = buildPLSheet(data.pl);
    XLSX.utils.book_append_sheet(wb, plSheet, '損益計算書');
  }

  // Sheet 4: Y点試算
  const ySheet = buildYScoreSheet(data.yResult);
  XLSX.utils.book_append_sheet(wb, ySheet, 'Y点試算');

  // Sheet 5: 工事種類別完工高
  const indSheet = buildIndustryCompletionSheet(data);
  XLSX.utils.book_append_sheet(wb, indSheet, '工事種類別完工高');

  // Sheet 6: 技術職員一覧
  if (data.techStaff && data.techStaff.length > 0) {
    const staffSheet = buildTechStaffSheet(data.techStaff);
    XLSX.utils.book_append_sheet(wb, staffSheet, '技術職員一覧');
  }

  // Sheet 7: 社会性等W
  if (data.socialItems) {
    const wSheet = buildSocialWSheet(data.socialItems, data.wTotal, data.W);
    XLSX.utils.book_append_sheet(wb, wSheet, '社会性等W');
  }

  // Sheet 8: P点試算
  const pSheet = buildPScoreSheet(data);
  XLSX.utils.book_append_sheet(wb, pSheet, 'P点試算');

  // Sheet 9: 前期比較
  if (data.prevResult) {
    const prevSheet = buildPrevComparisonSheet(data, data.prevResult);
    XLSX.utils.book_append_sheet(wb, prevSheet, '前期比較');
  }

  // Sheet 10: 改善提案
  const improvementSheet = buildImprovementSheet(data);
  XLSX.utils.book_append_sheet(wb, improvementSheet, '改善提案');

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

  rows.push(['営業キャッシュフロー', yResult.operatingCF]);
  rows.push([]);

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
