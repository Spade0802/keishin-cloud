import { describe, test, expect } from 'vitest';
import {
  calculateTechStaffValues,
  resolveEffectivePoints,
  convertLegacyStaffToExtracted,
  type ExtractedStaffMember,
} from '@/lib/engine/tech-staff-calculator';
import {
  getQualificationByCode,
  isQualificationValidForIndustry,
  QUALIFICATION_CODE_TABLE,
} from '@/lib/engine/qualification-codes';

// ─── resolveEffectivePoints ───

describe('resolveEffectivePoints', () => {
  test('1級 + 講習受講 + 監理技術者資格者証 → 6点', () => {
    const qual = getQualificationByCode(127); // 1級電気工事施工管理技士
    const result = resolveEffectivePoints(qual, 1, true);
    expect(result.points).toBe(6);
    expect(result.supervisorUpgrade).toBe(true);
  });

  test('1級 + 講習未受講 → 5点', () => {
    const qual = getQualificationByCode(127);
    const result = resolveEffectivePoints(qual, 2, true);
    expect(result.points).toBe(5);
    expect(result.supervisorUpgrade).toBe(false);
  });

  test('1級 + 講習受講 + 資格者証なし → 5点', () => {
    const qual = getQualificationByCode(127);
    const result = resolveEffectivePoints(qual, 1, false);
    expect(result.points).toBe(5);
    expect(result.supervisorUpgrade).toBe(false);
  });

  test('2級 → 2点（講習フラグ無関係）', () => {
    const qual = getQualificationByCode(128); // 2級電気工事施工管理技士
    const result = resolveEffectivePoints(qual, 1, true);
    expect(result.points).toBe(2);
    expect(result.supervisorUpgrade).toBe(false);
  });

  test('1級技士補 → 4点', () => {
    const qual = getQualificationByCode(173); // 1級電気工事施工管理技士補
    const result = resolveEffectivePoints(qual, 0, false);
    expect(result.points).toBe(4);
    expect(result.supervisorUpgrade).toBe(false);
  });

  test('登録基幹技能者 → 3点', () => {
    const qual = getQualificationByCode(308); // 登録基幹技能者（電気）
    const result = resolveEffectivePoints(qual, 0, false);
    expect(result.points).toBe(3);
    expect(result.supervisorUpgrade).toBe(false);
  });

  test('第一種電気工事士 → 2点', () => {
    const qual = getQualificationByCode(152);
    const result = resolveEffectivePoints(qual, 0, false);
    expect(result.points).toBe(2);
  });

  test('第二種電気工事士 → 1点', () => {
    const qual = getQualificationByCode(153);
    const result = resolveEffectivePoints(qual, 0, false);
    expect(result.points).toBe(1);
  });

  test('未知のコード → 1点', () => {
    const qual = getQualificationByCode(9999);
    const result = resolveEffectivePoints(qual, 0, false);
    expect(result.points).toBe(1);
  });
});

// ─── getQualificationByCode ───

describe('getQualificationByCode', () => {
  test('既知のコードを正しく返す', () => {
    const entry = getQualificationByCode(127);
    expect(entry.name).toBe('1級電気工事施工管理技士');
    expect(entry.grade).toBe('1級');
    expect(entry.basePoints).toBe(5);
    expect(entry.canUpgradeToSupervisor).toBe(true);
    expect(entry.targetIndustries).toContain('08');
  });

  test('未知のコードはデフォルトを返す', () => {
    const entry = getQualificationByCode(8888);
    expect(entry.grade).toBe('その他');
    expect(entry.basePoints).toBe(1);
    expect(entry.canUpgradeToSupervisor).toBe(false);
  });
});

// ─── isQualificationValidForIndustry ───

describe('isQualificationValidForIndustry', () => {
  test('1級電気工事施工管理技士は電気(08)に対応', () => {
    expect(isQualificationValidForIndustry(127, '08')).toBe(true);
  });

  test('1級電気工事施工管理技士は管(09)に非対応', () => {
    expect(isQualificationValidForIndustry(127, '09')).toBe(false);
  });

  test('1級管工事施工管理技士は管(09)・熱絶縁(21)・消防(27)に対応', () => {
    expect(isQualificationValidForIndustry(129, '09')).toBe(true);
    expect(isQualificationValidForIndustry(129, '21')).toBe(true);
    expect(isQualificationValidForIndustry(129, '27')).toBe(true);
  });

  test('甲種消防設備士は消防(27)に対応', () => {
    expect(isQualificationValidForIndustry(155, '27')).toBe(true);
  });
});

// ─── calculateTechStaffValues ───

describe('calculateTechStaffValues', () => {
  test('空リスト → 空結果', () => {
    const result = calculateTechStaffValues([]);
    expect(result.industryTotals).toEqual({});
    expect(result.totalStaffCount).toBe(0);
    expect(result.details).toEqual([]);
  });

  test('1人・1業種・1級 → 5点', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '山田太郎',
        industryCode1: '08',
        qualificationCode1: 127, // 1級電気工事施工管理技士
        lectureFlag1: 2,
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals['08']).toBe(5);
    expect(result.totalStaffCount).toBe(1);
  });

  test('1人・1級+監理 → 6点', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '山田太郎',
        industryCode1: '08',
        qualificationCode1: 127,
        lectureFlag1: 1,
        supervisorCertNumber: '第12345号',
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals['08']).toBe(6);
  });

  test('1人・2業種 → 両方に加点', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '鈴木一郎',
        industryCode1: '08',
        qualificationCode1: 127, // 1級電気 → 5点
        lectureFlag1: 2,
        industryCode2: '09',
        qualificationCode2: 129, // 1級管 → 5点
        lectureFlag2: 2,
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals['08']).toBe(5);
    expect(result.industryTotals['09']).toBe(5);
    expect(result.totalStaffCount).toBe(1);
  });

  test('同一人物・同一業種・複数資格 → 最高点のみ', () => {
    // 山田太郎が業種1と業種2で同じ業種08に対して異なるコードを持つ場合
    const staff: ExtractedStaffMember[] = [
      {
        name: '山田太郎',
        industryCode1: '08',
        qualificationCode1: 127, // 1級電気 = 5点
        lectureFlag1: 2,
        industryCode2: '08',
        qualificationCode2: 128, // 2級電気 = 2点
        lectureFlag2: 0,
      },
    ];
    const result = calculateTechStaffValues(staff);
    // 同一業種は最高点のみ → 5点
    expect(result.industryTotals['08']).toBe(5);
  });

  test('複数人・同一業種 → 合算', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '山田太郎',
        industryCode1: '08',
        qualificationCode1: 127, // 1級 = 5
        lectureFlag1: 1,
        supervisorCertNumber: '第12345号', // → 6点
      },
      {
        name: '鈴木花子',
        industryCode1: '08',
        qualificationCode1: 128, // 2級 = 2
        lectureFlag1: 0,
      },
      {
        name: '佐藤次郎',
        industryCode1: '08',
        qualificationCode1: 152, // 第一種電気工事士 = 2
        lectureFlag1: 0,
      },
      {
        name: '田中三郎',
        industryCode1: '08',
        qualificationCode1: 153, // 第二種電気工事士 = 1
        lectureFlag1: 0,
      },
    ];
    const result = calculateTechStaffValues(staff);
    // 6 + 2 + 2 + 1 = 11
    expect(result.industryTotals['08']).toBe(11);
    expect(result.totalStaffCount).toBe(4);
  });

  test('典型的な電気工事会社のシナリオ', () => {
    const staff: ExtractedStaffMember[] = [
      // 社長: 1級電気+監理 = 6, 1級管 = 5
      {
        name: '社長',
        industryCode1: '08',
        qualificationCode1: 127,
        lectureFlag1: 1,
        industryCode2: '09',
        qualificationCode2: 129,
        lectureFlag2: 2,
        supervisorCertNumber: '第001号',
      },
      // 部長: 1級電気 = 5
      {
        name: '部長',
        industryCode1: '08',
        qualificationCode1: 127,
        lectureFlag1: 2,
      },
      // 課長A: 2級電気 = 2, 甲種消防 = 2
      {
        name: '課長A',
        industryCode1: '08',
        qualificationCode1: 128,
        lectureFlag1: 0,
        industryCode2: '27',
        qualificationCode2: 155,
        lectureFlag2: 0,
      },
      // 課長B: 第一種電気工事士 = 2
      {
        name: '課長B',
        industryCode1: '08',
        qualificationCode1: 152,
        lectureFlag1: 0,
      },
      // 若手A: 第二種電気工事士 = 1
      {
        name: '若手A',
        industryCode1: '08',
        qualificationCode1: 153,
        lectureFlag1: 0,
      },
      // 若手B: 乙種消防設備士 = 1
      {
        name: '若手B',
        industryCode1: '27',
        qualificationCode1: 156,
        lectureFlag1: 0,
      },
    ];

    const result = calculateTechStaffValues(staff);

    // 電気(08): 6 + 5 + 2 + 2 + 1 = 16
    expect(result.industryTotals['08']).toBe(16);
    // 管(09): 5
    expect(result.industryTotals['09']).toBe(5);
    // 消防(27): 2 + 1 = 3
    expect(result.industryTotals['27']).toBe(3);
    // 6人
    expect(result.totalStaffCount).toBe(6);
  });

  test('業種コードのゼロパディング', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '田中太郎',
        industryCode1: '8', // パディングなし
        qualificationCode1: 127,
        lectureFlag1: 2,
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals['08']).toBe(5);
  });

  test('資格コードなし → スキップ', () => {
    const staff: ExtractedStaffMember[] = [
      {
        name: '田中太郎',
        industryCode1: '08',
        // qualificationCode1 なし
      },
    ];
    const result = calculateTechStaffValues(staff);
    expect(result.industryTotals['08']).toBeUndefined();
    expect(result.totalStaffCount).toBe(1); // 名前はカウント
  });
});

// ─── convertLegacyStaffToExtracted ───

describe('convertLegacyStaffToExtracted', () => {
  test('旧形式を新形式に変換', () => {
    const legacy = [
      {
        name: '山田太郎',
        industryCode1: 8,
        qualificationCode1: 127,
        lectureFlag1: 1,
        industryCode2: 9,
        qualificationCode2: 129,
        lectureFlag2: 2,
        supervisorCertNumber: '第12345号',
      },
    ];
    const converted = convertLegacyStaffToExtracted(legacy);
    expect(converted).toHaveLength(1);
    expect(converted[0].industryCode1).toBe('08');
    expect(converted[0].industryCode2).toBe('09');
    expect(converted[0].qualificationCode1).toBe(127);
    expect(converted[0].supervisorCertNumber).toBe('第12345号');
  });
});

// ─── QUALIFICATION_CODE_TABLE 整合性 ───

describe('QUALIFICATION_CODE_TABLE integrity', () => {
  test('コードに重複がない', () => {
    const codes = QUALIFICATION_CODE_TABLE.map((e) => e.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  test('全エントリのbasePointsがgradeと一致', () => {
    const gradePointMap: Record<string, number> = {
      '1級': 5,
      '1級技士補': 4,
      '基幹技能者': 3,
      '2級': 2,
      'その他': 1,
    };
    for (const entry of QUALIFICATION_CODE_TABLE) {
      expect(entry.basePoints).toBe(gradePointMap[entry.grade]);
    }
  });

  test('1級資格のみcanUpgradeToSupervisor=true', () => {
    for (const entry of QUALIFICATION_CODE_TABLE) {
      if (entry.canUpgradeToSupervisor) {
        expect(entry.grade).toBe('1級');
      }
    }
  });

  test('主要コードが存在する', () => {
    const mainCodes = [101, 103, 107, 127, 128, 129, 130, 131, 132, 133, 134, 152, 153, 155, 156];
    for (const code of mainCodes) {
      const entry = getQualificationByCode(code);
      expect(entry.code).toBe(code);
      expect(entry.name).not.toContain('不明');
    }
  });
});
