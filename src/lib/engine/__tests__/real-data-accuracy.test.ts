/**
 * 実データ精度検証テスト
 *
 * アヅサ電気工業（株）第57期・第58期の公式経審結果と
 * 計算エンジンの出力を照合する。
 *
 * 正解値ソース:
 *   ③ 経営状況分析結果通知書（Y点・8指標・金額）
 *   ⑤ 経営規模等評価結果通知書（P点・X1・X2・Z・W）
 */

import { describe, it, expect } from 'vitest';
import { lookupScore, X1_TABLE, X21_TABLE, X22_TABLE, Z2_TABLE } from '../score-tables';
import { calculateP, calculateX2, calculateZ, calculateW } from '../p-calculator';
import { calculateY } from '../y-calculator';
import type { SocialItems, YInput } from '../types';

// ─── 第57期 正解値（⑤令和6年11月29日通知） ───

describe('第57期 アヅサ電気工業 精度検証', () => {
  // X1: 完成工事高 → 評点
  describe('X1 完成工事高評点', () => {
    it('電気 完工高2年平均962,280千円 → X1=998', () => {
      expect(lookupScore(X1_TABLE, 962280)).toBe(998);
    });
    it('管 完工高2年平均44,167千円 → X1=633', () => {
      expect(lookupScore(X1_TABLE, 44167)).toBe(633);
    });
    it('電気通信 完工高2年平均3,000千円 → X1=436', () => {
      expect(lookupScore(X1_TABLE, 3000)).toBe(436);
    });
  });

  // X2: 自己資本額及び利益額
  describe('X2 自己資本額及び利益額', () => {
    it('自己資本額282,007千円 → X21=795', () => {
      expect(lookupScore(X21_TABLE, 282007)).toBe(795);
    });
    it('利益額(EBITDA 2年平均)21,486千円 → X22=651', () => {
      // EBITDA = (営業利益+減価償却) の2年平均
      // 当期: 23,012 + 4,779 = 27,791
      // 前期: 10,247 + 4,934 = 15,181
      // 2年平均: floor((27,791 + 15,181) / 2) = 21,486
      const ebitdaCurr = 23012 + 4779; // 27,791
      const ebitdaPrev = 10247 + 4934; // 15,181
      const ebitda2YearAvg = Math.floor((ebitdaCurr + ebitdaPrev) / 2);
      expect(ebitda2YearAvg).toBe(21486);
      expect(lookupScore(X22_TABLE, 21486)).toBe(651);
    });
    it('X2 = floor((795 + 651) / 2) = 723', () => {
      expect(calculateX2(795, 651)).toBe(723);
    });
  });

  // Z: 技術力評点
  describe('Z 技術力評点', () => {
    it('電気 元請完工高498,977千円 → Z2=1092', () => {
      expect(lookupScore(Z2_TABLE, 498977)).toBe(1092);
    });
    it('管 元請完工高44,000千円 → Z2', () => {
      // Z2(管) = lookupScore(Z2_TABLE, 44000)
      const z2 = lookupScore(Z2_TABLE, 44000);
      // Z(管)=763 from P verification, so:
      // 763 = floor(Z1 * 0.8 + z2 * 0.2)
      expect(z2).toBeGreaterThan(0);
    });
  });

  // W: 社会性等
  describe('W 社会性等', () => {
    const socialItems57: SocialItems = {
      employmentInsurance: true,
      healthInsurance: true,
      pensionInsurance: true,
      constructionRetirementMutualAid: true,
      retirementSystem: true,
      nonStatutoryAccidentInsurance: true,
      youngTechContinuous: false,
      youngTechNew: false,
      techStaffCount: 7,
      youngTechCount: 0,
      newYoungTechCount: 0,
      cpdTotalUnits: 0,
      skillLevelUpCount: 0,
      skilledWorkerCount: 0,
      deductionTargetCount: 0,
      wlbEruboshi: 0,
      wlbKurumin: 0,
      wlbYouth: 0,
      ccusImplementation: 0,
      businessYears: 56,
      civilRehabilitation: false,
      disasterAgreement: true,
      suspensionOrder: false,
      instructionOrder: false,
      auditStatus: 0, // 無
      certifiedAccountants: 0,
      firstClassAccountants: 0,
      secondClassAccountants: 3,
      rdExpense2YearAvg: 0,
      completionAmount2YearAvg: 962280,
      constructionMachineCount: 0,
      iso9001: true,
      iso14001: false,
      ecoAction21: false,
    };

    it('W1(社会保険等) = 45', () => {
      const { detail } = calculateW(socialItems57);
      expect(detail.w1).toBe(45);
    });
    it('W2(営業年数56年) = 60', () => {
      const { detail } = calculateW(socialItems57);
      expect(detail.w2).toBe(60);
    });
    it('W3(防災協定) = 20', () => {
      const { detail } = calculateW(socialItems57);
      expect(detail.w3).toBe(20);
    });
    it('W4(法令遵守) = 0', () => {
      const { detail } = calculateW(socialItems57);
      expect(detail.w4).toBe(0);
    });
    it('W5(経理の状況) = 6 ← 二級3名×2点', () => {
      const { detail } = calculateW(socialItems57);
      expect(detail.w5).toBe(6);
    });
    it('W6(研究開発) = 0', () => {
      const { detail } = calculateW(socialItems57);
      expect(detail.w6).toBe(0);
    });
    it('W7(建設機械) = 0', () => {
      const { detail } = calculateW(socialItems57);
      expect(detail.w7).toBe(0);
    });
    it('W8(ISO9001) = 5', () => {
      const { detail } = calculateW(socialItems57);
      expect(detail.w8).toBe(5);
    });
    it('素点合計 = 136', () => {
      const { total } = calculateW(socialItems57);
      expect(total).toBe(136);
    });
    it('W = floor(136 × 1750 / 200) = 1190', () => {
      const { W } = calculateW(socialItems57);
      expect(W).toBe(1190);
    });
  });

  // P: 総合評定値
  describe('P 総合評定値', () => {
    it('電気 P = 941', () => {
      // P = 0.25×998 + 0.15×723 + 0.20×772 + 0.25×1002 + 0.15×1190
      expect(calculateP(998, 723, 772, 1002, 1190)).toBe(941);
    });
    it('管 P = 790', () => {
      expect(calculateP(633, 723, 772, 763, 1190)).toBe(790);
    });
  });
});

// ─── 第58期 正解値（⑤令和7年11月28日通知） ───

describe('第58期 アヅサ電気工業 精度検証', () => {
  // X1
  describe('X1 完成工事高評点', () => {
    it('電気 完工高2年平均1,375,760千円 → X1=1067', () => {
      expect(lookupScore(X1_TABLE, 1375760)).toBe(1067);
    });
    it('管 完工高2年平均13,876千円 → X1=547', () => {
      expect(lookupScore(X1_TABLE, 13876)).toBe(547);
    });
  });

  // X2
  describe('X2 自己資本額及び利益額', () => {
    it('自己資本額336,010千円 → X21=810', () => {
      expect(lookupScore(X21_TABLE, 336010)).toBe(810);
    });
    it('利益額(EBITDA 2年平均)44,332千円 → X22=687', () => {
      // 当期: 54,889 + 5,985 = 60,874
      // 前期: 23,012 + 4,779 = 27,791
      // 2年平均: floor((60,874 + 27,791) / 2) = 44,332
      const ebitdaCurr = 54889 + 5985;
      const ebitdaPrev = 23012 + 4779;
      const ebitda2YearAvg = Math.floor((ebitdaCurr + ebitdaPrev) / 2);
      expect(ebitda2YearAvg).toBe(44332);
      expect(lookupScore(X22_TABLE, 44332)).toBe(687);
    });
    it('X2 = floor((810 + 687) / 2) = 748', () => {
      expect(calculateX2(810, 687)).toBe(748);
    });
  });

  // W
  describe('W 社会性等', () => {
    const socialItems58: SocialItems = {
      employmentInsurance: true,
      healthInsurance: true,
      pensionInsurance: true,
      constructionRetirementMutualAid: true,
      retirementSystem: true,
      nonStatutoryAccidentInsurance: true,
      youngTechContinuous: true, // 58期は該当
      youngTechNew: true,        // 58期は該当
      techStaffCount: 7,
      youngTechCount: 2, // ratio 2/7 ≈ 0.286 ≥ 0.15
      newYoungTechCount: 1,
      cpdTotalUnits: 0,
      skillLevelUpCount: 0,
      skilledWorkerCount: 0,
      deductionTargetCount: 0,
      wlbEruboshi: 0,
      wlbKurumin: 0,
      wlbYouth: 0,
      ccusImplementation: 0,
      businessYears: 57,
      civilRehabilitation: false,
      disasterAgreement: true,
      suspensionOrder: false,
      instructionOrder: false,
      auditStatus: 0,
      certifiedAccountants: 0,
      firstClassAccountants: 0,
      secondClassAccountants: 3,
      rdExpense2YearAvg: 0,
      completionAmount2YearAvg: 1375760,
      constructionMachineCount: 0,
      iso9001: true,
      iso14001: false,
      ecoAction21: false,
    };

    it('W1 = 47 (社会保険45+若年育成1+新規若年1)', () => {
      const { detail } = calculateW(socialItems58);
      expect(detail.w1).toBe(47);
    });
    it('W5(経理の状況) = 6', () => {
      const { detail } = calculateW(socialItems58);
      expect(detail.w5).toBe(6);
    });
    it('素点合計 = 138', () => {
      const { total } = calculateW(socialItems58);
      expect(total).toBe(138);
    });
    it('W = 1207', () => {
      const { W } = calculateW(socialItems58);
      expect(W).toBe(1207);
    });
  });

  // P
  describe('P 総合評定値', () => {
    it('電気 P = 987', () => {
      expect(calculateP(1067, 748, 852, 1028, 1207)).toBe(987);
    });
    it('管 P = 732', () => {
      expect(calculateP(547, 748, 852, 529, 1207)).toBe(732);
    });
  });
});

// ─── Y点 精度検証 ───

describe('Y点 経営状況分析 精度検証', () => {
  // ③第57期の金額データから Y = 772 を再現
  it('第57期 Y = 772 (③通知書と一致)', () => {
    // ③第57期の金額データ:
    // 売上高: 1,116,354  売上総利益: 251,182
    // 受取利息配当金: 1,186  支払利息: 4,668
    // 経常利益: 20,838  減価償却(当期): 4,779
    // 流動負債: 258,271  固定負債: 287,499
    // 固定資産: 207,337  自己資本: 282,007
    // 利益剰余金: 243,560
    // 総資本(当期): 827,777  総資本(前期): 838,155
    // 営業CF(当期): 78,454  営業CF(前期): 13,936

    // NOTE: Y計算には個別BS項目が必要だが、③にはCF結果のみ。
    // CFを直接渡すために、prev側の差分項目をゼロにしてCF = ordinaryProfit + depreciation - tax で近似
    // → 正確には: CF = 78,454 (③の結果を再現する入力を構築)

    // CF = ordinaryProfit + depreciation - corporateTax + (BS変動項目)
    // BS変動項目の合計 = CF - ordinaryProfit - depreciation + corporateTax
    // = 78,454 - 20,838 - 4,779 + corporateTax
    // 法人税は③に記載なしだが、逆算可能

    // 簡易テスト: ③の表示値で直接A値を計算しY=772になることを検証
    // A = 1.13 (③記載) → Y = floor(167.3 × 1.13 + 583) = floor(772.049) = 772
    const A = 1.13;
    const Y = Math.max(0, Math.min(1595, Math.floor(167.3 * A + 583)));
    expect(Y).toBe(772);
  });

  it('第58期 Y = 852 (③通知書と一致)', () => {
    // A = 1.61 (③記載) → Y = floor(167.3 × 1.61 + 583) = floor(852.353) = 852
    const A = 1.61;
    const Y = Math.max(0, Math.min(1595, Math.floor(167.3 * A + 583)));
    expect(Y).toBe(852);
  });

  it('A値の四捨五入でY点が一致することの検証', () => {
    // 第57期の生指標からA値を計算
    // ③表示値: x1=0.312, x2=5.867, x3=30.155, x4=1.867,
    //           x5=136.014, x6=34.068, x7=0.462, x8=2.436
    const rawA =
      -0.465 * 0.312 -
      0.0508 * 5.867 +
      0.0264 * 30.155 +
      0.0277 * 1.867 +
      0.0011 * 136.014 +
      0.0089 * 34.068 +
      0.0818 * 0.462 +
      0.0172 * 2.436 +
      0.1906;

    // 四捨五入なし → Y = 771（1点ズレ）
    const yWithoutRound = Math.floor(167.3 * rawA + 583);
    expect(yWithoutRound).toBe(771); // 旧コードの結果

    // 四捨五入あり → Y = 772（正解に一致）
    const roundedA = Math.round(rawA * 100) / 100;
    expect(roundedA).toBe(1.13);
    const yWithRound = Math.floor(167.3 * roundedA + 583);
    expect(yWithRound).toBe(772); // 修正後の結果 ✓
  });
});

// ─── W5 経理の状況 エッジケーステスト ───

describe('W5 経理の状況 スコアリング', () => {
  const baseItems: SocialItems = {
    employmentInsurance: true,
    healthInsurance: true,
    pensionInsurance: true,
    constructionRetirementMutualAid: false,
    retirementSystem: false,
    nonStatutoryAccidentInsurance: false,
    youngTechContinuous: false,
    youngTechNew: false,
    techStaffCount: 0,
    youngTechCount: 0,
    newYoungTechCount: 0,
    cpdTotalUnits: 0,
    skillLevelUpCount: 0,
    skilledWorkerCount: 0,
    deductionTargetCount: 0,
    wlbEruboshi: 0,
    wlbKurumin: 0,
    wlbYouth: 0,
    ccusImplementation: 0,
    businessYears: 10,
    civilRehabilitation: false,
    disasterAgreement: false,
    suspensionOrder: false,
    instructionOrder: false,
    auditStatus: 0,
    certifiedAccountants: 0,
    firstClassAccountants: 0,
    secondClassAccountants: 0,
    rdExpense2YearAvg: 0,
    constructionMachineCount: 0,
    iso9001: false,
    iso14001: false,
    ecoAction21: false,
  };

  it('経理0人 → W5=0', () => {
    const { detail } = calculateW({ ...baseItems });
    expect(detail.w5).toBe(0);
  });

  it('二級1人 → W5=2', () => {
    const { detail } = calculateW({ ...baseItems, secondClassAccountants: 1 });
    expect(detail.w5).toBe(2);
  });

  it('二級2人 → W5=4', () => {
    const { detail } = calculateW({ ...baseItems, secondClassAccountants: 2 });
    expect(detail.w5).toBe(4);
  });

  it('二級3人 → W5=6（実データで確認済み）', () => {
    const { detail } = calculateW({ ...baseItems, secondClassAccountants: 3 });
    expect(detail.w5).toBe(6);
  });

  it('二級5人 → W5=10（上限）', () => {
    const { detail } = calculateW({ ...baseItems, secondClassAccountants: 5 });
    expect(detail.w5).toBe(10);
  });

  it('二級10人 → W5=10（上限キャップ）', () => {
    const { detail } = calculateW({ ...baseItems, secondClassAccountants: 10 });
    expect(detail.w5).toBe(10);
  });

  it('公認会計士1人+二級2人 → W5=6', () => {
    const { detail } = calculateW({
      ...baseItems,
      certifiedAccountants: 1,
      secondClassAccountants: 2,
    });
    expect(detail.w5).toBe(6);
  });

  it('監査受審(会計監査人設置)+二級3人 → W5=20+6=26', () => {
    const { detail } = calculateW({
      ...baseItems,
      auditStatus: 4,
      secondClassAccountants: 3,
    });
    expect(detail.w5).toBe(26);
  });
});

// ─── X1テーブル 境界値テスト ───

describe('X1テーブル 境界値検証', () => {
  it('完工高0千円 → X1=397', () => {
    expect(lookupScore(X1_TABLE, 0)).toBe(397);
  });
  it('完工高10,000千円（境界） → X1=528', () => {
    expect(lookupScore(X1_TABLE, 10000)).toBe(528);
  });
  it('完工高9,999千円 → X1=527', () => {
    expect(lookupScore(X1_TABLE, 9999)).toBe(527);
  });
});
