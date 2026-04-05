/**
 * P点統合計算エンジン
 *
 * P = 0.25×X1 + 0.15×X2 + 0.20×Y + 0.25×Z + 0.15×W
 * 範囲: 6 ≤ P ≤ 2160
 */

import type { SocialItems, WDetail } from './types';

export function calculateP(
  x1: number,
  x2: number,
  y: number,
  z: number,
  w: number
): number {
  const raw = 0.25 * x1 + 0.15 * x2 + 0.2 * y + 0.25 * z + 0.15 * w;
  return Math.max(6, Math.min(2160, Math.round(raw)));
}

export function calculateX2(x21: number, x22: number): number {
  return Math.floor((x21 + x22) / 2);
}

export function calculateZ(z1: number, z2: number): number {
  return Math.floor(z1 * 0.8 + z2 * 0.2);
}

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
  if (items.youngTechContinuous && items.techStaffCount > 0) {
    const ratio = items.youngTechCount / items.techStaffCount;
    if (ratio >= 0.15) w1 += 1;
  }
  // 新規若年技術職員の育成及び確保
  if (items.youngTechNew && items.newYoungTechCount > 0) {
    w1 += 1;
  }

  // CPD単位（技術職員1人あたり）
  if (items.techStaffCount > 0) {
    const cpdPerPerson = items.cpdTotalUnits / items.techStaffCount;
    if (cpdPerPerson >= 30) w1 += 10;
    else if (cpdPerPerson >= 15) w1 += 5;
    else if (cpdPerPerson >= 5) w1 += 3;
    else if (cpdPerPerson >= 1) w1 += 1;
  }

  // 技能レベル向上者数
  if (items.techStaffCount > 0) {
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
  // 公認会計士
  w5 += items.certifiedAccountants * 1;
  // 経理（1級・2級）
  w5 += items.firstClassAccountants * 1;
  w5 += items.secondClassAccountants * 1;

  // W6: 研究開発費
  let w6 = 0;
  if (items.rdExpense2YearAvg > 0) {
    // 研究開発費÷売上高×100 で評点化
    // 簡易的に金額ベースで加点
    w6 = Math.min(25, Math.floor(items.rdExpense2YearAvg / 10000));
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
