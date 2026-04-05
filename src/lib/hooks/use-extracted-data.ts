'use client';

/**
 * 抽出データ管理フック
 *
 * PDF抽出データとユーザー手入力の統合管理を行う。
 * 各フィールドのデータソース追跡、自動入力 / 手動上書きの状態管理を提供する。
 */

import { useState, useCallback, useRef } from 'react';
import type { DataSource, FieldMeta } from '../extraction-field-map';
import type { SocialItems } from '../engine/types';
import type { KeishinPdfResult } from '../keishin-pdf-parser';
import type { ValidationIssue } from '../extraction-validator';
import { validateExtractedData } from '../extraction-validator';
import { normalizeIndustryName } from '../extraction-field-map';

// ─── 型定義 ───

export interface ExtractionState {
  /** 抽出元データ */
  rawData: KeishinPdfResult | null;
  /** フィールドごとのメタ情報 */
  fieldMeta: Record<string, FieldMeta>;
  /** バリデーション警告 */
  validationIssues: ValidationIssue[];
  /** 抽出が完了したか */
  isExtracted: boolean;
}

export interface UseExtractedDataReturn {
  /** 現在の抽出状態 */
  state: ExtractionState;

  /**
   * 抽出結果を処理して各フォームに反映するデータを生成する。
   * バリデーションも実行し、警告を state に保存する。
   */
  processExtraction: (data: KeishinPdfResult) => ProcessedExtraction;

  /** フィールドのデータソースを取得 */
  getFieldSource: (fieldName: string) => DataSource;

  /** フィールドが自動入力されたかどうか */
  isAutoFilled: (fieldName: string) => boolean;

  /** フィールドがユーザーに上書きされたかどうか */
  isUserOverridden: (fieldName: string) => boolean;

  /** ユーザーがフィールドを手動編集したことを記録する */
  markUserEdited: (fieldName: string) => void;

  /** バリデーション警告を取得 */
  getWarnings: () => ValidationIssue[];

  /** 抽出状態をリセット */
  reset: () => void;
}

/** processExtraction が返す処理済みデータ */
export interface ProcessedExtraction {
  /** Step 2 基本情報 */
  basicInfo: {
    companyName: string;
    permitNumber: string;
    reviewBaseDate: string;
    periodNumber: string;
  };
  /** 自己資本額 */
  equity: number;
  /** EBITDA */
  ebitda: number;
  /** 業種データ（正規化済み） */
  industries: Array<{
    name: string;
    permitType: '特定' | '一般';
    prevCompletion: string;
    currCompletion: string;
    prevPrevCompletion: string;
    prevSubcontract: string;
    currSubcontract: string;
    techStaffValue: string;
  }>;
  /** W項目（バリデーション済み） */
  wItems: Partial<SocialItems>;
  /** 技術職員リスト */
  staffList: KeishinPdfResult['staffList'];
  /** バリデーション結果 */
  validationIssues: ValidationIssue[];
  /** 自動入力されたフィールド名セット */
  autoFilledFields: Set<string>;
}

// ─── 初期状態 ───

function initialState(): ExtractionState {
  return {
    rawData: null,
    fieldMeta: {},
    validationIssues: [],
    isExtracted: false,
  };
}

// ─── フック本体 ───

export function useExtractedData(): UseExtractedDataReturn {
  const [state, setState] = useState<ExtractionState>(initialState);
  const fieldMetaRef = useRef<Record<string, FieldMeta>>({});

  const setFieldMeta = useCallback((field: string, source: DataSource, userOverridden = false) => {
    const meta: FieldMeta = {
      source,
      timestamp: Date.now(),
      userOverridden,
    };
    fieldMetaRef.current = { ...fieldMetaRef.current, [field]: meta };
  }, []);

  const processExtraction = useCallback((data: KeishinPdfResult): ProcessedExtraction => {
    // バリデーション実行
    const validation = validateExtractedData(data);
    const autoFilledFields = new Set<string>();
    const newFieldMeta: Record<string, FieldMeta> = {};

    const now = Date.now();

    // 基本情報（バリデーション済みを優先、未検証フィールドは raw から補完）
    const basicInfo = {
      companyName: validation.validatedBasicInfo.companyName ?? data.basicInfo.companyName ?? '',
      permitNumber: validation.validatedBasicInfo.permitNumber ?? data.basicInfo.permitNumber ?? '',
      reviewBaseDate: validation.validatedBasicInfo.reviewBaseDate ?? data.basicInfo.reviewBaseDate ?? '',
      periodNumber: validation.validatedBasicInfo.periodNumber ?? data.basicInfo.periodNumber ?? '',
    };
    for (const [key, value] of Object.entries(basicInfo)) {
      if (value) {
        const fieldKey = `basicInfo.${key}`;
        autoFilledFields.add(fieldKey);
        newFieldMeta[fieldKey] = { source: 'direct_pdf', timestamp: now, userOverridden: false };
      }
    }

    // 財務データ
    if (data.equity !== undefined && data.equity !== null) {
      autoFilledFields.add('equity');
      newFieldMeta.equity = { source: 'direct_pdf', timestamp: now, userOverridden: false };
    }
    if (data.ebitda !== undefined && data.ebitda !== null) {
      autoFilledFields.add('ebitda');
      newFieldMeta.ebitda = { source: 'direct_pdf', timestamp: now, userOverridden: false };
    }

    // 業種データ（正規化済み）
    const industries = data.industries.map((ind) => {
      const normalizedName = normalizeIndustryName(ind.name);
      return {
        name: normalizedName,
        permitType: '一般' as const,
        prevCompletion: String(ind.prevCompletion),
        currCompletion: String(ind.currCompletion),
        prevPrevCompletion: '',
        prevSubcontract: String(ind.prevCompletion - ind.prevPrimeContract),
        currSubcontract: String(ind.currCompletion - ind.currPrimeContract),
        techStaffValue: ind.techStaffValue ? String(ind.techStaffValue) : '',
      };
    });
    if (industries.length > 0) {
      autoFilledFields.add('industries');
      newFieldMeta.industries = { source: 'direct_pdf', timestamp: now, userOverridden: false };
      // permitType is always defaulted to '一般' - warn user to verify
      validation.issues.push({
        field: 'industries.permitType',
        label: '許可区分',
        severity: 'info',
        message: '許可区分はデフォルトで「一般」に設定されています。特定建設業許可をお持ちの業種がある場合は手動で変更してください。',
        originalValue: '一般',
      });
    }

    // W項目（バリデーション済み）
    // validatedWItems をベースにし、バリデーション対象外のフィールドのみ raw から補完
    const wItems: Partial<SocialItems> = { ...validation.validatedWItems };

    // バリデーション対象外のフィールドを raw から補完
    for (const [key, value] of Object.entries(data.wItems ?? {})) {
      if (!(key in wItems) && value !== undefined && value !== null) {
        (wItems as Record<string, unknown>)[key] = value;
      }
    }

    // techStaffCount と businessYears をトップレベルからマージ
    if (data.techStaffCount > 0 && !wItems.techStaffCount) {
      wItems.techStaffCount = data.techStaffCount;
    }
    if (data.businessYears > 0) {
      // 大きい方を採用
      const wBusiness = wItems.businessYears ?? 0;
      wItems.businessYears = Math.max(data.businessYears, wBusiness);
    }

    // W項目のフィールドメタ追跡
    for (const [key, value] of Object.entries(wItems)) {
      if (value !== undefined && value !== null && value !== 0 && value !== false) {
        autoFilledFields.add(`wItems.${key}`);
        newFieldMeta[`wItems.${key}`] = { source: 'direct_pdf', timestamp: now, userOverridden: false };
      }
    }

    // 技術職員リスト
    const staffList = data.staffList;
    if (staffList && staffList.length > 0) {
      autoFilledFields.add('staffList');
      newFieldMeta.staffList = { source: 'direct_pdf', timestamp: now, userOverridden: false };
    }

    // 状態更新
    fieldMetaRef.current = newFieldMeta;
    setState({
      rawData: data,
      fieldMeta: newFieldMeta,
      validationIssues: validation.issues,
      isExtracted: true,
    });

    return {
      basicInfo,
      equity: data.equity,
      ebitda: data.ebitda,
      industries,
      wItems,
      staffList,
      validationIssues: validation.issues,
      autoFilledFields,
    };
  }, []);

  const getFieldSource = useCallback((fieldName: string): DataSource => {
    return fieldMetaRef.current[fieldName]?.source ?? null;
  }, []);

  const isAutoFilled = useCallback((fieldName: string): boolean => {
    const meta = fieldMetaRef.current[fieldName];
    return meta ? (meta.source === 'direct_pdf' || meta.source === 'derived_from_pdf') && !meta.userOverridden : false;
  }, []);

  const isUserOverridden = useCallback((fieldName: string): boolean => {
    return fieldMetaRef.current[fieldName]?.userOverridden ?? false;
  }, []);

  const markUserEdited = useCallback((fieldName: string) => {
    const existing = fieldMetaRef.current[fieldName];
    if (existing) {
      fieldMetaRef.current = {
        ...fieldMetaRef.current,
        [fieldName]: { ...existing, source: 'user_input', userOverridden: true },
      };
    } else {
      setFieldMeta(fieldName, 'user_input', true);
    }
  }, [setFieldMeta]);

  const getWarnings = useCallback((): ValidationIssue[] => {
    return state.validationIssues;
  }, [state.validationIssues]);

  const reset = useCallback(() => {
    fieldMetaRef.current = {};
    setState(initialState());
  }, []);

  return {
    state,
    processExtraction,
    getFieldSource,
    isAutoFilled,
    isUserOverridden,
    markUserEdited,
    getWarnings,
    reset,
  };
}
