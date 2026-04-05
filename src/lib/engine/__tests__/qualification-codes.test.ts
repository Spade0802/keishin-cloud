import { describe, expect, it } from 'vitest';
import {
  GRADE_BASE_POINTS,
  QUALIFICATION_CODE_TABLE,
  getQualificationByCode,
  isQualificationValidForIndustry,
  type QualificationGrade,
} from '../qualification-codes';

// ---------------------------------------------------------------------------
// GRADE_BASE_POINTS - point values per grade
// ---------------------------------------------------------------------------
describe('GRADE_BASE_POINTS', () => {
  it('1級 = 5 points', () => {
    expect(GRADE_BASE_POINTS['1級']).toBe(5);
  });

  it('1級技士補 = 4 points', () => {
    expect(GRADE_BASE_POINTS['1級技士補']).toBe(4);
  });

  it('基幹技能者 = 3 points', () => {
    expect(GRADE_BASE_POINTS['基幹技能者']).toBe(3);
  });

  it('2級 = 2 points', () => {
    expect(GRADE_BASE_POINTS['2級']).toBe(2);
  });

  it('その他 = 1 point', () => {
    expect(GRADE_BASE_POINTS['その他']).toBe(1);
  });

  it('covers exactly 5 grades', () => {
    expect(Object.keys(GRADE_BASE_POINTS)).toHaveLength(5);
  });
});

// ---------------------------------------------------------------------------
// QUALIFICATION_CODE_TABLE - data consistency
// ---------------------------------------------------------------------------
describe('QUALIFICATION_CODE_TABLE data consistency', () => {
  it('has no duplicate codes', () => {
    const codes = QUALIFICATION_CODE_TABLE.map((e) => e.code);
    const uniqueCodes = new Set(codes);
    expect(uniqueCodes.size).toBe(codes.length);
  });

  it('every entry has a positive numeric code', () => {
    for (const entry of QUALIFICATION_CODE_TABLE) {
      expect(entry.code).toBeGreaterThan(0);
      expect(Number.isInteger(entry.code)).toBe(true);
    }
  });

  it('every entry has a non-empty name', () => {
    for (const entry of QUALIFICATION_CODE_TABLE) {
      expect(entry.name.length).toBeGreaterThan(0);
    }
  });

  it('every entry.basePoints matches GRADE_BASE_POINTS[entry.grade]', () => {
    for (const entry of QUALIFICATION_CODE_TABLE) {
      expect(entry.basePoints).toBe(GRADE_BASE_POINTS[entry.grade]);
    }
  });

  it('every entry.grade is a valid QualificationGrade', () => {
    const validGrades: QualificationGrade[] = [
      '1級',
      '1級技士補',
      '基幹技能者',
      '2級',
      'その他',
    ];
    for (const entry of QUALIFICATION_CODE_TABLE) {
      expect(validGrades).toContain(entry.grade);
    }
  });

  it('targetIndustries contains only 2-digit zero-padded strings', () => {
    for (const entry of QUALIFICATION_CODE_TABLE) {
      for (const code of entry.targetIndustries) {
        expect(code).toMatch(/^\d{2}$/);
      }
    }
  });

  it('1級 entries can upgrade to supervisor, others cannot (except 技術士)', () => {
    for (const entry of QUALIFICATION_CODE_TABLE) {
      if (entry.canUpgradeToSupervisor) {
        expect(entry.grade).toBe('1級');
      }
    }
  });

  it('contains at least one entry per grade', () => {
    const gradesPresent = new Set(QUALIFICATION_CODE_TABLE.map((e) => e.grade));
    expect(gradesPresent.size).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// getQualificationByCode
// ---------------------------------------------------------------------------
describe('getQualificationByCode', () => {
  it('returns correct entry for a known 1級 code (101)', () => {
    const entry = getQualificationByCode(101);
    expect(entry.code).toBe(101);
    expect(entry.name).toBe('1級建設機械施工管理技士');
    expect(entry.grade).toBe('1級');
    expect(entry.basePoints).toBe(5);
    expect(entry.canUpgradeToSupervisor).toBe(true);
    expect(entry.targetIndustries).toEqual(['01', '05', '13']);
  });

  it('returns correct entry for a known 2級 code (102)', () => {
    const entry = getQualificationByCode(102);
    expect(entry.grade).toBe('2級');
    expect(entry.basePoints).toBe(2);
    expect(entry.canUpgradeToSupervisor).toBe(false);
  });

  it('returns correct entry for a 1級技士補 code (170)', () => {
    const entry = getQualificationByCode(170);
    expect(entry.grade).toBe('1級技士補');
    expect(entry.basePoints).toBe(4);
  });

  it('returns correct entry for a 基幹技能者 code (301)', () => {
    const entry = getQualificationByCode(301);
    expect(entry.grade).toBe('基幹技能者');
    expect(entry.basePoints).toBe(3);
  });

  it('returns correct entry for an その他 code (153)', () => {
    const entry = getQualificationByCode(153);
    expect(entry.grade).toBe('その他');
    expect(entry.basePoints).toBe(1);
  });

  it('returns correct entry for code 999 (実務経験者)', () => {
    const entry = getQualificationByCode(999);
    expect(entry.code).toBe(999);
    expect(entry.name).toBe('実務経験者（10年以上）');
    expect(entry.targetIndustries).toEqual([]);
  });

  it('returns default 1-point entry for unknown code', () => {
    const entry = getQualificationByCode(9999);
    expect(entry.code).toBe(9999);
    expect(entry.name).toBe('不明な資格コード(9999)');
    expect(entry.grade).toBe('その他');
    expect(entry.basePoints).toBe(1);
    expect(entry.targetIndustries).toEqual([]);
    expect(entry.canUpgradeToSupervisor).toBe(false);
  });

  it('returns default entry for code 0', () => {
    const entry = getQualificationByCode(0);
    expect(entry.grade).toBe('その他');
    expect(entry.basePoints).toBe(1);
  });

  it('returns default entry for negative code', () => {
    const entry = getQualificationByCode(-1);
    expect(entry.grade).toBe('その他');
    expect(entry.basePoints).toBe(1);
    expect(entry.name).toContain('-1');
  });

  it('can look up every entry in the table by code', () => {
    for (const entry of QUALIFICATION_CODE_TABLE) {
      const found = getQualificationByCode(entry.code);
      expect(found).toBe(entry); // same reference from the Map
    }
  });
});

// ---------------------------------------------------------------------------
// isQualificationValidForIndustry
// ---------------------------------------------------------------------------
describe('isQualificationValidForIndustry', () => {
  it('returns true for matching industry', () => {
    // code 101 targets ['01', '05', '13']
    expect(isQualificationValidForIndustry(101, '01')).toBe(true);
    expect(isQualificationValidForIndustry(101, '05')).toBe(true);
    expect(isQualificationValidForIndustry(101, '13')).toBe(true);
  });

  it('returns false for non-matching industry', () => {
    // code 101 does NOT target '02'
    expect(isQualificationValidForIndustry(101, '02')).toBe(false);
  });

  it('pads single-digit industry codes to 2 digits', () => {
    // '1' should be padded to '01' and match code 101
    expect(isQualificationValidForIndustry(101, '1')).toBe(true);
    expect(isQualificationValidForIndustry(101, '5')).toBe(true);
  });

  it('code 999 (実務経験者) is valid for any industry', () => {
    expect(isQualificationValidForIndustry(999, '01')).toBe(true);
    expect(isQualificationValidForIndustry(999, '29')).toBe(true);
    expect(isQualificationValidForIndustry(999, '99')).toBe(true);
  });

  it('unknown code with empty targetIndustries returns false (not code 999)', () => {
    // Unknown code produces empty targetIndustries but code !== 999
    expect(isQualificationValidForIndustry(9999, '01')).toBe(false);
  });

  it('returns false for empty string industry code', () => {
    // padStart('', 2, '0') => '00' which is not in any targetIndustries
    expect(isQualificationValidForIndustry(101, '')).toBe(false);
  });
});
