// 決算書の円ベースデータ
export interface RawFinancialData {
  bs: {
    currentAssets: Record<string, number>;
    tangibleFixed: Record<string, number>;
    intangibleFixed: Record<string, number>;
    investments: Record<string, number>;
    currentLiabilities: Record<string, number>;
    fixedLiabilities: Record<string, number>;
    equity: Record<string, number>;
    totals: {
      currentAssets: number;
      tangibleFixed: number;
      intangibleFixed: number;
      investments: number;
      fixedAssets: number;
      totalAssets: number;
      currentLiabilities: number;
      fixedLiabilities: number;
      totalLiabilities: number;
      totalEquity: number;
    };
  };
  pl: {
    completedConstruction: number;
    progressConstruction: number;
    totalSales: number;
    costOfSales: number;
    grossProfit: number;
    sgaItems: Record<string, number>;
    sgaTotal: number;
    operatingProfit: number;
    interestIncome: number;
    dividendIncome: number;
    miscIncome: number;
    interestExpense: number;
    miscExpense: number;
    ordinaryProfit: number;
    specialGain: number;
    specialLoss: number;
    preTaxProfit: number;
    corporateTax: number;
    netIncome: number;
  };
  manufacturing: {
    materials: number;
    labor: number;
    expenses: number;
    subcontract: number;
    mfgDepreciation: number;
    wipBeginning: number;
    wipEnding: number;
    totalCost: number;
  };
  sga: {
    sgaDepreciation: number;
  };
}

// 経審用BS（千円）
export interface KeishinBS {
  cashDeposits: number;
  notesReceivable: number;
  accountsReceivableConstruction: number;
  securities: number;
  wipConstruction: number;
  materialInventory: number;
  shortTermLoans: number;
  prepaidExpenses: number;
  deferredTaxAssetCurrent: number;
  otherCurrent: number;
  allowanceDoubtful: number;
  currentAssetsTotal: number;
  buildingsStructures: number;
  machineryVehicles: number;
  toolsEquipment: number;
  land: number;
  tangibleFixedTotal: number;
  patent: number;
  otherIntangible: number;
  intangibleFixedTotal: number;
  relatedCompanyShares: number;
  longTermLoans: number;
  insuranceReserve: number;
  longTermPrepaid: number;
  deferredTaxAssetFixed: number;
  otherInvestments: number;
  investmentsTotal: number;
  fixedAssetsTotal: number;
  deferredAssetsTotal: number;
  totalAssets: number;
  notesPayable: number;
  constructionPayable: number;
  shortTermBorrowing: number;
  leaseDebt: number;
  accountsPayable: number;
  unpaidExpenses: number;
  unpaidCorporateTax: number;
  deferredTaxLiability: number;
  advanceReceivedConstruction: number;
  depositsReceived: number;
  advanceRevenue: number;
  provisions: number;
  unpaidConsumptionTax: number;
  currentLiabilitiesTotal: number;
  longTermBorrowing: number;
  fixedLiabilitiesTotal: number;
  totalLiabilities: number;
  capitalStock: number;
  legalReserve: number;
  otherRetainedEarnings: number;
  specialReserve: number;
  retainedEarningsCF: number;
  retainedEarningsTotal: number;
  treasuryStock: number;
  shareholdersEquityTotal: number;
  securitiesValuation: number;
  evaluationTotal: number;
  totalEquity: number;
  totalLiabilitiesEquity: number;
}

// 経審用PL（千円）
export interface KeishinPL {
  completedConstructionRevenue: number;
  sideBusiness: number;
  totalSales: number;
  completedConstructionCost: number;
  sideBusinessCost: number;
  grossProfit: number;
  sgaTotal: number;
  operatingProfit: number;
  interestDividendIncome: number;
  otherNonOpIncome: number;
  nonOpIncomeTotal: number;
  interestExpense: number;
  otherNonOpExpense: number;
  nonOpExpenseTotal: number;
  ordinaryProfit: number;
  specialGain: number;
  specialLoss: number;
  preTaxProfit: number;
  corporateTax: number;
  taxAdjustment: number;
  netIncome: number;
  costReport: {
    materials: number;
    labor: number;
    laborSubcontract: number;
    subcontract: number;
    expenses: number;
    personnelInExpenses: number;
    totalCost: number;
  };
  depreciation: number;
}

// Y点計算入力
export interface YInput {
  sales: number;
  grossProfit: number;
  ordinaryProfit: number;
  interestExpense: number;
  interestDividendIncome: number;
  currentLiabilities: number;
  fixedLiabilities: number;
  totalCapital: number;
  equity: number;
  fixedAssets: number;
  retainedEarnings: number;
  corporateTax: number;
  depreciation: number;
  allowanceDoubtful: number;
  notesAndAccountsReceivable: number;
  constructionPayable: number;
  inventoryAndMaterials: number;
  advanceReceived: number;
  prev: {
    totalCapital: number;
    operatingCF: number;
    allowanceDoubtful: number;
    notesAndAccountsReceivable: number;
    constructionPayable: number;
    inventoryAndMaterials: number;
    advanceReceived: number;
  };
}

// Y点計算結果
export interface YResult {
  indicators: {
    x1: number; x2: number; x3: number; x4: number;
    x5: number; x6: number; x7: number; x8: number;
  };
  indicatorsRaw: {
    x1: number; x2: number; x3: number; x4: number;
    x5: number; x6: number; x7: number; x8: number;
  };
  A: number;
  Y: number;
  operatingCF: number;
  operatingCFDetail: {
    ordinaryProfit: number;
    depreciation: number;
    corporateTax: number;
    allowanceChange: number;
    receivableChange: number;
    payableChange: number;
    inventoryChange: number;
    advanceChange: number;
  };
}

// 業種別データ
export interface IndustryData {
  code: string;
  permitType: '特定' | '一般';
  prevCompletionAmount: number;
  currCompletionAmount: number;
  prevSubcontractAmount: number;
  currSubcontractAmount: number;
  avgCompletion: number;
  avgSubcontract: number;
  techStaffValue: number;
  Z1: number;
  Z2: number;
  Z: number;
  X1: number;
  P: number;
}

// 技術職員
export interface TechnicalStaff {
  name: string;
  age: number;
  industryCode1: number;
  qualificationCode1: number;
  lectureFlag1: number;
  industryCode2?: number;
  qualificationCode2?: number;
  lectureFlag2?: number;
  supervisorCertNumber?: string;
  cpdUnits: number;
  isNew: boolean;
}

// 社会性等（W）入力
export interface SocialItems {
  employmentInsurance: boolean;
  healthInsurance: boolean;
  pensionInsurance: boolean;
  constructionRetirementMutualAid: boolean;
  retirementSystem: boolean;
  nonStatutoryAccidentInsurance: boolean;
  youngTechContinuous: boolean;
  youngTechNew: boolean;
  techStaffCount: number;
  youngTechCount: number;
  newYoungTechCount: number;
  cpdTotalUnits: number;
  skillLevelUpCount: number;
  skilledWorkerCount: number;
  deductionTargetCount: number;
  wlbEruboshi: number;
  wlbKurumin: number;
  wlbYouth: number;
  ccusImplementation: number;
  businessYears: number;
  civilRehabilitation: boolean;
  disasterAgreement: boolean;
  suspensionOrder: boolean;
  instructionOrder: boolean;
  auditStatus: number;
  certifiedAccountants: number;
  firstClassAccountants: number;
  secondClassAccountants: number;
  rdExpense2YearAvg: number;
  constructionMachineCount: number;
  iso9001: boolean;
  iso14001: boolean;
  ecoAction21: boolean;
}

// W計算詳細
export interface WDetail {
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

// 最終結果
export interface KeishinResult {
  companyName: string;
  permitNumber: string;
  reviewBaseDate: string;
  Y: number;
  X2: number;
  X21: number;
  X22: number;
  W: number;
  industries: IndustryData[];
  bs: KeishinBS;
  pl: KeishinPL;
  yResult: YResult;
  wDetail: WDetail;
}
