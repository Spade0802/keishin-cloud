/**
 * AI分析（Gemini）の型定義
 *
 * 経審コンサルタントが行う4セクションの分析レポートを
 * 構造化データとして表現する。
 */

/** 再分類レビュー項目 */
export interface ReclassificationItem {
  no: number;
  item: string;
  currentTreatment: string;
  alternativePlan: string;
  legality: string;
  requiredDocuments: string;
  yImpact: string;
  xImpact: string;
  zImpact: string;
  wImpact: string;
  pImpact: string;
  assessment: '採用余地あり' | '要確認' | '非推奨' | '—';
  risk: string;
  /** YInput フィールドへの差分（例: { sales: 12000, grossProfit: 12000 }） */
  affectedFields?: Record<string, number>;
}

/** シミュレーションケース */
export interface SimulationCase {
  label: string;
  description: string;
  assumptions: Record<string, string>;
  scores: {
    y: number;
    x2: number;
    z: Record<string, number>;
    w: number;
    p: Record<string, number>;
  };
}

/** 項目判定 */
export interface ItemAssessment {
  category: 'confirmed' | 'reviewable' | 'insufficientBasis' | 'shouldNotDo';
  item: string;
  currentPImpact: string;
  revisedPImpact: string;
  action: string;
}

/** リスク論点 */
export interface RiskPoint {
  topic: string;
  riskContent: string;
  severity: '高' | '中' | '低';
  response: string;
}

/** P点改善インパクトランキング項目 */
export interface ImpactRankingItem {
  rank: number;
  item: string;
  pImpact: string;
  comment: string;
  difficulty?: 'easy' | 'medium' | 'hard';
  difficultyLabel?: string; // 簡単 / 普通 / 困難
}

/** 確認すべき事項 */
export interface ChecklistItem {
  item: string;
  target: string; // 確認先（経理・税理士・行政書士等）
}

/** 勘定科目マッピング提案 */
export interface AccountMappingSuggestion {
  accountName: string;        // 科目名 (e.g., "有価証券")
  currentMapping: string;     // 現在の区分 (e.g., "流動資産・有価証券")
  suggestedMapping: string;   // 提案する区分 (e.g., "投資その他の資産・投資有価証券")
  rationale: string;          // 根拠 (e.g., "1年超保有のため固定資産が適切")
  pImpact: string;           // P点影響 (e.g., "全業種P+2〜3")
  yImpact: string;           // Y点影響 (e.g., "x5自己資本対固定資産比率が改善")
  risk: 'low' | 'medium' | 'high';  // リスク
  assessment: '採用余地あり' | '要確認' | '非推奨';
}

/** 期間推移分析 */
export interface TrendInsights {
  overallTrend: string;
  keyChanges: string[];
  riskFromTrend: string;
}

/** AI分析結果全体 */
export interface AnalysisResult {
  reclassificationReview: ReclassificationItem[];
  simulationComparison: SimulationCase[];
  itemAssessments: ItemAssessment[];
  riskPoints: RiskPoint[];
  impactRanking: ImpactRankingItem[];
  checklistItems: ChecklistItem[];
  accountMappingSuggestions?: AccountMappingSuggestion[];
  trendInsights?: TrendInsights;
  summary: string;
  disclaimer: string;
}

/** AI分析APIへの入力 */
export interface AnalysisInput {
  companyName: string;
  period: string;
  industries: Array<{
    name: string;
    X1: number;
    Z: number;
    Z1: number;
    Z2: number;
    P: number;
  }>;
  Y: number;
  X2: number;
  X21: number;
  X22: number;
  W: number;
  wTotal: number;
  yResult: {
    indicators: Record<string, number>;
    indicatorsRaw: Record<string, number>;
    A: number;
    Y: number;
    operatingCF: number;
  };
  wDetail?: {
    w1: number;
    w2: number;
    w3: number;
    w4: number;
    w5: number;
    w6: number;
    w7: number;
    w8: number;
    total: number;
  };
  bs?: Record<string, number>;
  pl?: Record<string, number>;
  /** Y点再計算用のYInput（再分類シミュレーション用） */
  yInput?: {
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
  };
  /** 経審用BS変換前の生データ（勘定科目マッピング提案用） */
  rawBsData?: Record<string, Record<string, number>>;
  /** EBITDA（X22計算用） */
  ebitda?: number;
  /** 業種別の完工高・元請高（再計算用） */
  industryCalcData?: Array<{
    name: string;
    avgCompletion: number;
    avgSubcontract: number;
    techStaffValue: number;
  }>;
  /** 前期データ（期間推移分析用） */
  previousPeriodData?: {
    period: string;
    Y: number;
    X2: number;
    W: number;
    industries: Array<{
      name: string;
      X1: number;
      Z: number;
      P: number;
    }>;
    yResult?: {
      indicators: Record<string, number>;
      indicatorsRaw: Record<string, number>;
      A: number;
      Y: number;
      operatingCF: number;
    };
  };
}
