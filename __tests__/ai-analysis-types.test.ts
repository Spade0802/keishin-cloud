import { describe, test, expect } from 'vitest';
import type {
  AnalysisResult,
  AnalysisInput,
  ReclassificationItem,
  SimulationCase,
  ItemAssessment,
  RiskPoint,
} from '@/lib/ai-analysis-types';
import { demoAnalysisResult } from '@/lib/demo-ai-analysis';

describe('AI分析型定義の整合性テスト', () => {
  test('デモ分析結果が AnalysisResult 型に準拠している', () => {
    const result: AnalysisResult = demoAnalysisResult;

    expect(result.summary).toBeTruthy();
    expect(result.disclaimer).toBeTruthy();
    expect(result.reclassificationReview.length).toBeGreaterThan(0);
    expect(result.simulationComparison.length).toBe(3);
    expect(result.itemAssessments.length).toBeGreaterThan(0);
    expect(result.riskPoints.length).toBeGreaterThan(0);
  });

  test('再分類レビュー項目が必須フィールドを持つ', () => {
    const items = demoAnalysisResult.reclassificationReview;
    for (const item of items) {
      expect(item.no).toBeGreaterThan(0);
      expect(item.item).toBeTruthy();
      expect(item.currentTreatment).toBeTruthy();
      expect(item.alternativePlan).toBeTruthy();
      expect(['採用余地あり', '要確認', '非推奨', '—']).toContain(item.assessment);
    }
  });

  test('シミュレーションが3ケース（A/B/C）を含む', () => {
    const cases = demoAnalysisResult.simulationComparison;
    expect(cases[0].label).toBe('Case A');
    expect(cases[1].label).toBe('Case B');
    expect(cases[2].label).toBe('Case C');

    // Case B の P点は Case A 以上であること（最適化ケース）
    const industryNames = Object.keys(cases[0].scores.p);
    for (const name of industryNames) {
      expect(cases[1].scores.p[name]).toBeGreaterThanOrEqual(cases[0].scores.p[name]);
    }
  });

  test('項目判定が有効なカテゴリのみを含む', () => {
    const validCategories = ['confirmed', 'reviewable', 'insufficientBasis', 'shouldNotDo'];
    for (const item of demoAnalysisResult.itemAssessments) {
      expect(validCategories).toContain(item.category);
    }
  });

  test('リスク論点が有効な重要度のみを含む', () => {
    const validSeverities = ['高', '中', '低'];
    for (const item of demoAnalysisResult.riskPoints) {
      expect(validSeverities).toContain(item.severity);
    }
  });

  test('免責事項に粉飾・違法に関する注意が含まれる', () => {
    expect(demoAnalysisResult.disclaimer).toContain('専門家');
    expect(demoAnalysisResult.disclaimer).toContain('粉飾');
  });
});
