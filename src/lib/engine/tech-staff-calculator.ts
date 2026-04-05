/**
 * 技術職員数値の決定的計算エンジン
 *
 * Gemini（AI）は PDFから生データを抽出するだけ。
 * 点数の決定・集計はすべてこのモジュールで行う。
 *
 * 計算ルール（経審 Z1 の基礎）:
 *   6点 = 1級 + 監理技術者講習受講 + 監理技術者資格者証
 *   5点 = 1級
 *   4点 = 監理技術者補佐（1級技士補）
 *   3点 = 登録基幹技能者 / 能力評価レベル4技能者
 *   2点 = 2級
 *   1点 = その他
 *
 *   - 1人は最大2業種まで計上可能
 *   - 同一人物・同一業種で複数資格がある場合、最高点のみ採用
 */

import {
  getQualificationByCode,
  type QualificationCodeEntry,
} from './qualification-codes';

// ─── 入力型 ───

/** Geminiが抽出した1人分の生データ */
export interface ExtractedStaffMember {
  /** 氏名 */
  name: string;
  /** 1つ目の業種コード（2桁） */
  industryCode1?: string;
  /** 1つ目の有資格区分コード */
  qualificationCode1?: number;
  /** 1つ目の講習受講フラグ（1=受講済, 2=未受講, 0/undefined=不明） */
  lectureFlag1?: number;
  /** 2つ目の業種コード（2桁、任意） */
  industryCode2?: string;
  /** 2つ目の有資格区分コード（任意） */
  qualificationCode2?: number;
  /** 2つ目の講習受講フラグ（任意） */
  lectureFlag2?: number;
  /** 監理技術者資格者証の交付番号（あれば文字列） */
  supervisorCertNumber?: string;
}

// ─── 出力型 ───

/** 1人×1業種の計算結果 */
export interface StaffIndustryResult {
  name: string;
  industryCode: string;
  qualificationCode: number;
  qualificationName: string;
  grade: string;
  basePoints: number;
  effectivePoints: number;
  supervisorUpgrade: boolean;
}

/** 計算全体の結果 */
export interface TechStaffCalcResult {
  /** 業種コード → 技術職員数値（点数合計） */
  industryTotals: Record<string, number>;
  /** 全技術職員の人数 */
  totalStaffCount: number;
  /** 詳細（デバッグ・監査用） */
  details: StaffIndustryResult[];
}

// ─── 計算ロジック ───

/**
 * 資格コードと監理技術者条件から、実効ポイントを決定する
 */
export function resolveEffectivePoints(
  qualEntry: QualificationCodeEntry,
  lectureFlag: number | undefined,
  hasSupervisorCert: boolean,
): { points: number; supervisorUpgrade: boolean } {
  const base = qualEntry.basePoints;

  // 監理技術者への昇格: 1級 + 講習受講(1) + 監理技術者資格者証
  if (
    qualEntry.canUpgradeToSupervisor &&
    lectureFlag === 1 &&
    hasSupervisorCert
  ) {
    return { points: 6, supervisorUpgrade: true };
  }

  return { points: base, supervisorUpgrade: false };
}

/**
 * 技術職員リストから業種別の技術職員数値を決定的に計算する
 *
 * @param staffList Geminiが抽出した生データの配列
 * @returns 業種別合計と詳細
 */
export function calculateTechStaffValues(
  staffList: ExtractedStaffMember[],
): TechStaffCalcResult {
  const details: StaffIndustryResult[] = [];

  // 同一人物・同一業種の最高点を追跡する
  // key = "名前::業種コード" → 最高ポイント
  const personIndustryMax = new Map<string, {
    points: number;
    detail: StaffIndustryResult;
  }>();

  for (let idx = 0; idx < staffList.length; idx++) {
    const member = staffList[idx];
    const hasCert = !!member.supervisorCertNumber;

    // Dedup key uses row index to distinguish different employees with the same name.
    // Also includes qualificationCodes as secondary disambiguation for merged data
    // where row index may not be stable.
    const personId = `${member.name}::${idx}::${member.qualificationCode1 ?? ''}::${member.qualificationCode2 ?? ''}`;

    // 業種1
    if (member.industryCode1 && member.qualificationCode1) {
      const indCode = member.industryCode1.padStart(2, '0');
      const qualEntry = getQualificationByCode(member.qualificationCode1);
      const { points, supervisorUpgrade } = resolveEffectivePoints(
        qualEntry,
        member.lectureFlag1,
        hasCert,
      );

      const detail: StaffIndustryResult = {
        name: member.name,
        industryCode: indCode,
        qualificationCode: member.qualificationCode1,
        qualificationName: qualEntry.name,
        grade: supervisorUpgrade ? '1級+監理' : qualEntry.grade,
        basePoints: qualEntry.basePoints,
        effectivePoints: points,
        supervisorUpgrade,
      };

      const key = `${personId}::${indCode}`;
      const existing = personIndustryMax.get(key);
      if (!existing || points > existing.points) {
        personIndustryMax.set(key, { points, detail });
      }
    }

    // 業種2（任意）
    if (member.industryCode2 && member.qualificationCode2) {
      const indCode = member.industryCode2.padStart(2, '0');
      const qualEntry = getQualificationByCode(member.qualificationCode2);
      const { points, supervisorUpgrade } = resolveEffectivePoints(
        qualEntry,
        member.lectureFlag2,
        hasCert,
      );

      const detail: StaffIndustryResult = {
        name: member.name,
        industryCode: indCode,
        qualificationCode: member.qualificationCode2,
        qualificationName: qualEntry.name,
        grade: supervisorUpgrade ? '1級+監理' : qualEntry.grade,
        basePoints: qualEntry.basePoints,
        effectivePoints: points,
        supervisorUpgrade,
      };

      const key = `${personId}::${indCode}`;
      const existing = personIndustryMax.get(key);
      if (!existing || points > existing.points) {
        personIndustryMax.set(key, { points, detail });
      }
    }
  }

  // 業種別に集計
  const industryTotals: Record<string, number> = {};

  for (const { points, detail } of Array.from(personIndustryMax.values())) {
    details.push(detail);
    industryTotals[detail.industryCode] =
      (industryTotals[detail.industryCode] ?? 0) + points;
  }

  // 1人が2業種まで計上可能だが、ユニークな人名で人数カウント
  const uniqueNames = new Set(staffList.map((s) => s.name));

  return {
    industryTotals,
    totalStaffCount: uniqueNames.size,
    details,
  };
}

/**
 * 旧フォーマット（score-tables.ts の calculateTechStaffValueByIndustry 互換）
 * から新フォーマットへの変換ヘルパー
 *
 * 既存の TechnicalStaff 型を ExtractedStaffMember に変換する
 */
export function convertLegacyStaffToExtracted(
  legacyStaff: Array<{
    name: string;
    industryCode1: number;
    qualificationCode1: number;
    lectureFlag1: number;
    industryCode2?: number;
    qualificationCode2?: number;
    lectureFlag2?: number;
    supervisorCertNumber?: string;
  }>,
): ExtractedStaffMember[] {
  return legacyStaff.map((s) => ({
    name: s.name,
    industryCode1: s.industryCode1 ? String(s.industryCode1).padStart(2, '0') : undefined,
    qualificationCode1: s.qualificationCode1 || undefined,
    lectureFlag1: s.lectureFlag1,
    industryCode2: s.industryCode2 ? String(s.industryCode2).padStart(2, '0') : undefined,
    qualificationCode2: s.qualificationCode2 || undefined,
    lectureFlag2: s.lectureFlag2,
    supervisorCertNumber: s.supervisorCertNumber,
  }));
}
