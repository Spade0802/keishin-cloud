/**
 * デモページ用の事前計算済みデータ（第45期 株式会社 〇×建設）
 *
 * 完全に架空の会社・架空のデータを使用。
 * デモページはクライアントサイドで計算エンジンを呼ぶのではなく、
 * ここで静的に保持した結果を表示するだけにする。
 */

import { calculateY } from '@/lib/engine/y-calculator';
import { calculateP, calculateX2, calculateZ, calculateW } from '@/lib/engine/p-calculator';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z1_TABLE, Z2_TABLE } from '@/lib/engine/score-tables';
import type { YInput, YResult, WDetail, SocialItems, KeishinBS, KeishinPL } from '@/lib/engine/types';

// ---- Step 1: 決算書データ (千円) ----
export const financials = {
  sales: 2850000,
  grossProfit: 456000,
  ordinaryProfit: 128500,
  interestExpense: 8200,
  interestDividendIncome: 1350,
  currentLiabilities: 312000,
  fixedLiabilities: 185000,
  totalCapital: 1120000,
  equity: 623000,
  fixedAssets: 385000,
  retainedEarnings: 498000,
  corporateTax: 42800,
  depreciation: 18500,
  allowanceDoubtful: 1250,
  notesAndReceivable: 285000,
  constructionPayable: 198000,
  inventoryAndMaterials: 12500,
  advanceReceived: 8500,
};

// ---- Step 2: 基本情報 ----
export const demoBasicInfo = {
  companyName: '株式会社 〇×建設',
  permitNumber: '国土交通大臣許可',
  reviewBaseDate: 'R7.9.30',
  periodNumber: '第45期',
};

export const ebitda = 79200;

// ---- Step 2: 業種別データ ----
export const industryInputs = [
  { name: '土木一式', permitType: '特定' as const, prevCompletion: 980000, currCompletion: 1150000, prevSubcontract: 620000, currSubcontract: 750000, techStaffValue: 85 },
  { name: '建築一式', permitType: '特定' as const, prevCompletion: 720000, currCompletion: 860000, prevSubcontract: 380000, currSubcontract: 450000, techStaffValue: 72 },
  { name: '電気', permitType: '一般' as const, prevCompletion: 185000, currCompletion: 210000, prevSubcontract: 95000, currSubcontract: 110000, techStaffValue: 38 },
  { name: '管', permitType: '一般' as const, prevCompletion: 142000, currCompletion: 168000, prevSubcontract: 52000, currSubcontract: 65000, techStaffValue: 25 },
];

// ---- Step 4: 前期データ ----
export const prevData = {
  totalCapital: 1085000,
  operatingCF: 95200,
  allowanceDoubtful: 1800,
  notesAndAccountsReceivable: 310000,
  constructionPayable: 215000,
  inventoryAndMaterials: 15800,
  advanceReceived: 6200,
};

// ---- W項目 ----
const demoSocialItems: SocialItems = {
  employmentInsurance: true,
  healthInsurance: true,
  pensionInsurance: true,
  constructionRetirementMutualAid: true,
  retirementSystem: true,
  nonStatutoryAccidentInsurance: false,
  youngTechContinuous: true,
  youngTechNew: false,
  techStaffCount: 48,
  youngTechCount: 12,
  newYoungTechCount: 0,
  cpdTotalUnits: 580,
  skillLevelUpCount: 5,
  skilledWorkerCount: 15,
  deductionTargetCount: 0,
  wlbEruboshi: 0,
  wlbKurumin: 1,
  wlbYouth: 0,
  ccusImplementation: 1,
  businessYears: 45,
  civilRehabilitation: false,
  disasterAgreement: true,
  suspensionOrder: false,
  instructionOrder: false,
  auditStatus: 1,
  certifiedAccountants: 0,
  firstClassAccountants: 1,
  secondClassAccountants: 0,
  rdExpense2YearAvg: 0,
  constructionMachineCount: 3,
  iso9001: true,
  iso14001: false,
  ecoAction21: false,
};

// ---- 前期スコア（比較表示用） ----
const prevScores = {
  Y: 785,
  X2: 710,
  W: 820,
  industryP: [832, 768, 645, 612],
};

// ---- 経審用BS（千円） ----
export const demoBS: KeishinBS = {
  // 流動資産
  cashDeposits: 245000,
  notesReceivable: 42000,
  accountsReceivableConstruction: 243000,
  securities: 15000,
  wipConstruction: 8500,
  materialInventory: 4000,
  shortTermLoans: 5000,
  prepaidExpenses: 3200,
  deferredTaxAssetCurrent: 4800,
  otherCurrent: 6500,
  allowanceDoubtful: -1250,
  currentAssetsTotal: 575750,

  // 有形固定資産
  buildingsStructures: 125000,
  machineryVehicles: 68000,
  toolsEquipment: 12500,
  land: 142000,
  tangibleFixedTotal: 347500,

  // 無形固定資産
  patent: 0,
  otherIntangible: 5200,
  intangibleFixedTotal: 5200,

  // 投資その他の資産
  relatedCompanyShares: 8000,
  longTermLoans: 2000,
  insuranceReserve: 12500,
  longTermPrepaid: 1800,
  deferredTaxAssetFixed: 3250,
  otherInvestments: 5000,
  investmentsTotal: 32550,

  fixedAssetsTotal: 385250,
  deferredAssetsTotal: 0,
  totalAssets: 961000,

  // 流動負債
  notesPayable: 28000,
  constructionPayable: 198000,
  shortTermBorrowing: 35000,
  leaseDebt: 4500,
  accountsPayable: 12000,
  unpaidExpenses: 8500,
  unpaidCorporateTax: 15000,
  deferredTaxLiability: 0,
  advanceReceivedConstruction: 8500,
  depositsReceived: 1200,
  advanceRevenue: 0,
  provisions: 1300,
  unpaidConsumptionTax: 0,
  currentLiabilitiesTotal: 312000,

  // 固定負債
  longTermBorrowing: 185000,
  fixedLiabilitiesTotal: 185000,
  totalLiabilities: 497000,

  // 純資産
  capitalStock: 80000,
  legalReserve: 20000,
  otherRetainedEarnings: 498000,
  specialReserve: 150000,
  retainedEarningsCF: 348000,
  retainedEarningsTotal: 518000,
  treasuryStock: -12000,
  shareholdersEquityTotal: 606000,
  securitiesValuation: -142000,
  evaluationTotal: -142000,
  totalEquity: 464000,
  totalLiabilitiesEquity: 961000,
};

// ---- 経審用PL（千円） ----
export const demoPL: KeishinPL = {
  completedConstructionRevenue: 2850000,
  sideBusiness: 65000,
  totalSales: 2915000,
  completedConstructionCost: 2394000,
  sideBusinessCost: 52000,
  grossProfit: 469000,
  sgaTotal: 325000,
  operatingProfit: 144000,
  interestDividendIncome: 1350,
  otherNonOpIncome: 3200,
  nonOpIncomeTotal: 4550,
  interestExpense: 8200,
  otherNonOpExpense: 11850,
  nonOpExpenseTotal: 20050,
  ordinaryProfit: 128500,
  specialGain: 2500,
  specialLoss: 8200,
  preTaxProfit: 122800,
  corporateTax: 42800,
  taxAdjustment: -2100,
  netIncome: 82100,
  costReport: {
    materials: 382000,
    labor: 358000,
    laborSubcontract: 125000,
    subcontract: 1285000,
    expenses: 369000,
    personnelInExpenses: 82000,
    totalCost: 2394000,
  },
  depreciation: 18500,
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

  const industries = industryInputs.map((ind, idx) => {
    const avgComp = Math.floor((ind.prevCompletion + ind.currCompletion) / 2);
    const currComp = ind.currCompletion;
    const adoptedComp = Math.max(avgComp, currComp);
    const x1Selected: '2年平均' | '当期' = avgComp >= currComp ? '2年平均' : '当期';
    const avgSub = Math.floor((ind.prevSubcontract + ind.currSubcontract) / 2);
    const X1 = lookupScore(X1_TABLE, adoptedComp);
    const z1 = lookupScore(Z1_TABLE, ind.techStaffValue);
    const z2 = lookupScore(Z2_TABLE, avgSub);
    const Z = calculateZ(z1, z2);
    const P = calculateP(X1, x2, yResult.Y, Z, W);
    return { name: ind.name, X1, Z, Z1: z1, Z2: z2, P, prevP: prevScores.industryP[idx], x1TwoYearAvg: avgComp, x1Current: currComp, x1Selected };
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
    prevY: prevScores.Y,
    prevX2: prevScores.X2,
    prevW: prevScores.W,
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
