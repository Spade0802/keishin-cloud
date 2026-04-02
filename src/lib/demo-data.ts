/**
 * デモページ用の事前計算済みデータ（第58期 アヅサ電気工業(株)）
 *
 * input-wizard.tsx の loadDemoData() と同一の入力値から算出。
 * デモページはクライアントサイドで計算エンジンを呼ぶのではなく、
 * ここで静的に保持した結果を表示するだけにする。
 */

import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ, calculateW } from '@/lib/engine/p-calculator';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';
import type { YInput, YResult, WDetail, SocialItems } from '@/lib/engine/types';

// ---- Step 1: 決算書データ (千円) ----
const financials = {
  sales: 1668128,
  grossProfit: 270254,
  ordinaryProfit: 85784,
  interestExpense: 6042,
  interestDividendIncome: 844,
  currentLiabilities: 185776,
  fixedLiabilities: 227499,
  totalCapital: 749286,
  equity: 336010,
  fixedAssets: 236308,
  retainedEarnings: 299650,
  corporateTax: 29851,
  depreciation: 5985,
  allowanceDoubtful: 635,
  notesAndReceivable: 129271,
  constructionPayable: 137521,
  inventoryAndMaterials: 4836,
  advanceReceived: 682,
};

// ---- Step 2: 基本情報 ----
export const demoBasicInfo = {
  companyName: 'アヅサ電気工業(株)',
  permitNumber: '千葉県知事許可',
  reviewBaseDate: 'R7.6.30',
  periodNumber: '第58期',
};

const ebitda = 44332;

// ---- Step 2: 業種別データ ----
const industryInputs = [
  { name: '電気', permitType: '特定' as const, prevCompletion: 1125920, currCompletion: 1625600, prevSubcontract: 443950, currSubcontract: 933000, techStaffValue: 62 },
  { name: '管', permitType: '一般' as const, prevCompletion: 3370, currCompletion: 0, prevSubcontract: 0, currSubcontract: 0, techStaffValue: 20 },
  { name: '電気通信', permitType: '一般' as const, prevCompletion: 27752, currCompletion: 0, prevSubcontract: 27752, currSubcontract: 0, techStaffValue: 0 },
  { name: '消防施設', permitType: '一般' as const, prevCompletion: 1842, currCompletion: 0, prevSubcontract: 0, currSubcontract: 0, techStaffValue: 0 },
];

// ---- Step 4: 前期データ ----
const prevData = {
  totalCapital: 827777,
  operatingCF: 78454,
  allowanceDoubtful: 1200,
  notesAndAccountsReceivable: 223124,
  constructionPayable: 224090,
  inventoryAndMaterials: 17836,
  advanceReceived: 1653,
};

// ---- W項目（デモ用デフォルト: 社会保険3つ加入 + 営業年数35年以上） ----
const demoSocialItems: SocialItems = {
  employmentInsurance: true,
  healthInsurance: true,
  pensionInsurance: true,
  constructionRetirementMutualAid: false,
  retirementSystem: false,
  nonStatutoryAccidentInsurance: false,
  youngTechContinuous: false,
  youngTechNew: false,
  techStaffCount: 0,
  youngTechCount: 0,
  newYoungTechCount: 0,
  cpdTotalUnits: 0,
  skillLevelUpCount: 0,
  skilledWorkerCount: 0,
  deductionTargetCount: 0,
  wlbEruboши: 0,
  wlbKurumin: 0,
  wlbYouth: 0,
  ccusImplementation: 0,
  businessYears: 35,
  civilRehabilitation: false,
  disasterAgreement: false,
  suspensionOrder: false,
  instructionOrder: false,
  auditStatus: 0,
  certifiedAccountants: 0,
  firstClassAccountants: 0,
  secondClassAccountants: 0,
  rdExpense2YearAvg: 0,
  constructionMachineCount: 0,
  iso9001: false,
  iso14001: false,
  ecoAction21: false,
};

// ---- 計算 ----

function buildDemoResult() {
  const yInput: YInput = {
    ...financials,
    notesAndAccountsReceivable: financials.notesAndReceivable,
    prev: prevData,
  };

  const yResult = calculateY(yInput);
  const x21 = lookupScore(X21_TABLE, financials.equity);
  const x22 = lookupScore(X22_TABLE, ebitda);
  const x2 = calculateX2(x21, x22);

  const wCalc = calculateW(demoSocialItems);
  const W = wCalc.W;
  const wDetail = wCalc.detail;

  const industries = industryInputs.map((ind) => {
    const avgComp = Math.floor((ind.prevCompletion + ind.currCompletion) / 2);
    const avgSub = Math.floor((ind.prevSubcontract + ind.currSubcontract) / 2);
    const X1 = lookupScore(X1_TABLE, avgComp);
    const z1 = lookupScore(Z1_TABLE, ind.techStaffValue);
    const z2 = lookupScore(Z2_TABLE, avgSub);
    const Z = calculateZ(z1, z2);
    const P = calculateP(X1, x2, yResult.Y, Z, W);
    return { name: ind.name, X1, Z, Z1: z1, Z2: z2, P };
  });

  return {
    companyName: demoBasicInfo.companyName,
    period: demoBasicInfo.periodNumber,
    reviewBaseDate: demoBasicInfo.reviewBaseDate,
    Y: yResult.Y,
    X2: x2,
    X21: x21,
    X22: x22,
    W,
    wTotal: wCalc.total,
    yResult,
    wDetail,
    industries,
  };
}

export const demoResult = buildDemoResult();

// ---- 入力サマリー（Accordion 表示用） ----

export const demoFinancialSummary = [
  { label: '完成工事高', value: financials.sales, unit: '千円' },
  { label: '売上総利益', value: financials.grossProfit, unit: '千円' },
  { label: '経常利益', value: financials.ordinaryProfit, unit: '千円' },
  { label: '支払利息', value: financials.interestExpense, unit: '千円' },
  { label: '受取利息配当金', value: financials.interestDividendIncome, unit: '千円' },
  { label: '流動負債', value: financials.currentLiabilities, unit: '千円' },
  { label: '固定負債', value: financials.fixedLiabilities, unit: '千円' },
  { label: '総資本', value: financials.totalCapital, unit: '千円' },
  { label: '自己資本', value: financials.equity, unit: '千円' },
  { label: '固定資産', value: financials.fixedAssets, unit: '千円' },
  { label: '利益剰余金', value: financials.retainedEarnings, unit: '千円' },
  { label: '法人税等', value: financials.corporateTax, unit: '千円' },
  { label: '減価償却実施額', value: financials.depreciation, unit: '千円' },
];

export const demoIndustrySummary = industryInputs.map((ind) => ({
  name: ind.name,
  permitType: ind.permitType,
  avgCompletion: Math.floor((ind.prevCompletion + ind.currCompletion) / 2),
  avgSubcontract: Math.floor((ind.prevSubcontract + ind.currSubcontract) / 2),
  techStaffValue: ind.techStaffValue,
}));
