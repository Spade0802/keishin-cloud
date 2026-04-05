/**
 * 評点換算テーブル
 *
 * 各テーブルは { min, max, a, b, c } のブラケット配列。
 * 評点 = Math.floor(a * value / b) + c
 *
 * value は千円単位（切捨て済み）。
 * ★最重要コンポーネント。テーブルの不完全さがP点ズレの最大原因。
 */

export interface Bracket {
  min: number; // 千円（この値以上）
  max: number; // 千円（この値未満。最終ブラケットはInfinity）
  a: number;
  b: number;
  c: number;
}

export function lookupScore(brackets: Bracket[], value: number): number {
  const bracket = brackets.find((b) => value >= b.min && value < b.max);
  if (!bracket) {
    throw new Error(
      `評点テーブルの該当区間が見つかりません（値: ${value}、範囲: ${brackets[0]?.min ?? '?'} - ${brackets[brackets.length - 1]?.max ?? '?'}）`
    );
  }
  return Math.floor((bracket.a * value) / bracket.b) + bracket.c;
}

// X1テーブル（完成工事高→X1評点）
export const X1_TABLE: Bracket[] = [
  { min: 0, max: 10000, a: 131, b: 10000, c: 397 },
  { min: 10000, max: 12000, a: 11, b: 2000, c: 473 },
  { min: 12000, max: 15000, a: 14, b: 3000, c: 483 },
  { min: 15000, max: 20000, a: 20, b: 5000, c: 493 },
  { min: 20000, max: 25000, a: 16, b: 5000, c: 509 },
  { min: 25000, max: 30000, a: 13, b: 5000, c: 524 },
  { min: 30000, max: 40000, a: 24, b: 10000, c: 530 },
  { min: 40000, max: 50000, a: 19, b: 10000, c: 550 },
  { min: 50000, max: 60000, a: 16, b: 10000, c: 565 },
  { min: 60000, max: 80000, a: 28, b: 20000, c: 577 },
  { min: 80000, max: 100000, a: 22, b: 20000, c: 601 },
  { min: 100000, max: 120000, a: 19, b: 20000, c: 616 },
  { min: 120000, max: 150000, a: 26, b: 30000, c: 626 },
  { min: 150000, max: 200000, a: 34, b: 50000, c: 654 },
  { min: 200000, max: 250000, a: 28, b: 50000, c: 678 },
  { min: 250000, max: 300000, a: 24, b: 50000, c: 698 },
  { min: 300000, max: 400000, a: 42, b: 100000, c: 716 },
  { min: 400000, max: 500000, a: 34, b: 100000, c: 748 },
  { min: 500000, max: 600000, a: 25, b: 100000, c: 793 },
  { min: 600000, max: 800000, a: 25, b: 200000, c: 868 },
  { min: 800000, max: 1000000, a: 38, b: 200000, c: 816 },
  { min: 1000000, max: 1200000, a: 39, b: 200000, c: 811 },
  { min: 1200000, max: 1500000, a: 38, b: 300000, c: 893 },
  { min: 1500000, max: 2000000, a: 36, b: 500000, c: 975 },
  { min: 2000000, max: 2500000, a: 39, b: 500000, c: 963 },
  { min: 2500000, max: 3000000, a: 51, b: 500000, c: 903 },
  { min: 3000000, max: 4000000, a: 50, b: 1000000, c: 1059 },
  { min: 4000000, max: 5000000, a: 51, b: 1000000, c: 1055 },
  { min: 5000000, max: 6000000, a: 51, b: 1000000, c: 1055 },
  { min: 6000000, max: 8000000, a: 50, b: 2000000, c: 1211 },
  { min: 8000000, max: 10000000, a: 64, b: 2000000, c: 1155 },
  { min: 10000000, max: 12000000, a: 51, b: 2000000, c: 1311 },
  { min: 12000000, max: 15000000, a: 51, b: 3000000, c: 1413 },
  { min: 15000000, max: 20000000, a: 50, b: 5000000, c: 1519 },
  { min: 20000000, max: 25000000, a: 50, b: 5000000, c: 1519 },
  { min: 25000000, max: 30000000, a: 51, b: 5000000, c: 1516 },
  { min: 30000000, max: 50000000, a: 50, b: 20000000, c: 1823 },
  { min: 50000000, max: 100000000, a: 50, b: 50000000, c: 1898 },
  { min: 100000000, max: Infinity, a: 0, b: 1, c: 1998 },
];

// X21テーブル（自己資本額→X21評点）
// ★ min=-Infinity で大幅債務超過にも対応（0点とする）
export const X21_TABLE: Bracket[] = [
  { min: -Infinity, max: 0, a: 0, b: 1, c: 0 },
  { min: 0, max: 10000, a: 223, b: 10000, c: 361 },
  { min: 10000, max: 12000, a: 8, b: 2000, c: 544 },
  { min: 12000, max: 15000, a: 11, b: 3000, c: 548 },
  { min: 15000, max: 20000, a: 14, b: 5000, c: 561 },
  { min: 20000, max: 25000, a: 12, b: 5000, c: 569 },
  { min: 25000, max: 30000, a: 10, b: 5000, c: 579 },
  { min: 30000, max: 40000, a: 16, b: 10000, c: 591 },
  { min: 40000, max: 50000, a: 14, b: 10000, c: 599 },
  { min: 50000, max: 60000, a: 11, b: 10000, c: 614 },
  { min: 60000, max: 80000, a: 19, b: 20000, c: 623 },
  { min: 80000, max: 100000, a: 16, b: 20000, c: 635 },
  { min: 100000, max: 120000, a: 13, b: 20000, c: 650 },
  { min: 120000, max: 150000, a: 16, b: 30000, c: 664 },
  { min: 150000, max: 200000, a: 23, b: 50000, c: 675 },
  { min: 200000, max: 250000, a: 19, b: 50000, c: 691 },
  { min: 250000, max: 300000, a: 15, b: 50000, c: 711 },
  { min: 300000, max: 400000, a: 26, b: 100000, c: 723 },
  { min: 400000, max: 500000, a: 22, b: 100000, c: 745 },
  { min: 500000, max: 600000, a: 18, b: 100000, c: 767 },
  { min: 600000, max: 800000, a: 28, b: 200000, c: 790 },
  { min: 800000, max: 1000000, a: 23, b: 200000, c: 810 },
  { min: 1000000, max: Infinity, a: 0, b: 1, c: 902 },
];

// X22テーブル（EBITDA→X22評点）
// ★ min=-Infinity で大幅赤字にも対応（0点とする）
export const X22_TABLE: Bracket[] = [
  { min: -Infinity, max: 0, a: 0, b: 1, c: 0 },
  { min: 0, max: 10000, a: 78, b: 10000, c: 547 },
  { min: 10000, max: 12000, a: 6, b: 2000, c: 595 },
  { min: 12000, max: 15000, a: 7, b: 3000, c: 603 },
  { min: 15000, max: 20000, a: 11, b: 5000, c: 605 },
  { min: 20000, max: 25000, a: 10, b: 5000, c: 609 },
  { min: 25000, max: 30000, a: 8, b: 5000, c: 619 },
  { min: 30000, max: 40000, a: 15, b: 10000, c: 622 },
  { min: 40000, max: 50000, a: 12, b: 10000, c: 634 },
  { min: 50000, max: 60000, a: 12, b: 10000, c: 634 },
  { min: 60000, max: 80000, a: 19, b: 20000, c: 649 },
  { min: 80000, max: 100000, a: 16, b: 20000, c: 661 },
  { min: 100000, max: 120000, a: 15, b: 20000, c: 666 },
  { min: 120000, max: 150000, a: 20, b: 30000, c: 676 },
  { min: 150000, max: 200000, a: 27, b: 50000, c: 695 },
  { min: 200000, max: 250000, a: 24, b: 50000, c: 707 },
  { min: 250000, max: 300000, a: 21, b: 50000, c: 722 },
  { min: 300000, max: 400000, a: 34, b: 100000, c: 741 },
  { min: 400000, max: 500000, a: 29, b: 100000, c: 755 },
  { min: 500000, max: 600000, a: 26, b: 100000, c: 766 },
  { min: 600000, max: 800000, a: 40, b: 200000, c: 791 },
  { min: 800000, max: 1000000, a: 33, b: 200000, c: 807 },
  { min: 1000000, max: Infinity, a: 0, b: 1, c: 938 },
];

// Z1テーブル（技術職員数値→Z1評点）
export const Z1_TABLE: Bracket[] = [
  { min: 0, max: 5, a: 62, b: 5, c: 510 },
  { min: 5, max: 10, a: 63, b: 5, c: 509 },
  { min: 10, max: 15, a: 62, b: 5, c: 511 },
  { min: 15, max: 20, a: 63, b: 5, c: 508 },
  { min: 20, max: 30, a: 62, b: 10, c: 636 },
  { min: 30, max: 40, a: 63, b: 10, c: 633 },
  { min: 40, max: 50, a: 63, b: 10, c: 633 },
  { min: 50, max: 65, a: 62, b: 15, c: 742 },
  { min: 65, max: 85, a: 62, b: 20, c: 810 },
  { min: 85, max: 110, a: 63, b: 25, c: 860 },
  { min: 110, max: 140, a: 63, b: 30, c: 907 },
  { min: 140, max: 180, a: 62, b: 40, c: 984 },
  { min: 180, max: 230, a: 62, b: 50, c: 1040 },
  { min: 230, max: 300, a: 63, b: 70, c: 1119 },
  { min: 300, max: 390, a: 62, b: 90, c: 1183 },
  { min: 390, max: 510, a: 63, b: 120, c: 1247 },
  { min: 510, max: 660, a: 63, b: 150, c: 1310 },
  { min: 660, max: 850, a: 62, b: 190, c: 1371 },
  { min: 850, max: 1100, a: 62, b: 250, c: 1432 },
  { min: 1100, max: Infinity, a: 0, b: 1, c: 1712 },
];

// Z2テーブル（元請完成工事高→Z2評点）
export const Z2_TABLE: Bracket[] = [
  { min: 0, max: 10000, a: 341, b: 10000, c: 241 },
  { min: 10000, max: 12000, a: 16, b: 2000, c: 502 },
  { min: 12000, max: 15000, a: 19, b: 3000, c: 522 },
  { min: 15000, max: 20000, a: 28, b: 5000, c: 533 },
  { min: 20000, max: 25000, a: 23, b: 5000, c: 553 },
  { min: 25000, max: 30000, a: 19, b: 5000, c: 573 },
  { min: 30000, max: 40000, a: 31, b: 10000, c: 594 },
  { min: 40000, max: 50000, a: 27, b: 10000, c: 610 },
  { min: 50000, max: 60000, a: 22, b: 10000, c: 635 },
  { min: 60000, max: 80000, a: 36, b: 20000, c: 659 },
  { min: 80000, max: 100000, a: 29, b: 20000, c: 687 },
  { min: 100000, max: 120000, a: 26, b: 20000, c: 702 },
  { min: 120000, max: 150000, a: 32, b: 30000, c: 730 },
  { min: 150000, max: 200000, a: 45, b: 50000, c: 755 },
  { min: 200000, max: 250000, a: 35, b: 50000, c: 795 },
  { min: 250000, max: 300000, a: 30, b: 50000, c: 820 },
  { min: 300000, max: 400000, a: 51, b: 100000, c: 847 },
  { min: 400000, max: 500000, a: 42, b: 100000, c: 883 },
  { min: 500000, max: 600000, a: 37, b: 100000, c: 905 },
  { min: 600000, max: 800000, a: 61, b: 200000, c: 939 },
  { min: 800000, max: 1000000, a: 47, b: 200000, c: 967 },
  { min: 1000000, max: 1200000, a: 44, b: 200000, c: 979 },
  { min: 1200000, max: 1500000, a: 54, b: 300000, c: 1012 },
  { min: 1500000, max: 2000000, a: 72, b: 500000, c: 1053 },
  { min: 2000000, max: Infinity, a: 0, b: 1, c: 1341 },
];

// 有資格区分コード → 乗数マッピング
export const QUALIFICATION_MULTIPLIERS: Record<
  number,
  { name: string; grade: string; multiplier: number }
> = {
  127: { name: '1級電気工事施工管理技士', grade: '1級', multiplier: 5 },
  129: { name: '1級管工事施工管理技士', grade: '1級', multiplier: 5 },
  155: { name: '2級電気工事施工管理技士', grade: '2級', multiplier: 2 },
  228: { name: '第一種電気工事士（旧制度）', grade: '2級相当', multiplier: 2 },
  230: { name: '2級管工事施工管理技士', grade: '2級', multiplier: 2 },
  256: { name: '第二種電気工事士', grade: 'その他', multiplier: 1 },
  // 1級系
  101: { name: '1級建設機械施工管理技士', grade: '1級', multiplier: 5 },
  103: { name: '1級土木施工管理技士', grade: '1級', multiplier: 5 },
  105: { name: '1級建築施工管理技士', grade: '1級', multiplier: 5 },
  131: { name: '1級造園施工管理技士', grade: '1級', multiplier: 5 },
  // 2級系
  151: { name: '2級建設機械施工管理技士', grade: '2級', multiplier: 2 },
  153: { name: '2級土木施工管理技士', grade: '2級', multiplier: 2 },
  157: { name: '2級建築施工管理技士', grade: '2級', multiplier: 2 },
  231: { name: '2級造園施工管理技士', grade: '2級', multiplier: 2 },
  // 技術士系
  201: { name: '技術士', grade: '1級相当', multiplier: 5 },
  // 1級電気通信
  133: { name: '1級電気通信工事施工管理技士', grade: '1級', multiplier: 5 },
  233: { name: '2級電気通信工事施工管理技士', grade: '2級', multiplier: 2 },
};

/**
 * 資格コード → 対応業種コードマッピング
 * 経審では資格の種類によって加点できる業種が決まっている
 */
export const QUALIFICATION_TO_INDUSTRY: Record<number, string[]> = {
  // 電気工事
  127: ['08'], // 1級電気工事施工管理技士
  155: ['08'], // 2級電気工事施工管理技士
  228: ['08'], // 第一種電気工事士
  256: ['08'], // 第二種電気工事士（3年以上実務）
  // 管工事
  129: ['09'], // 1級管工事施工管理技士
  230: ['09'], // 2級管工事施工管理技士
  // 電気通信
  133: ['12'], // 1級電気通信工事施工管理技士
  233: ['12'], // 2級電気通信工事施工管理技士
  // 土木
  103: ['01'], // 1級土木施工管理技士
  153: ['01'], // 2級土木施工管理技士
  // 建築
  105: ['02'], // 1級建築施工管理技士
  157: ['02'], // 2級建築施工管理技士
  // 造園
  131: ['22'], // 1級造園施工管理技士
  231: ['22'], // 2級造園施工管理技士
  // 建設機械
  101: ['01'], // 1級建設機械施工管理技士（土木）
  151: ['01'], // 2級建設機械施工管理技士（土木）
  // 技術士
  201: ['01', '02', '08', '09'], // 技術士（部門による）
};

/**
 * 講習受講による乗数変更
 * 1級 + 講習受講(1) + 監理技術者資格者証あり → ×6（1級監理受講）
 * 1級 + 講習未受講(2) → ×5（1級技術者）
 * 2級/その他 → 講習フラグに関係なくそのまま
 */
export function getEffectiveMultiplier(
  qualificationCode: number,
  lectureFlag: number,
  hasSupervisorCert: boolean
): number {
  const qual = QUALIFICATION_MULTIPLIERS[qualificationCode];
  if (!qual) return 1;

  if (qual.multiplier === 5 && lectureFlag === 1 && hasSupervisorCert) {
    return 6; // 1級監理受講
  }
  return qual.multiplier;
}

/**
 * 別紙二の技術職員リストから業種別の技術職員数値を計算する
 *
 * @deprecated tech-staff-calculator.ts の同名関数を使用してください。
 * このコピーは後方互換のために残しています。
 *
 * ルール:
 * - 1人の技術者は最大2業種まで加点可能（業種コード1、業種コード2）
 * - 各業種での加点は「資格コードに対応する乗数」で決まる
 * - 1級(5点) + 講習受講 + 監理技術者証 → 6点
 * - 1級(5点)
 * - 2級(2点)
 * - その他(1点)
 * - 同一業種に複数の資格を持つ場合、最も高い乗数のみ適用
 *
 * @param staff 別紙二の技術職員リスト
 * @returns 業種コード → 技術職員数値のマップ
 */
export function calculateTechStaffValueByIndustry(
  staff: Array<{
    industryCode1: number;
    qualificationCode1: number;
    lectureFlag1: number;
    industryCode2?: number;
    qualificationCode2?: number;
    lectureFlag2?: number;
    supervisorCertNumber?: string;
  }>
): Record<string, number> {
  const result: Record<string, number> = {};

  for (const person of staff) {
    const hasCert = !!person.supervisorCertNumber;

    // 業種1
    if (person.industryCode1 && person.qualificationCode1) {
      const code = String(person.industryCode1).padStart(2, '0');
      const multiplier = getEffectiveMultiplier(
        person.qualificationCode1,
        person.lectureFlag1,
        hasCert
      );
      result[code] = (result[code] ?? 0) + multiplier;
    }

    // 業種2（任意）
    if (person.industryCode2 && person.qualificationCode2) {
      const code = String(person.industryCode2).padStart(2, '0');
      const multiplier = getEffectiveMultiplier(
        person.qualificationCode2,
        person.lectureFlag2 ?? 2,
        hasCert
      );
      result[code] = (result[code] ?? 0) + multiplier;
    }
  }

  return result;
}
