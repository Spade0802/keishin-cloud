import { describe, test, expect } from 'vitest';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
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

describe('範囲外のエラー', () => {
  test('X21テーブルの範囲外でエラー', () => {
    expect(() => lookupScore(X21_TABLE, -50000)).toThrow();
  });
});
