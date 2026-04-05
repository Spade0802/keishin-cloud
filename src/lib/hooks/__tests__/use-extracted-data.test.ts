// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useExtractedData } from '../use-extracted-data';
import type { KeishinPdfResult } from '../../keishin-pdf-parser';

// Mock dependencies that do heavy lifting
vi.mock('../../extraction-validator', () => ({
  validateExtractedData: vi.fn((data: KeishinPdfResult) => ({
    isValid: true,
    issues: [],
    validatedWItems: data.wItems ?? {},
    validatedBasicInfo: data.basicInfo,
  })),
}));

vi.mock('../../extraction-field-map', () => ({
  normalizeIndustryName: vi.fn((name: string) => name),
  W_ITEMS_MAPPINGS: [],
  getNestedValue: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Helper: minimal KeishinPdfResult
// ---------------------------------------------------------------------------
function makeResult(overrides: Partial<KeishinPdfResult> = {}): KeishinPdfResult {
  return {
    basicInfo: {
      companyName: 'テスト建設株式会社',
      permitNumber: '国土交通大臣許可(般)第12345号',
      reviewBaseDate: '2025-09-30',
      periodNumber: '30',
    },
    equity: 50000,
    ebitda: 12000,
    techStaffCount: 3,
    industries: [
      {
        name: '土木一式工事',
        code: '01',
        prevCompletion: 100000,
        currCompletion: 120000,
        prevPrimeContract: 80000,
        currPrimeContract: 90000,
      },
    ],
    wItems: {},
    businessYears: 30,
    warnings: [],
    mappings: [],
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------
describe('useExtractedData', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('初期状態: isExtracted = false', () => {
    const { result } = renderHook(() => useExtractedData());
    expect(result.current.state.isExtracted).toBe(false);
    expect(result.current.state.rawData).toBeNull();
  });

  it('processExtraction: 完全なデータでフォーム値が生成される', () => {
    const { result } = renderHook(() => useExtractedData());

    let processed: ReturnType<typeof result.current.processExtraction>;
    act(() => {
      processed = result.current.processExtraction(makeResult());
    });

    expect(processed!.basicInfo.companyName).toBe('テスト建設株式会社');
    expect(processed!.equity).toBe(50000);
    expect(processed!.ebitda).toBe(12000);
    expect(processed!.industries).toHaveLength(1);
    expect(processed!.industries[0].name).toBe('土木一式工事');
    expect(processed!.industries[0].currCompletion).toBe('120000');
    expect(processed!.autoFilledFields.has('basicInfo.companyName')).toBe(true);
    expect(processed!.autoFilledFields.has('equity')).toBe(true);

    // state が更新されている
    expect(result.current.state.isExtracted).toBe(true);
    expect(result.current.state.rawData).not.toBeNull();
  });

  it('processExtraction: 業種なし → industries 空配列', () => {
    const { result } = renderHook(() => useExtractedData());

    let processed: ReturnType<typeof result.current.processExtraction>;
    act(() => {
      processed = result.current.processExtraction(makeResult({ industries: [] }));
    });

    expect(processed!.industries).toHaveLength(0);
    expect(processed!.autoFilledFields.has('industries')).toBe(false);
  });

  it('processExtraction: equity/ebitda が undefined → autoFilled に含まれない', () => {
    const { result } = renderHook(() => useExtractedData());

    let processed: ReturnType<typeof result.current.processExtraction>;
    act(() => {
      processed = result.current.processExtraction(
        makeResult({ equity: undefined as unknown as number, ebitda: undefined as unknown as number }),
      );
    });

    expect(processed!.autoFilledFields.has('equity')).toBe(false);
    expect(processed!.autoFilledFields.has('ebitda')).toBe(false);
  });

  it('markUserEdited: source が user_input に変わる', () => {
    const { result } = renderHook(() => useExtractedData());

    act(() => {
      result.current.processExtraction(makeResult());
    });

    // equity は auto-filled
    expect(result.current.getFieldSource('equity')).toBe('direct_pdf');
    expect(result.current.isAutoFilled('equity')).toBe(true);
    expect(result.current.isUserOverridden('equity')).toBe(false);

    act(() => {
      result.current.markUserEdited('equity');
    });

    expect(result.current.getFieldSource('equity')).toBe('user_input');
    expect(result.current.isUserOverridden('equity')).toBe(true);
    expect(result.current.isAutoFilled('equity')).toBe(false);
  });

  it('markUserEdited: 未登録フィールドでも user_input で登録される', () => {
    const { result } = renderHook(() => useExtractedData());

    act(() => {
      result.current.markUserEdited('customField');
    });

    expect(result.current.getFieldSource('customField')).toBe('user_input');
    expect(result.current.isUserOverridden('customField')).toBe(true);
  });

  it('getFieldSource: 未登録フィールド → null', () => {
    const { result } = renderHook(() => useExtractedData());
    expect(result.current.getFieldSource('nonexistent')).toBeNull();
  });

  it('reset: 全状態がクリアされる', () => {
    const { result } = renderHook(() => useExtractedData());

    act(() => {
      result.current.processExtraction(makeResult());
    });
    expect(result.current.state.isExtracted).toBe(true);

    act(() => {
      result.current.reset();
    });

    expect(result.current.state.isExtracted).toBe(false);
    expect(result.current.state.rawData).toBeNull();
    expect(result.current.state.fieldMeta).toEqual({});
    expect(result.current.state.validationIssues).toEqual([]);
    // field meta ref もクリアされている
    expect(result.current.getFieldSource('equity')).toBeNull();
  });

  it('subcontract は completion - primeContract で計算される', () => {
    const { result } = renderHook(() => useExtractedData());

    let processed: ReturnType<typeof result.current.processExtraction>;
    act(() => {
      processed = result.current.processExtraction(makeResult());
    });

    // currSubcontract = 120000 - 90000 = 30000
    expect(processed!.industries[0].currSubcontract).toBe('30000');
    // prevSubcontract = 100000 - 80000 = 20000
    expect(processed!.industries[0].prevSubcontract).toBe('20000');
  });
});
