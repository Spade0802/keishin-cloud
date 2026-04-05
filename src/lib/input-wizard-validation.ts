/**
 * Pure validation and helper functions extracted from input-wizard.tsx
 * for testability and reuse.
 */
import type { SocialItems } from '@/lib/engine/types';

// ---- Financial field warning ----

export type FieldWarning = { message: string; level: 'warning' | 'info' };

export const LARGE_VALUE_THRESHOLD = 10_000_000; // 100億 = 10,000,000千円

export function getFinancialFieldWarning(
  label: string,
  value: string,
  opts?: { allowNegative?: boolean; mustBePositive?: boolean }
): FieldWarning | null {
  const n = parseFloat(value);
  if (!value || isNaN(n)) return null;

  if (opts?.mustBePositive && n < 0) {
    return { message: 'この項目は正の値である必要があります', level: 'warning' };
  }
  if (!opts?.allowNegative && n < 0) {
    return { message: '負の値が入力されています。正しいか確認してください', level: 'warning' };
  }
  if (Math.abs(n) > LARGE_VALUE_THRESHOLD) {
    return { message: '単位確認: 100億円超の値です。千円単位で入力してください', level: 'warning' };
  }
  return null;
}

// ---- Industry duplicate detection ----

export function detectIndustryDuplicate(
  industries: Array<{ name: string }>,
  index: number,
  newName: string
): boolean {
  if (!newName) return false;
  return industries.some((ind, i) => i !== index && ind.name === newName);
}

// ---- Industry-based W-item smart defaults ----

export const INDUSTRY_W_DEFAULTS: Record<string, Partial<SocialItems>> = {
  '土木一式工事': {
    disasterAgreement: true,
    constructionMachineCount: 1,
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    constructionRetirementMutualAid: true,
  },
  '建築一式工事': {
    iso9001: true,
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    constructionRetirementMutualAid: true,
  },
  '電気工事': {
    nonStatutoryAccidentInsurance: true,
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
  },
  '管工事': {
    nonStatutoryAccidentInsurance: true,
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
  },
  '舗装工事': {
    disasterAgreement: true,
    constructionMachineCount: 1,
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
  },
  '鋼構造物工事': {
    iso9001: true,
    nonStatutoryAccidentInsurance: true,
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
  },
  '解体工事': {
    nonStatutoryAccidentInsurance: true,
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
  },
};

export function getIndustryWDefaults(industryNames: string[]): Partial<SocialItems> {
  const merged: Partial<SocialItems> = {};
  for (const name of industryNames) {
    const defaults = INDUSTRY_W_DEFAULTS[name];
    if (defaults) {
      for (const [key, value] of Object.entries(defaults)) {
        const k = key as keyof SocialItems;
        const existing = merged[k];
        if (typeof value === 'boolean') {
          // For booleans, true wins (union of recommendations)
          if (value || !existing) (merged as Record<string, unknown>)[k] = value;
        } else if (typeof value === 'number') {
          // For numbers, take the max
          (merged as Record<string, unknown>)[k] = Math.max(value, (existing as number) || 0);
        }
      }
    }
  }
  return merged;
}
