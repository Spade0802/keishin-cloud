/**
 * P点統合計算エンジン
 *
 * P = 0.25×X1 + 0.15×X2 + 0.20×Y + 0.25×Z + 0.15×W
 * 範囲: 6 ≤ P ≤ 2160
 */

import type { SocialItems, WDetail } from './types';

/**
 * 激変緩和措置（経審の完成工事高 X1 用）
 *
 * 経審では完成工事高について、当期・2年平均・3年平均のうち
 * 最も有利な（大きい）値を採用できる。
 *
 * @param curr  当期完成工事高
 * @param prev  前期完成工事高
 * @param prevPrev  前々期完成工事高（任意）
 * @returns 採用される完成工事高（最大値）
 */
export function calculateX1WithAverage(
  curr: number,
  prev: number,
  prevPrev?: number,
): number {
  const twoYearAvg = Math.floor((curr + prev) / 2);
  if (prevPrev !== undefined && prevPrev !== null) {
    const threeYearAvg = Math.floor((curr + prev + prevPrev) / 3);
    return Math.max(curr, twoYearAvg, threeYearAvg);
  }
  return Math.max(curr, twoYearAvg);
}

/**
 * 総合評定値（P点）を算出する。
 *
 * P = 0.25*X1 + 0.15*X2 + 0.20*Y + 0.25*Z + 0.15*W
 * 結果は整数に切り捨て、6 以上 2160 以下にクランプされる。
 *
 * @param x1 完成工事高評点 X1
 * @param x2 経営状況分析評点 X2
 * @param y  経営状況評点 Y
 * @param z  技術力評点 Z
 * @param w  社会性等評点 W
 * @returns P点（6 <= P <= 2160）
 */
export function calculateP(
  x1: number,
  x2: number,
  y: number,
  z: number,
  w: number
): number {
  const raw = 0.25 * x1 + 0.15 * x2 + 0.2 * y + 0.25 * z + 0.15 * w;
  return Math.max(6, Math.min(2160, Math.floor(raw)));
}

/**
 * 経営状況分析評点 X2 を算出する。
 *
 * X2 = floor((X21 + X22) / 2)
 *
 * @param x21 自己資本額評点
 * @param x22 EBITDA 評点
 * @returns X2 評点
 */
export function calculateX2(x21: number, x22: number): number {
  return Math.floor((x21 + x22) / 2);
}

/**
 * 技術力評点 Z を算出する。
 *
 * Z = floor(Z1 * 0.8 + Z2 * 0.2)
 *
 * @param z1 技術職員数値評点
 * @param z2 元請完成工事高評点
 * @returns Z 評点
 */
export function calculateZ(z1: number, z2: number): number {
  return Math.floor(z1 * 0.8 + z2 * 0.2);
}

/**
 * 社会性等評点 W を算出する。
 *
 * W1〜W8 の各項目を合算し、W = floor(total * 1750 / 200) で換算する。
 * W1: 社会保険・若年技術者・CPD・技能レベル・WLB・CCUS
 * W2: 営業年数  W3: 防災活動  W4: 法令遵守
 * W5: 監査・経理  W6: 研究開発費  W7: 建設機械  W8: ISO等
 *
 * @param items 社会性等の入力項目
 * @returns total（素点合計）、W（換算後評点）、detail（W1〜W8 内訳）
 */
export function calculateW(items: SocialItems): {
  total: number;
  W: number;
  detail: WDetail;
} {
  // W1: 社会保険等
  let w1 = 0;
  if (!items.employmentInsurance) w1 -= 40;
  if (!items.healthInsurance) w1 -= 40;
  if (!items.pensionInsurance) w1 -= 40;
  if (items.constructionRetirementMutualAid) w1 += 15;
  if (items.retirementSystem) w1 += 15;
  if (items.nonStatutoryAccidentInsurance) w1 += 15;

  // 若年技術職員の継続的な育成及び確保
  if (items.youngTechContinuous && Number.isFinite(items.techStaffCount) && items.techStaffCount > 0) {
    const ratio = items.youngTechCount / items.techStaffCount;
    if (ratio >= 0.15) w1 += 1;
  }
  // 新規若年技術職員の育成及び確保
  if (items.youngTechNew && items.newYoungTechCount > 0) {
    w1 += 1;
  }

  // CPD単位（技術職員1人あたり）
  if (Number.isFinite(items.techStaffCount) && items.techStaffCount > 0) {
    const cpdPerPerson = items.cpdTotalUnits / items.techStaffCount;
    if (cpdPerPerson >= 30) w1 += 10;
    else if (cpdPerPerson >= 15) w1 += 5;
    else if (cpdPerPerson >= 5) w1 += 3;
    else if (cpdPerPerson >= 1) w1 += 1;
  }

  // 技能レベル向上者数
  if (Number.isFinite(items.techStaffCount) && items.techStaffCount > 0) {
    const skillRatio = items.skillLevelUpCount / items.techStaffCount;
    if (skillRatio >= 0.15) w1 += 10;
    else if (skillRatio >= 0.10) w1 += 7;
    else if (skillRatio >= 0.05) w1 += 3;
    else if (skillRatio > 0) w1 += 1;
  }

  // WLB（女性活躍推進法）
  if (items.wlbEruboshi >= 4) w1 += 5;
  else if (items.wlbEruboshi >= 3) w1 += 3;
  else if (items.wlbEruboshi >= 2) w1 += 2;
  else if (items.wlbEruboshi >= 1) w1 += 1;

  // くるみん
  if (items.wlbKurumin >= 4) w1 += 5;
  else if (items.wlbKurumin >= 3) w1 += 3;
  else if (items.wlbKurumin >= 2) w1 += 2;
  else if (items.wlbKurumin >= 1) w1 += 1;

  // ユースエール
  if (items.wlbYouth >= 2) w1 += 4;
  else if (items.wlbYouth >= 1) w1 += 2;

  // CCUS就業履歴蓄積
  if (items.ccusImplementation >= 3) w1 += 15;
  else if (items.ccusImplementation >= 2) w1 += 10;
  else if (items.ccusImplementation >= 1) w1 += 5;

  // W2: 営業年数
  let w2 = 0;
  if (items.civilRehabilitation) {
    w2 = -60;
  } else {
    if (items.businessYears >= 35) w2 = 60;
    else if (items.businessYears > 5) w2 = (items.businessYears - 5) * 2;
  }

  // W3: 防災活動
  const w3 = items.disasterAgreement ? 20 : 0;

  // W4: 法令遵守
  let w4 = 0;
  if (items.suspensionOrder) w4 = -30;
  else if (items.instructionOrder) w4 = -15;

  // W5: 監査 + 経理
  let w5 = 0;
  // 監査受審状況
  if (items.auditStatus === 4) w5 += 20;
  else if (items.auditStatus === 3) w5 += 14;
  else if (items.auditStatus === 2) w5 += 8;
  else if (items.auditStatus === 1) w5 += 4;
  // 公認会計士等の数（経理の状況）
  // 公式: 公認会計士等数 n = 公認会計士等 + 1級建設業経理士 + 2級建設業経理士（各1人）
  //        経理の状況の点数 = min(10, n × 2)
  // 参照: 経審 別表第一 W5 公認会計士等の数
  // 実データ検証: 2級×3名 → 経理の状況=6点（⑤第57期/58期 通知書で確認済み）
  const accountingPersons =
    items.certifiedAccountants +
    items.firstClassAccountants +
    items.secondClassAccountants;
  w5 += Math.min(10, accountingPersons * 2);

  // W6: 研究開発費
  // 研究開発費(2年平均) ÷ 完成工事高(2年平均) × 100 の比率で評点化
  let w6 = 0;
  if (
    items.rdExpense2YearAvg > 0 &&
    items.completionAmount2YearAvg != null &&
    items.completionAmount2YearAvg > 0
  ) {
    const rdRatio =
      (items.rdExpense2YearAvg / items.completionAmount2YearAvg) * 100;
    if (rdRatio >= 5) w6 = 25;
    else if (rdRatio >= 3) w6 = 15;
    else if (rdRatio >= 1) w6 = 5;
    // rdRatio < 1 → 0点
  }

  // W7: 建設機械保有
  let w7 = 0;
  if (items.constructionMachineCount >= 15) w7 = 15;
  else w7 = items.constructionMachineCount;

  // W8: ISO等
  const isoPoints =
    (items.iso9001 ? 5 : 0) +
    (items.iso14001 ? 5 : 0) +
    (items.ecoAction21 ? 5 : 0);
  const w8 = Math.min(10, isoPoints);

  const total = w1 + w2 + w3 + w4 + w5 + w6 + w7 + w8;
  const W = Math.floor((total * 1750) / 200);

  return {
    total,
    W,
    detail: { w1, w2, w3, w4, w5, w6, w7, w8, total },
  };
}
