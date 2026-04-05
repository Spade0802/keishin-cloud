import { describe, test, expect } from 'vitest';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
  calculateTechStaffValueByIndustry,
  getEffectiveMultiplier,
} from '@/lib/engine/score-tables';

describe('X1テーブル（完成工事高→X1評点）', () => {
  test('58期 電気: 1,375,760千円 → X1=1067', () => {
    expect(lookupScore(X1_TABLE, 1375760)).toBe(1067);
  });

  test('58期 管: 1,685千円 → X1=419', () => {
    expect(lookupScore(X1_TABLE, 1685)).toBe(419);
  });

  test('58期 電気通信: 13,876千円 → X1=547', () => {
    expect(lookupScore(X1_TABLE, 13876)).toBe(547);
  });

  test('58期 消防施設: 921千円 → X1=409', () => {
    expect(lookupScore(X1_TABLE, 921)).toBe(409);
  });

  test('境界値: 0千円 → X1=397', () => {
    expect(lookupScore(X1_TABLE, 0)).toBe(397);
  });
});

describe('X21テーブル（自己資本額→X21評点）', () => {
  test('58期: 336,010千円 → X21=810', () => {
    expect(lookupScore(X21_TABLE, 336010)).toBe(810);
  });

  test('57期: 282,007千円 → X21=795', () => {
    expect(lookupScore(X21_TABLE, 282007)).toBe(795);
  });
});

describe('X22テーブル（EBITDA→X22評点）', () => {
  test('58期: 44,332千円 → X22=687', () => {
    expect(lookupScore(X22_TABLE, 44332)).toBe(687);
  });
});

describe('Z1テーブル（技術職員数値→Z1評点）', () => {
  test('技術職員数値62 → Z1', () => {
    const z1 = lookupScore(Z1_TABLE, 62);
    expect(z1).toBeGreaterThan(700);
  });

  test('技術職員数値20 → Z1', () => {
    const z1 = lookupScore(Z1_TABLE, 20);
    expect(z1).toBeGreaterThan(600);
  });

  test('技術職員数値0 → Z1=510', () => {
    expect(lookupScore(Z1_TABLE, 0)).toBe(510);
  });
});

describe('Z2テーブル（元請完成工事高→Z2評点）', () => {
  test('688,475千円 → Z2', () => {
    const z2 = lookupScore(Z2_TABLE, 688475);
    expect(z2).toBeGreaterThan(900);
  });

  test('0千円 → Z2=241', () => {
    expect(lookupScore(Z2_TABLE, 0)).toBe(241);
  });
});

describe('大幅マイナス値の処理', () => {
  test('X21テーブルで大幅債務超過（-50000千円）は0点を返す', () => {
    expect(lookupScore(X21_TABLE, -50000)).toBe(0);
  });

  test('X22テーブルで大幅赤字（-100000千円）は0点を返す', () => {
    expect(lookupScore(X22_TABLE, -100000)).toBe(0);
  });
});

describe('getEffectiveMultiplier（講習受講の乗数変更）', () => {
  test('1級電気 + 講習受講 + 監理技術者証 → 6点', () => {
    expect(getEffectiveMultiplier(127, 1, true)).toBe(6);
  });

  test('1級電気 + 講習未受講 → 5点', () => {
    expect(getEffectiveMultiplier(127, 2, false)).toBe(5);
  });

  test('2級電気 → 2点（講習フラグ無関係）', () => {
    expect(getEffectiveMultiplier(155, 1, true)).toBe(2);
  });

  test('不明な資格コード → 1点', () => {
    expect(getEffectiveMultiplier(999, 1, false)).toBe(1);
  });
});

describe('calculateTechStaffValueByIndustry（別紙二→業種別技術職員数値）', () => {
  test('第58期サンプル: 電気20人の別紙二から業種別数値を計算', () => {
    // 簡略化した別紙二データ（実際は20名）
    const staff = [
      // 1級電気(127) + 講習受講(1) + 監理技術者証あり → 電気(08)に6点
      { industryCode1: 8, qualificationCode1: 127, lectureFlag1: 1, supervisorCertNumber: 'ABC123' },
      // 1級電気(127) + 講習受講(1) + 監理技術者証あり → 電気(08)に6点, 管(09)に1級管(129)で5点
      { industryCode1: 8, qualificationCode1: 127, lectureFlag1: 1, industryCode2: 9, qualificationCode2: 129, lectureFlag2: 2, supervisorCertNumber: 'DEF456' },
      // 2級電気(155) → 電気(08)に2点
      { industryCode1: 8, qualificationCode1: 155, lectureFlag1: 2 },
      // 第二種電気工事士(256) → 電気(08)に1点
      { industryCode1: 8, qualificationCode1: 256, lectureFlag1: 2 },
    ];

    const result = calculateTechStaffValueByIndustry(staff);

    // 電気(08): 6 + 6 + 2 + 1 = 15
    expect(result['08']).toBe(15);
    // 管(09): 5
    expect(result['09']).toBe(5);
  });

  test('空リスト → 空オブジェクト', () => {
    expect(calculateTechStaffValueByIndustry([])).toEqual({});
  });

  test('業種コードが1桁でもゼロパディングされる', () => {
    const staff = [
      { industryCode1: 8, qualificationCode1: 127, lectureFlag1: 2 },
    ];
    const result = calculateTechStaffValueByIndustry(staff);
    expect(result['08']).toBe(5);
    expect(result['8']).toBeUndefined();
  });
});
