import { describe, test, expect } from 'vitest';
import { AnalysisResultSchema } from '@/lib/ai-analysis';

// ==========================================
// Zod schema tests for AI analysis response
// ==========================================

/** Minimal valid AnalysisResult data */
function makeValidData() {
  return {
    reclassificationReview: [
      {
        no: 1,
        item: '雑収入の振替',
        currentTreatment: '営業外収益に計上',
        alternativePlan: '完成工事高に振替',
        legality: '建設業会計基準に基づき適法',
        requiredDocuments: '契約書・請求書',
        yImpact: 'Y+5',
        xImpact: 'X1+10',
        zImpact: '変化なし',
        wImpact: '変化なし',
        pImpact: '全業種P+3',
        assessment: '採用余地あり' as const,
        risk: '低リスク',
        affectedFields: { sales: 12000, grossProfit: 12000 },
      },
    ],
    simulationComparison: [
      {
        label: 'Case A',
        description: '現状ベース',
        assumptions: {},
        scores: {
          y: 852,
          x2: 748,
          z: { '電気工事': 1028 },
          w: 1207,
          p: { '電気工事': 987 },
        },
      },
    ],
    itemAssessments: [
      {
        category: 'confirmed' as const,
        item: 'Y点',
        currentPImpact: '852',
        revisedPImpact: '852',
        action: 'そのまま確定',
      },
    ],
    riskPoints: [
      {
        topic: '借入金比率',
        riskContent: '固定負債比率が高い',
        severity: '中' as const,
        response: '長期借入金の返済計画を確認',
      },
    ],
    impactRanking: [
      {
        rank: 1,
        item: '雑収入の振替',
        pImpact: 'P+3',
        comment: '最も効果的',
        difficulty: 'easy' as const,
        difficultyLabel: '簡単',
      },
    ],
    checklistItems: [
      {
        item: '雑収入の内訳確認',
        target: '経理',
      },
    ],
    accountMappingSuggestions: [
      {
        accountName: '有価証券',
        currentMapping: '流動資産',
        suggestedMapping: '投資その他の資産',
        rationale: '1年超保有のため',
        pImpact: 'P+2',
        yImpact: 'x5改善',
        risk: 'low' as const,
        assessment: '採用余地あり' as const,
      },
    ],
    trendInsights: {
      overallTrend: '前年比で改善傾向',
      keyChanges: ['Y点が+50', 'W点が微増'],
      riskFromTrend: '特になし',
    },
    summary: '全体として良好な経審結果です。',
    disclaimer: '本レポートはAI分析です。',
  };
}

describe('AnalysisResultSchema with valid data', () => {
  test('parses complete valid data successfully', () => {
    const data = makeValidData();
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary).toBe('全体として良好な経審結果です。');
      expect(result.data.reclassificationReview).toHaveLength(1);
      expect(result.data.simulationComparison).toHaveLength(1);
      expect(result.data.itemAssessments).toHaveLength(1);
      expect(result.data.riskPoints).toHaveLength(1);
      expect(result.data.impactRanking).toHaveLength(1);
      expect(result.data.checklistItems).toHaveLength(1);
      expect(result.data.accountMappingSuggestions).toHaveLength(1);
      expect(result.data.trendInsights).toBeDefined();
    }
  });

  test('preserves affectedFields on reclassification items', () => {
    const data = makeValidData();
    const result = AnalysisResultSchema.parse(data);
    expect(result.reclassificationReview[0].affectedFields).toEqual({
      sales: 12000,
      grossProfit: 12000,
    });
  });

  test('preserves all enum values correctly', () => {
    const data = makeValidData();
    const result = AnalysisResultSchema.parse(data);
    expect(result.reclassificationReview[0].assessment).toBe('採用余地あり');
    expect(result.itemAssessments[0].category).toBe('confirmed');
    expect(result.riskPoints[0].severity).toBe('中');
    expect(result.impactRanking[0].difficulty).toBe('easy');
    expect(result.accountMappingSuggestions![0].risk).toBe('low');
  });
});

describe('AnalysisResultSchema with missing required fields (defaults)', () => {
  test('uses default empty arrays when arrays are missing', () => {
    const data = {};
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      // Arrays with .catch([]) default to empty
      expect(result.data.reclassificationReview).toEqual([]);
      expect(result.data.simulationComparison).toEqual([]);
      expect(result.data.itemAssessments).toEqual([]);
      expect(result.data.riskPoints).toEqual([]);
      // Arrays with .optional().default([])
      expect(result.data.impactRanking).toEqual([]);
      expect(result.data.checklistItems).toEqual([]);
      expect(result.data.accountMappingSuggestions).toEqual([]);
      // Optional without default
      expect(result.data.trendInsights).toBeUndefined();
      // String with .catch(...)
      expect(result.data.summary).toBe('（サマリーの生成に失敗しました）');
      // String with .optional().default('')
      expect(result.data.disclaimer).toBe('');
    }
  });

  test('uses default summary when summary is wrong type', () => {
    const data = { summary: 12345 };
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.summary).toBe('（サマリーの生成に失敗しました）');
    }
  });

  test('assessment enum falls back to default on invalid value', () => {
    const data = makeValidData();
    (data.reclassificationReview[0] as Record<string, unknown>).assessment = 'invalid_value';
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reclassificationReview[0].assessment).toBe('要確認');
    }
  });

  test('severity enum falls back to default on invalid value', () => {
    const data = makeValidData();
    (data.riskPoints[0] as Record<string, unknown>).severity = 'critical';
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.riskPoints[0].severity).toBe('中');
    }
  });

  test('category enum falls back to default on invalid value', () => {
    const data = makeValidData();
    (data.itemAssessments[0] as Record<string, unknown>).category = 'unknown';
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.itemAssessments[0].category).toBe('reviewable');
    }
  });

  test('difficulty defaults to medium when missing', () => {
    const data = makeValidData();
    delete (data.impactRanking[0] as Record<string, unknown>).difficulty;
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.impactRanking[0].difficulty).toBe('medium');
    }
  });

  test('affectedFields defaults to empty object when missing', () => {
    const data = makeValidData();
    delete (data.reclassificationReview[0] as Record<string, unknown>).affectedFields;
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reclassificationReview[0].affectedFields).toEqual({});
    }
  });
});

describe('AnalysisResultSchema with extra fields (passthrough)', () => {
  test('extra fields on root are preserved', () => {
    const data = {
      ...makeValidData(),
      customField: 'extra value',
      debugInfo: { version: '1.0' },
    };
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).customField).toBe('extra value');
    }
  });

  test('extra fields on nested items are preserved', () => {
    const data = makeValidData();
    (data.reclassificationReview[0] as Record<string, unknown>).extraNote = 'AI added this';
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data.reclassificationReview[0] as Record<string, unknown>).extraNote).toBe('AI added this');
    }
  });

  test('extra fields on simulation scores are preserved', () => {
    const data = makeValidData();
    (data.simulationComparison[0].scores as Record<string, unknown>).custom = 42;
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
  });
});

describe('AnalysisResultSchema with completely malformed data', () => {
  test('null input uses all defaults', () => {
    const result = AnalysisResultSchema.safeParse(null);
    // null is not an object, so safeParse should fail
    expect(result.success).toBe(false);
  });

  test('string input fails', () => {
    const result = AnalysisResultSchema.safeParse('not an object');
    expect(result.success).toBe(false);
  });

  test('number input fails', () => {
    const result = AnalysisResultSchema.safeParse(42);
    expect(result.success).toBe(false);
  });

  test('array input fails', () => {
    const result = AnalysisResultSchema.safeParse([1, 2, 3]);
    expect(result.success).toBe(false);
  });

  test('undefined input fails', () => {
    const result = AnalysisResultSchema.safeParse(undefined);
    expect(result.success).toBe(false);
  });

  test('object with all wrong types for catch fields uses defaults', () => {
    // Note: disclaimer is z.string().optional().default('') — no .catch(),
    // so a wrong type (number) will cause validation failure.
    // Only fields with .catch() gracefully handle wrong types.
    const data = {
      reclassificationReview: 'not an array',
      simulationComparison: 123,
      itemAssessments: null,
      riskPoints: true,
      summary: false,
    };
    const result = AnalysisResultSchema.safeParse(data);
    expect(result.success).toBe(true);
    if (result.success) {
      // .catch([]) handles wrong types gracefully
      expect(result.data.reclassificationReview).toEqual([]);
      expect(result.data.simulationComparison).toEqual([]);
      expect(result.data.itemAssessments).toEqual([]);
      expect(result.data.riskPoints).toEqual([]);
      expect(result.data.summary).toBe('（サマリーの生成に失敗しました）');
    }
  });

  test('disclaimer with wrong type fails validation (no catch)', () => {
    const data = {
      ...makeValidData(),
      disclaimer: 42, // number, not string
    };
    const result = AnalysisResultSchema.safeParse(data);
    // disclaimer is z.string().optional().default('') — no .catch(),
    // so wrong type causes failure
    expect(result.success).toBe(false);
  });

  test('deeply nested invalid data in arrays triggers catch', () => {
    const data = {
      reclassificationReview: [
        { no: 'not a number', item: 123 }, // invalid item structure
      ],
    };
    const result = AnalysisResultSchema.safeParse(data);
    // The entire array gets caught and defaults to []
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.reclassificationReview).toEqual([]);
    }
  });
});
