/**
 * 抽出データバリデーション
 *
 * Gemini PDF 抽出結果をフォームに反映する前に、
 * 値の妥当性を検証し、警告を生成する。
 */

import type { KeishinPdfResult } from './keishin-pdf-parser';
import { normalizeAuditStatusValue } from './audit-status-utils';
import type { SocialItems } from './engine/types';
import { W_ITEMS_MAPPINGS, getNestedValue } from './extraction-field-map';

// ─── 警告レベル ───

export type ValidationSeverity = 'error' | 'warning' | 'info';

export interface ValidationIssue {
  field: string;
  label: string;
  severity: ValidationSeverity;
  message: string;
  /** 元の値 */
  originalValue: unknown;
  /** 修正提案（あれば） */
  suggestedValue?: unknown;
}

export interface ValidationResult {
  isValid: boolean;
  issues: ValidationIssue[];
  /** バリデーション通過したW項目 */
  validatedWItems: Partial<SocialItems>;
  /** バリデーション通過した基本情報 */
  validatedBasicInfo: Partial<KeishinPdfResult['basicInfo']>;
}

// ─── メインバリデーション関数 ───

export function validateExtractedData(data: KeishinPdfResult): ValidationResult {
  const issues: ValidationIssue[] = [];
  const validatedWItems: Partial<SocialItems> = {};
  const validatedBasicInfo: Partial<KeishinPdfResult['basicInfo']> = {};

  // 基本情報バリデーション
  validateBasicInfo(data, issues, validatedBasicInfo);

  // 財務データバリデーション
  validateFinancialData(data, issues);

  // 業種データバリデーション
  validateIndustryData(data, issues);

  // W項目バリデーション
  validateWItems(data, issues, validatedWItems);

  // 技術職員バリデーション
  validateTechStaff(data, issues);

  // クロスフィールドチェック
  validateCrossField(data, issues);

  const hasErrors = issues.some((i) => i.severity === 'error');

  return {
    isValid: !hasErrors,
    issues,
    validatedWItems,
    validatedBasicInfo,
  };
}

// ─── 基本情報 ───

function validateBasicInfo(
  data: KeishinPdfResult,
  issues: ValidationIssue[],
  validated: Partial<KeishinPdfResult['basicInfo']>,
): void {
  const { basicInfo } = data;

  if (basicInfo.companyName) {
    validated.companyName = basicInfo.companyName;
  } else {
    issues.push({
      field: 'basicInfo.companyName',
      label: '会社名',
      severity: 'warning',
      message: '会社名が抽出されませんでした',
      originalValue: '',
    });
  }

  if (basicInfo.permitNumber) {
    validated.permitNumber = basicInfo.permitNumber;
  }

  if (basicInfo.reviewBaseDate) {
    // 日付形式チェック（YYYY-MM-DD or YYYY/MM/DD）
    const dateMatch = basicInfo.reviewBaseDate.match(/\d{4}[/-]\d{1,2}[/-]\d{1,2}/);
    if (dateMatch) {
      validated.reviewBaseDate = basicInfo.reviewBaseDate;
    } else {
      issues.push({
        field: 'basicInfo.reviewBaseDate',
        label: '審査基準日',
        severity: 'warning',
        message: `審査基準日の形式が不正です: ${basicInfo.reviewBaseDate}`,
        originalValue: basicInfo.reviewBaseDate,
      });
      // それでもセットする（ユーザーが修正可能）
      validated.reviewBaseDate = basicInfo.reviewBaseDate;
    }
  }

  if (basicInfo.periodNumber) {
    validated.periodNumber = basicInfo.periodNumber;
  }
}

// ─── 財務データ ───

function validateFinancialData(
  data: KeishinPdfResult,
  issues: ValidationIssue[],
): void {
  // 自己資本額
  if (data.equity !== 0) {
    if (data.equity > 10_000_000) {
      issues.push({
        field: 'equity',
        label: '自己資本額',
        severity: 'warning',
        message: `自己資本額が非常に大きい値です: ${data.equity.toLocaleString()}千円（${(data.equity / 1000).toLocaleString()}百万円）。単位を確認してください。`,
        originalValue: data.equity,
      });
    }
    if (data.equity < -1_000_000) {
      issues.push({
        field: 'equity',
        label: '自己資本額',
        severity: 'info',
        message: `自己資本額が大きな負の値です: ${data.equity.toLocaleString()}千円。債務超過の場合は問題ありません。`,
        originalValue: data.equity,
      });
    }
  }

  // EBITDA
  if (data.ebitda !== 0 && Math.abs(data.ebitda) > 10_000_000) {
    issues.push({
      field: 'ebitda',
      label: '利払前税引前償却前利益',
      severity: 'warning',
      message: `EBITDAが非常に大きい値です: ${data.ebitda.toLocaleString()}千円。単位を確認してください。`,
      originalValue: data.ebitda,
    });
  }
}

// ─── 業種データ ───

function validateIndustryData(
  data: KeishinPdfResult,
  issues: ValidationIssue[],
): void {
  if (data.industries.length === 0) {
    issues.push({
      field: 'industries',
      label: '業種別完成工事高',
      severity: 'warning',
      message: '業種が1つも抽出されませんでした。手入力してください。',
      originalValue: [],
    });
    return;
  }

  for (const ind of data.industries) {
    // 当期完工高が0で前期もある場合
    if (ind.currCompletion === 0 && ind.prevCompletion > 0) {
      issues.push({
        field: `industry.${ind.code}.currCompletion`,
        label: `${ind.name} 当期完成工事高`,
        severity: 'info',
        message: `${ind.name}の当期完工高が0ですが前期は${ind.prevCompletion.toLocaleString()}千円です。意図した値か確認してください。`,
        originalValue: ind.currCompletion,
      });
    }

    // 元請完工高 > 完工高のチェック
    if (ind.currPrimeContract > ind.currCompletion && ind.currCompletion > 0) {
      issues.push({
        field: `industry.${ind.code}.currPrimeContract`,
        label: `${ind.name} 当期元請完工高`,
        severity: 'warning',
        message: `${ind.name}の元請完工高(${ind.currPrimeContract.toLocaleString()})が完工高(${ind.currCompletion.toLocaleString()})を超えています。`,
        originalValue: ind.currPrimeContract,
        suggestedValue: ind.currCompletion,
      });
    }
  }

  // 業種名重複チェック
  const names = data.industries.map((i) => i.name);
  const duplicates = names.filter((n, i) => names.indexOf(n) !== i);
  if (duplicates.length > 0) {
    issues.push({
      field: 'industries',
      label: '業種',
      severity: 'warning',
      message: `重複する業種名があります: ${[...new Set(duplicates)].join(', ')}`,
      originalValue: duplicates,
    });
  }
}

// ─── W項目 ───

function validateWItems(
  data: KeishinPdfResult,
  issues: ValidationIssue[],
  validated: Partial<SocialItems>,
): void {
  const wItems = data.wItems;
  if (!wItems || Object.keys(wItems).length === 0) {
    issues.push({
      field: 'wItems',
      label: 'W項目',
      severity: 'info',
      message: 'W項目が抽出されませんでした。Step 3で手入力してください。',
      originalValue: {},
    });
    return;
  }

  // 各W項目をバリデーション
  for (const mapping of W_ITEMS_MAPPINGS) {
    const value = getNestedValue(
      data as unknown as Record<string, unknown>,
      mapping.extractionPath,
    );

    if (value === undefined || value === null) continue;

    const key = mapping.formTarget as keyof SocialItems;
    const { validation } = mapping;

    if (mapping.type === 'boolean') {
      if (typeof value === 'boolean') {
        (validated as Record<string, unknown>)[key] = value;
      } else if (typeof value === 'number') {
        // Gemini が 0/1 を返す場合がある
        (validated as Record<string, unknown>)[key] = value !== 0;
      } else if (typeof value === 'string') {
        // Gemini が "true"/"false" を文字列で返す場合がある
        const lower = value.toLowerCase().trim();
        if (lower === 'true' || lower === '1' || lower === '有' || lower === 'yes') {
          (validated as Record<string, unknown>)[key] = true;
        } else if (lower === 'false' || lower === '0' || lower === '無' || lower === 'no' || lower === '') {
          (validated as Record<string, unknown>)[key] = false;
        } else {
          issues.push({
            field: mapping.formTarget,
            label: mapping.label,
            severity: 'warning',
            message: `${mapping.label}の値が不正です（boolean期待、実際: "${value}"）`,
            originalValue: value,
          });
        }
      } else {
        issues.push({
          field: mapping.formTarget,
          label: mapping.label,
          severity: 'warning',
          message: `${mapping.label}の値が不正です（boolean期待、実際: ${typeof value}）`,
          originalValue: value,
        });
      }
    } else if (mapping.type === 'number') {
      // auditStatus は特別処理: テキストラベルや全角数字にも対応
      if (key === 'auditStatus') {
        const normalized = normalizeAuditStatusValue(value);
        (validated as Record<string, unknown>)[key] = normalized;
        continue;
      }

      const numVal = Number(value);
      if (isNaN(numVal)) {
        issues.push({
          field: mapping.formTarget,
          label: mapping.label,
          severity: 'warning',
          message: `${mapping.label}が数値に変換できません: ${value}`,
          originalValue: value,
        });
        continue;
      }

      if (validation?.min !== undefined && numVal < validation.min) {
        issues.push({
          field: mapping.formTarget,
          label: mapping.label,
          severity: 'warning',
          message: `${mapping.label}が最小値(${validation.min})未満: ${numVal}`,
          originalValue: numVal,
          suggestedValue: validation.min,
        });
        continue;
      }
      if (validation?.max !== undefined && numVal > validation.max) {
        issues.push({
          field: mapping.formTarget,
          label: mapping.label,
          severity: 'warning',
          message: `${mapping.label}が最大値(${validation.max})超過: ${numVal}`,
          originalValue: numVal,
          suggestedValue: validation.max,
        });
        continue;
      }

      (validated as Record<string, unknown>)[key] = numVal;
    }
  }
}

// ─── 技術職員 ───

function validateTechStaff(
  data: KeishinPdfResult,
  issues: ValidationIssue[],
): void {
  if (data.staffList && data.staffList.length > 0) {
    // 名前なしのエントリをチェック
    const noName = data.staffList.filter((s) => !s.name);
    if (noName.length > 0) {
      issues.push({
        field: 'staffList',
        label: '技術職員名簿',
        severity: 'info',
        message: `氏名なしの技術職員が${noName.length}名います。PDFの読み取りを確認してください。`,
        originalValue: noName.length,
      });
    }

    // 資格コードなしのエントリ
    const noQual = data.staffList.filter(
      (s) => !s.qualificationCode1 && !s.qualificationCode2,
    );
    if (noQual.length > 0) {
      issues.push({
        field: 'staffList',
        label: '技術職員名簿',
        severity: 'info',
        message: `資格コードなしの技術職員が${noQual.length}名います。`,
        originalValue: noQual.length,
      });
    }
  }

  // techStaffCount と staffList の不整合
  if (data.staffList && data.staffList.length > 0 && data.techStaffCount > 0) {
    const diff = Math.abs(data.techStaffCount - data.staffList.length);
    if (diff > 2) {
      issues.push({
        field: 'techStaffCount',
        label: '技術職員数',
        severity: 'warning',
        message: `技術職員数(${data.techStaffCount})と名簿エントリ数(${data.staffList.length})が一致しません（差: ${diff}）。`,
        originalValue: data.techStaffCount,
        suggestedValue: data.staffList.length,
      });
    }
  }
}

// ─── クロスフィールドチェック ───

function validateCrossField(
  data: KeishinPdfResult,
  issues: ValidationIssue[],
): void {
  const wItems = data.wItems;

  // youngTechCount <= techStaffCount
  if (wItems.youngTechCount && wItems.techStaffCount) {
    if (wItems.youngTechCount > wItems.techStaffCount) {
      issues.push({
        field: 'youngTechCount',
        label: '若年技術職員数',
        severity: 'warning',
        message: `若年技術職員数(${wItems.youngTechCount})が技術職員数合計(${wItems.techStaffCount})を超えています。`,
        originalValue: wItems.youngTechCount,
        suggestedValue: wItems.techStaffCount,
      });
    }
  }

  // newYoungTechCount <= youngTechCount
  if (wItems.newYoungTechCount && wItems.youngTechCount) {
    if (wItems.newYoungTechCount > wItems.youngTechCount) {
      issues.push({
        field: 'newYoungTechCount',
        label: '新規若年技術職員数',
        severity: 'info',
        message: `新規若年技術職員数(${wItems.newYoungTechCount})が若年技術職員数(${wItems.youngTechCount})を超えています。`,
        originalValue: wItems.newYoungTechCount,
      });
    }
  }

  // skilledWorkerCount >= deductionTargetCount
  if (wItems.deductionTargetCount && wItems.skilledWorkerCount) {
    if (wItems.deductionTargetCount > wItems.skilledWorkerCount) {
      issues.push({
        field: 'deductionTargetCount',
        label: '控除対象者数',
        severity: 'warning',
        message: `控除対象者数(${wItems.deductionTargetCount})が技能者数(${wItems.skilledWorkerCount})を超えています。`,
        originalValue: wItems.deductionTargetCount,
        suggestedValue: wItems.skilledWorkerCount,
      });
    }
  }

  // 営業年数（トップレベルとwItems両方）の一致
  if (data.businessYears > 0 && wItems.businessYears && wItems.businessYears > 0) {
    if (data.businessYears !== wItems.businessYears) {
      issues.push({
        field: 'businessYears',
        label: '営業年数',
        severity: 'info',
        message: `営業年数がソースにより異なります（基本情報: ${data.businessYears}年、W項目: ${wItems.businessYears}年）。大きい方を採用します。`,
        originalValue: data.businessYears,
        suggestedValue: Math.max(data.businessYears, wItems.businessYears),
      });
    }
  }
}
