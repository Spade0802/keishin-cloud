import { describe, expect, it } from 'vitest';
import {
  calculateTechStaffValues,
  resolveEffectivePoints,
  type ExtractedStaffMember,
} from '../tech-staff-calculator';
import { getQualificationByCode } from '../qualification-codes';

// ---------------------------------------------------------------------------
// resolveEffectivePoints
// ---------------------------------------------------------------------------
describe('resolveEffectivePoints', () => {
  it('1級 + 講習受講 + 監理技術者資格者証 → 6点', () => {
    // code 103 = 1級土木施工管理技士 (canUpgradeToSupervisor: true, basePoints: 5)
    const entry = getQualificationByCode(103);
    const result = resolveEffectivePoints(entry, 1, true);
    expect(result.points).toBe(6);
    expect(result.supervisorUpgrade).toBe(true);
  });

  it('1級 + 講習未受講 → 5点（昇格なし）', () => {
    const entry = getQualificationByCode(103);
    const result = resolveEffectivePoints(entry, 2, true);
    expect(result.points).toBe(5);
    expect(result.supervisorUpgrade).toBe(false);
  });

  it('1級 + 講習受講 + 監理技術者資格者証なし → 5点', () => {
    const entry = getQualificationByCode(103);
    const result = resolveEffectivePoints(entry, 1, false);
    expect(result.points).toBe(5);
    expect(result.supervisorUpgrade).toBe(false);
  });

  it('2級資格 → 2点（昇格不可）', () => {
    // code 104 = 2級土木施工管理技士 (basePoints: 2, canUpgradeToSupervisor: false)
    const entry = getQualificationByCode(104);
    const result = resolveEffectivePoints(entry, 1, true);
    expect(result.points).toBe(2);
    expect(result.supervisorUpgrade).toBe(false);
  });

  it('不明な資格コード → 1点', () => {
    const entry = getQualificationByCode(9999);
    const result = resolveEffectivePoints(entry, undefined, false);
    expect(result.points).toBe(1);
    expect(result.supervisorUpgrade).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// calculateTechStaffValues
// ---------------------------------------------------------------------------
describe('calculateTechStaffValues', () => {
  it('空リスト → 空の結果', () => {
    const result = calculateTechStaffValues([]);
    expect(result.industryTotals).toEqual({});
    expect(result.totalStaffCount).toBe(0);
    expect(result.details).toEqual([]);
  });

  it('1級資格の単一職員 → 5点', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '田中太郎',
        industryCode1: '01',
        qualificationCode1: 103, // 1級土木
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals['01']).toBe(5);
    expect(result.totalStaffCount).toBe(1);
    expect(result.details).toHaveLength(1);
    expect(result.details[0].grade).toBe('1級');
  });

  it('2級資格の単一職員 → 2点', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '鈴木花子',
        industryCode1: '01',
        qualificationCode1: 104, // 2級土木
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals['01']).toBe(2);
    expect(result.totalStaffCount).toBe(1);
  });

  it('監理技術者昇格（6点）のケース', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '山田一郎',
        industryCode1: '01',
        qualificationCode1: 103, // 1級土木
        lectureFlag1: 1,         // 講習受講済み
        supervisorCertNumber: 'ABC123', // 資格者証あり
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals['01']).toBe(6);
    expect(result.details[0].supervisorUpgrade).toBe(true);
    expect(result.details[0].grade).toBe('1級+監理');
  });

  it('1人が2業種を持つケース', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '佐藤二郎',
        industryCode1: '01',
        qualificationCode1: 103, // 1級土木 → 5点
        industryCode2: '08',
        qualificationCode2: 127, // 1級電気 → 5点
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals['01']).toBe(5);
    expect(result.industryTotals['08']).toBe(5);
    expect(result.totalStaffCount).toBe(1); // 人数は1人
    expect(result.details).toHaveLength(2);  // 詳細は2件
  });

  it('同一人物・同一業種で重複しない（dedup key）', () => {
    // 同じ行インデックスにおける同一人物・同一業種は最高点のみ
    const staff: ExtractedStaffMember[] = [
      {
        name: '高橋三郎',
        industryCode1: '01',
        qualificationCode1: 103, // 1級土木 → 5点
        industryCode2: '01',     // 同じ業種
        qualificationCode2: 104, // 2級土木 → 2点
      },
    ];
    const result = calculateTechStaffValues(staff);
    // 同一personId + 同一業種 → 最高点のみ = 5点
    expect(result.industryTotals['01']).toBe(5);
    expect(result.totalStaffCount).toBe(1);
  });

  it('複数人の合計が正しく集計される', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '田中太郎',
        industryCode1: '01',
        qualificationCode1: 103, // 1級土木 → 5点
      },
      {
        name: '鈴木花子',
        industryCode1: '01',
        qualificationCode1: 104, // 2級土木 → 2点
      },
      {
        name: '山田一郎',
        industryCode1: '08',
        qualificationCode1: 127, // 1級電気 → 5点
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals['01']).toBe(7); // 5 + 2
    expect(result.industryTotals['08']).toBe(5);
    expect(result.totalStaffCount).toBe(3);
  });

  it('業種コードが1桁でもpadStartで0埋めされる', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '渡辺四郎',
        industryCode1: '1', // 0埋めなし
        qualificationCode1: 103,
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals['01']).toBe(5);
    expect(result.details[0].industryCode).toBe('01');
  });

  it('qualificationCode が undefined の場合はスキップされる', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '中村五郎',
        industryCode1: '01',
        // qualificationCode1 なし
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals).toEqual({});
    expect(result.details).toHaveLength(0);
    // 名前は staffList に存在するのでカウントされる
    expect(result.totalStaffCount).toBe(1);
  });
});
