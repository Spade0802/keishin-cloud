import { describe, expect, it } from 'vitest';
import {
  lookupScore,
  X1_TABLE,
  X21_TABLE,
  X22_TABLE,
  Z1_TABLE,
  Z2_TABLE,
  type Bracket,
} from '../score-tables';

// ---------------------------------------------------------------------------
// lookupScore 基本動作
// ---------------------------------------------------------------------------
describe('lookupScore', () => {
  // シンプルなテスト用テーブル
  // bracket 0: [0, 100)  => floor(10 * value / 100) + 50
  // bracket 1: [100, 200) => floor(20 * value / 200) + 60
  // bracket 2: [200, Inf) => floor(0 * value / 1) + 99
  const SIMPLE_TABLE: Bracket[] = [
    { min: 0, max: 100, a: 10, b: 100, c: 50 },
    { min: 100, max: 200, a: 20, b: 200, c: 60 },
    { min: 200, max: Infinity, a: 0, b: 1, c: 99 },
  ];

  it('正確なブラケット境界の下限で正しく計算する', () => {
    // value=0: floor(10*0/100)+50 = 50
    expect(lookupScore(SIMPLE_TABLE, 0)).toBe(50);
    // value=100: floor(20*100/200)+60 = floor(10)+60 = 70
    expect(lookupScore(SIMPLE_TABLE, 100)).toBe(70);
    // value=200: floor(0*200/1)+99 = 99
    expect(lookupScore(SIMPLE_TABLE, 200)).toBe(99);
  });

  it('ブラケット境界の上限未満で正しいブラケットが選択される', () => {
    // value=99: bracket 0 => floor(10*99/100)+50 = floor(9.9)+50 = 59
    expect(lookupScore(SIMPLE_TABLE, 99)).toBe(59);
    // value=199: bracket 1 => floor(20*199/200)+60 = floor(19.9)+60 = 79
    expect(lookupScore(SIMPLE_TABLE, 199)).toBe(79);
  });

  it('ブラケット内の中間値で正しく計算する', () => {
    // value=50: floor(10*50/100)+50 = floor(5)+50 = 55
    expect(lookupScore(SIMPLE_TABLE, 50)).toBe(55);
    // value=150: floor(20*150/200)+60 = floor(15)+60 = 75
    expect(lookupScore(SIMPLE_TABLE, 150)).toBe(75);
  });

  it('最終ブラケット（Infinity）で非常に大きい値を処理できる', () => {
    // value=999999999: floor(0*999999999/1)+99 = 99
    expect(lookupScore(SIMPLE_TABLE, 999999999)).toBe(99);
  });

  it('ブラケット範囲外の負の値はエラーをスローする', () => {
    // SIMPLE_TABLE は min=0 からなので -1 は範囲外
    expect(() => lookupScore(SIMPLE_TABLE, -1)).toThrow(
      '評点テーブルの該当区間が見つかりません'
    );
  });

  it('空のテーブルでエラーをスローする', () => {
    expect(() => lookupScore([], 100)).toThrow(
      '評点テーブルの該当区間が見つかりません'
    );
  });

  // -Infinity を含むテーブルでの負値テスト
  it('-Infinityブラケットを持つテーブルで負の値を処理できる', () => {
    const tableWithNegInf: Bracket[] = [
      { min: -Infinity, max: 0, a: 0, b: 1, c: 0 },
      { min: 0, max: Infinity, a: 0, b: 1, c: 100 },
    ];
    expect(lookupScore(tableWithNegInf, -1000)).toBe(0);
    expect(lookupScore(tableWithNegInf, -1)).toBe(0);
    expect(lookupScore(tableWithNegInf, 0)).toBe(100);
  });

  it('0の値を正しく処理する', () => {
    expect(lookupScore(SIMPLE_TABLE, 0)).toBe(50);
  });
});

// ---------------------------------------------------------------------------
// X1_TABLE（完成工事高→X1評点）
// ---------------------------------------------------------------------------
describe('X1_TABLE', () => {
  it('先頭ブラケット: value=0', () => {
    // floor(131*0/10000)+397 = 397
    expect(lookupScore(X1_TABLE, 0)).toBe(397);
  });

  it('先頭ブラケット: value=5000', () => {
    // floor(131*5000/10000)+397 = floor(65.5)+397 = 65+397 = 462
    expect(lookupScore(X1_TABLE, 5000)).toBe(462);
  });

  it('先頭ブラケット上限境界: value=9999', () => {
    // floor(131*9999/10000)+397 = floor(130.8869)+397 = 130+397 = 527
    expect(lookupScore(X1_TABLE, 9999)).toBe(527);
  });

  it('2番目ブラケット: value=10000', () => {
    // floor(11*10000/2000)+473 = floor(55)+473 = 528
    expect(lookupScore(X1_TABLE, 10000)).toBe(528);
  });

  it('中間ブラケット: value=100000 (1億円)', () => {
    // bracket: {min:100000, max:120000, a:19, b:20000, c:616}
    // floor(19*100000/20000)+616 = floor(95)+616 = 711
    expect(lookupScore(X1_TABLE, 100000)).toBe(711);
  });

  it('大きな値: value=50000000 (500億円)', () => {
    // bracket: {min:50000000, max:100000000, a:50, b:50000000, c:1898}
    // floor(50*50000000/50000000)+1898 = floor(50)+1898 = 1948
    expect(lookupScore(X1_TABLE, 50000000)).toBe(1948);
  });

  it('最終ブラケット（上限なし）: value=100000000 (1000億円)', () => {
    // bracket: {min:100000000, max:Infinity, a:0, b:1, c:1998}
    expect(lookupScore(X1_TABLE, 100000000)).toBe(1998);
  });

  it('最終ブラケット: 超大規模な値でも固定評点', () => {
    expect(lookupScore(X1_TABLE, 999999999)).toBe(1998);
  });

  it('テーブル最小値未満（負の値）はエラーをスローする', () => {
    // X1_TABLE min=0 → 負の値は範囲外
    expect(() => lookupScore(X1_TABLE, -1)).toThrow('評点テーブルの該当区間が見つかりません');
    expect(() => lookupScore(X1_TABLE, -1000)).toThrow('評点テーブルの該当区間が見つかりません');
  });
});

// ---------------------------------------------------------------------------
// X21_TABLE（自己資本額→X21評点）
// ---------------------------------------------------------------------------
describe('X21_TABLE', () => {
  it('大幅債務超過（負の値）は0点', () => {
    // bracket: {min:-Infinity, max:0, a:0, b:1, c:0}
    expect(lookupScore(X21_TABLE, -999999)).toBe(0);
    expect(lookupScore(X21_TABLE, -1)).toBe(0);
  });

  it('自己資本0は361点', () => {
    // bracket: {min:0, max:10000, a:223, b:10000, c:361}
    // floor(223*0/10000)+361 = 361
    expect(lookupScore(X21_TABLE, 0)).toBe(361);
  });

  it('自己資本1000万円 (10000千円)', () => {
    // bracket: {min:10000, max:12000, a:8, b:2000, c:544}
    // floor(8*10000/2000)+544 = floor(40)+544 = 584
    expect(lookupScore(X21_TABLE, 10000)).toBe(584);
  });

  it('最終ブラケット: 10億円以上', () => {
    // bracket: {min:1000000, max:Infinity, a:0, b:1, c:902}
    expect(lookupScore(X21_TABLE, 1000000)).toBe(902);
    expect(lookupScore(X21_TABLE, 9999999)).toBe(902);
  });

  it('中間値: 5000万円 (50000千円)', () => {
    // bracket: {min:50000, max:60000, a:11, b:10000, c:614}
    // floor(11*50000/10000)+614 = floor(55)+614 = 669
    expect(lookupScore(X21_TABLE, 50000)).toBe(669);
  });
});

// ---------------------------------------------------------------------------
// X22_TABLE（EBITDA→X22評点）
// ---------------------------------------------------------------------------
describe('X22_TABLE', () => {
  it('大幅赤字（負の値）は0点', () => {
    expect(lookupScore(X22_TABLE, -500000)).toBe(0);
    expect(lookupScore(X22_TABLE, -1)).toBe(0);
  });

  it('EBITDA 0は547点', () => {
    // bracket: {min:0, max:10000, a:78, b:10000, c:547}
    // floor(78*0/10000)+547 = 547
    expect(lookupScore(X22_TABLE, 0)).toBe(547);
  });

  it('EBITDA 5000千円', () => {
    // floor(78*5000/10000)+547 = floor(39)+547 = 586
    expect(lookupScore(X22_TABLE, 5000)).toBe(586);
  });

  it('最終ブラケット: 10億円以上は938点固定', () => {
    expect(lookupScore(X22_TABLE, 1000000)).toBe(938);
    expect(lookupScore(X22_TABLE, 5000000)).toBe(938);
  });

  it('中間値: 30000千円', () => {
    // bracket: {min:30000, max:40000, a:15, b:10000, c:622}
    // floor(15*30000/10000)+622 = floor(45)+622 = 667
    expect(lookupScore(X22_TABLE, 30000)).toBe(667);
  });
});

// ---------------------------------------------------------------------------
// Z1_TABLE（技術職員数値→Z1評点）
// ---------------------------------------------------------------------------
describe('Z1_TABLE', () => {
  it('技術職員0人', () => {
    // bracket: {min:0, max:5, a:62, b:5, c:510}
    // floor(62*0/5)+510 = 510
    expect(lookupScore(Z1_TABLE, 0)).toBe(510);
  });

  it('技術職員数値=5', () => {
    // bracket: {min:5, max:10, a:63, b:5, c:509}
    // floor(63*5/5)+509 = 63+509 = 572
    expect(lookupScore(Z1_TABLE, 5)).toBe(572);
  });

  it('技術職員数値=3', () => {
    // bracket: {min:0, max:5, a:62, b:5, c:510}
    // floor(62*3/5)+510 = floor(37.2)+510 = 37+510 = 547
    expect(lookupScore(Z1_TABLE, 3)).toBe(547);
  });

  it('大規模: 技術職員数値=500', () => {
    // bracket: {min:390, max:510, a:63, b:120, c:1247}
    // floor(63*500/120)+1247 = floor(262.5)+1247 = 262+1247 = 1509
    expect(lookupScore(Z1_TABLE, 500)).toBe(1509);
  });

  it('最終ブラケット: 1100以上は1712固定', () => {
    expect(lookupScore(Z1_TABLE, 1100)).toBe(1712);
    expect(lookupScore(Z1_TABLE, 9999)).toBe(1712);
  });

  it('テーブル最小値未満（負の値）はエラーをスローする', () => {
    // Z1_TABLE min=0 → 負の値は範囲外
    expect(() => lookupScore(Z1_TABLE, -1)).toThrow('評点テーブルの該当区間が見つかりません');
  });
});

// ---------------------------------------------------------------------------
// Z2_TABLE（元請完成工事高→Z2評点）
// ---------------------------------------------------------------------------
describe('Z2_TABLE', () => {
  it('元請完成工事高0', () => {
    // bracket: {min:0, max:10000, a:341, b:10000, c:241}
    // floor(341*0/10000)+241 = 241
    expect(lookupScore(Z2_TABLE, 0)).toBe(241);
  });

  it('元請完成工事高5000千円', () => {
    // floor(341*5000/10000)+241 = floor(170.5)+241 = 170+241 = 411
    expect(lookupScore(Z2_TABLE, 5000)).toBe(411);
  });

  it('ブラケット境界: 10000千円', () => {
    // bracket: {min:10000, max:12000, a:16, b:2000, c:502}
    // floor(16*10000/2000)+502 = floor(80)+502 = 582
    expect(lookupScore(Z2_TABLE, 10000)).toBe(582);
  });

  it('中間値: 100000千円 (1億円)', () => {
    // bracket: {min:100000, max:120000, a:26, b:20000, c:702}
    // floor(26*100000/20000)+702 = floor(130)+702 = 832
    expect(lookupScore(Z2_TABLE, 100000)).toBe(832);
  });

  it('最終ブラケット: 20億円以上は1341固定', () => {
    expect(lookupScore(Z2_TABLE, 2000000)).toBe(1341);
    expect(lookupScore(Z2_TABLE, 9999999)).toBe(1341);
  });

  it('テーブル最小値未満（負の値）はエラーをスローする', () => {
    // Z2_TABLE min=0 → 負の値は範囲外
    expect(() => lookupScore(Z2_TABLE, -1)).toThrow('評点テーブルの該当区間が見つかりません');
  });
});

// ---------------------------------------------------------------------------
// テーブル構造の整合性チェック
// ---------------------------------------------------------------------------
describe('テーブルデータ整合性', () => {
  const ALL_TABLES = {
    X1_TABLE,
    X21_TABLE,
    X22_TABLE,
    Z1_TABLE,
    Z2_TABLE,
  };

  for (const [name, table] of Object.entries(ALL_TABLES)) {
    describe(name, () => {
      it('テーブルが空でない', () => {
        expect(table.length).toBeGreaterThan(0);
      });

      it('全エントリが必要なプロパティを持つ', () => {
        for (const bracket of table) {
          expect(bracket).toHaveProperty('min');
          expect(bracket).toHaveProperty('max');
          expect(bracket).toHaveProperty('a');
          expect(bracket).toHaveProperty('b');
          expect(bracket).toHaveProperty('c');
          expect(typeof bracket.min).toBe('number');
          expect(typeof bracket.max).toBe('number');
          expect(typeof bracket.a).toBe('number');
          expect(typeof bracket.b).toBe('number');
          expect(typeof bracket.c).toBe('number');
        }
      });

      it('min < max（各ブラケットの範囲が正しい）', () => {
        for (const bracket of table) {
          expect(bracket.min).toBeLessThan(bracket.max);
        }
      });

      it('ブラケットがmin昇順で隣接している（隙間がない）', () => {
        for (let i = 1; i < table.length; i++) {
          expect(table[i].min).toBe(table[i - 1].max);
        }
      });

      it('最終ブラケットのmaxがInfinity', () => {
        expect(table[table.length - 1].max).toBe(Infinity);
      });

      it('除数bが0でない', () => {
        for (const bracket of table) {
          expect(bracket.b).not.toBe(0);
        }
      });
    });
  }
});

// ---------------------------------------------------------------------------
// 単調性チェック（各ブラケット下限での評点が概ね単調増加）
// ---------------------------------------------------------------------------
describe('テーブル単調性（ブラケット下限での評点）', () => {
  // X22_TABLE は最終ブラケット境界で微小な非単調が存在するため別途検証
  const MONOTONIC_TABLES = {
    X21_TABLE,
    Z1_TABLE,
    Z2_TABLE,
  };

  for (const [name, table] of Object.entries(MONOTONIC_TABLES)) {
    it(`${name}: 各ブラケット下限での評点が単調非減少`, () => {
      const scores: number[] = [];
      for (const bracket of table) {
        // -Infinity のブラケットはスキップ（計算不能）
        if (bracket.min === -Infinity) continue;
        scores.push(lookupScore(table, bracket.min));
      }
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
      }
    });
  }

  // X22_TABLE は最終ブラケット付近で微小な非単調（939→938）があるため、
  // 最終ブラケットを除いて検証する
  it('X22_TABLE: 最終ブラケットを除く下限評点が単調非減少', () => {
    const scores: number[] = [];
    for (let i = 0; i < X22_TABLE.length - 1; i++) {
      const bracket = X22_TABLE[i];
      if (bracket.min === -Infinity) continue;
      scores.push(lookupScore(X22_TABLE, bracket.min));
    }
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });

  // X1_TABLE は非単調ジャンプが既知（CODE-1コメント参照）なので、
  // 先頭〜中間の範囲のみ検証する
  it('X1_TABLE: 先頭20ブラケットの下限評点が単調非減少', () => {
    const scores: number[] = [];
    for (let i = 0; i < 20 && i < X1_TABLE.length; i++) {
      const bracket = X1_TABLE[i];
      if (bracket.min === -Infinity) continue;
      scores.push(lookupScore(X1_TABLE, bracket.min));
    }
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i]).toBeGreaterThanOrEqual(scores[i - 1]);
    }
  });
});
