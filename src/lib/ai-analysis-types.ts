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

/** AI分析結果全体 */
export interface AnalysisResult {
  reclassificationReview: ReclassificationItem[];
  simulationComparison: SimulationCase[];
  itemAssessments: ItemAssessment[];
  riskPoints: RiskPoint[];
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
}
