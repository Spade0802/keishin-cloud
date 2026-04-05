import { describe, expect, it } from 'vitest';
import {
  parseNum,
  findNumberAfter,
  findValueWithUnit,
  normalizeIndustryName,
} from '../keishin-pdf-parser';

// ===========================================================================
// parseNum — full-width digits, commas, units
// ===========================================================================
describe('parseNum', () => {
  it('parses normal integer', () => {
    expect(parseNum('12345')).toBe(12345);
  });

  it('strips commas', () => {
    expect(parseNum('1,234,567')).toBe(1234567);
  });

  it('converts full-width digits to half-width', () => {
    expect(parseNum('１２３４５')).toBe(12345);
  });

  it('strips trailing unit 千円', () => {
    expect(parseNum('44,332千円')).toBe(44332);
  });

  it('strips trailing unit 人', () => {
    expect(parseNum('20人')).toBe(20);
  });

  it('strips trailing unit 年', () => {
    expect(parseNum('35年')).toBe(35);
  });

  it('strips trailing unit 台', () => {
    expect(parseNum('5台')).toBe(5);
  });

  it('strips full-width spaces', () => {
    expect(parseNum('１　２３４')).toBe(1234);
  });

  it('returns 0 for non-numeric input', () => {
    expect(parseNum('abc')).toBe(0);
    expect(parseNum('')).toBe(0);
  });

  it('handles mixed full-width and half-width', () => {
    expect(parseNum('１2３4')).toBe(1234);
  });

  it('handles negative-looking strings (parseInt stops at minus sign)', () => {
    // parseNum uses parseInt which handles leading minus
    expect(parseNum('-500')).toBe(-500);
  });
});

// ===========================================================================
// findNumberAfter — keyword-based number extraction
// ===========================================================================
describe('findNumberAfter', () => {
  it('finds number after keyword', () => {
    const text = '自己資本額 282,007千円';
    expect(findNumberAfter(text, '自己資本額')).toBe(282007);
  });

  it('finds number after keyword across newlines', () => {
    const text = '自己資本額\n282,007千円';
    expect(findNumberAfter(text, '自己資本額')).toBe(282007);
  });

  it('returns 0 when keyword not found', () => {
    expect(findNumberAfter('some text', '存在しない')).toBe(0);
  });

  it('handles regex keyword', () => {
    const text = '利益額 (利払前) 1,486千円';
    expect(findNumberAfter(text, /利益額/)).toBe(1486);
  });

  it('returns 0 when no number follows keyword', () => {
    const text = '自己資本額 データなし';
    expect(findNumberAfter(text, '自己資本額')).toBe(0);
  });

  it('respects maxChars limit', () => {
    const text = '自己資本額' + ' '.repeat(400) + '12345';
    // Default maxChars=300, so number is beyond range
    expect(findNumberAfter(text, '自己資本額', 10)).toBe(0);
  });

  it('finds full-width digits after keyword', () => {
    const text = '技術職員数 １９人';
    expect(findNumberAfter(text, '技術職員数')).toBe(19);
  });
});

// ===========================================================================
// findValueWithUnit — keyword + unit pattern extraction
// ===========================================================================
describe('findValueWithUnit', () => {
  it('finds value with unit 千円', () => {
    const text = '自己資本額 282,007千円';
    expect(findValueWithUnit(text, '自己資本額', '千円')).toBe(282007);
  });

  it('finds value with unit 人', () => {
    const text = '技術職員数 19人';
    expect(findValueWithUnit(text, '技術職員数', '人')).toBe(19);
  });

  it('returns 0 when keyword not found', () => {
    expect(findValueWithUnit('some text', '存在しない', '千円')).toBe(0);
  });

  it('falls back to findNumberAfter when unit not matched', () => {
    const text = '金額 12345';
    // No 千円 unit but a number exists
    expect(findValueWithUnit(text, '金額', '千円')).toBe(12345);
  });

  it('handles multiline text', () => {
    const text = '自己資本額\n44,332\n千円';
    expect(findValueWithUnit(text, '自己資本額', '千円')).toBe(44332);
  });
});

// ===========================================================================
// normalizeIndustryName — construction industry name normalization
// ===========================================================================
describe('normalizeIndustryName', () => {
  it('normalizes full name to short form', () => {
    expect(normalizeIndustryName('電気工事')).toBe('電気');
    expect(normalizeIndustryName('管工事')).toBe('管');
    expect(normalizeIndustryName('土木一式工事')).toBe('土木');
    expect(normalizeIndustryName('建築一式工事')).toBe('建築');
  });

  it('handles names with spaces', () => {
    expect(normalizeIndustryName(' 電気工事 ')).toBe('電気');
    expect(normalizeIndustryName('電気 工事')).toBe('電気');
  });

  it('handles partial matches via noKouji fallback', () => {
    expect(normalizeIndustryName('舗装工事')).toBe('ほ装');
  });

  it('normalizes compound names', () => {
    expect(normalizeIndustryName('とび・土工・コンクリート工事')).toBe('とび');
    expect(normalizeIndustryName('タイル・れんが・ブロック工事')).toBe('タイル');
  });

  it('returns trimmed input when no mapping found', () => {
    expect(normalizeIndustryName('未知の業種')).toBe('未知の業種');
  });

  it('normalizes short forms that are already in map', () => {
    expect(normalizeIndustryName('土木一式')).toBe('土木');
    expect(normalizeIndustryName('建築一式')).toBe('建築');
  });

  it('handles all 29 industry types', () => {
    const entries: [string, string][] = [
      ['大工工事', '大工'],
      ['左官工事', '左官'],
      ['石工事', '石'],
      ['屋根工事', '屋根'],
      ['鋼構造物工事', '鋼構造物'],
      ['鉄筋工事', '鉄筋'],
      ['ほ装工事', 'ほ装'],
      ['しゅんせつ工事', 'しゅんせつ'],
      ['板金工事', '板金'],
      ['ガラス工事', 'ガラス'],
      ['塗装工事', '塗装'],
      ['防水工事', '防水'],
      ['内装仕上工事', '内装'],
      ['機械器具設置工事', '機械器具'],
      ['熱絶縁工事', '熱絶縁'],
      ['電気通信工事', '電気通信'],
      ['造園工事', '造園'],
      ['さく井工事', 'さく井'],
      ['建具工事', '建具'],
      ['水道施設工事', '水道'],
      ['消防施設工事', '消防施設'],
      ['清掃施設工事', '清掃'],
      ['解体工事', '解体'],
    ];
    for (const [input, expected] of entries) {
      expect(normalizeIndustryName(input)).toBe(expected);
    }
  });
});
