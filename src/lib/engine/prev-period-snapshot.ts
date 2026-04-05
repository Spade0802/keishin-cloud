/**
 * 前期スナップショット生成
 *
 * 決算期の確定時に、次期のCF計算に必要なBS値を抽出して保存する。
 * 新規決算期作成時にDBから読み出し、prev フィールドを自動セットする。
 */

import type { KeishinBS } from './types';

export interface PrevPeriodSnapshot {
  /** 資産合計 (千円) */
  totalCapital: number;
  /** 営業CF (千円) */
  operatingCF: number;
  /** 貸倒引当金 (千円, 絶対値) */
  allowanceDoubtful: number;
  /** 受取手形 + 完成工事未収入金 (千円) */
  notesAndReceivable: number;
  /** 工事未払金 (千円) */
  constructionPayable: number;
  /** 未成工事支出金 + 材料貯蔵品 (千円) */
  inventoryAndMaterials: number;
  /** 未成工事受入金 (千円) */
  advanceReceived: number;
}

/**
 * 経審用BS(千円)と営業CFから、次期用の前期スナップショットを構築する。
 */
export function buildPrevPeriodSnapshot(
  bs: KeishinBS,
  operatingCF: number
): PrevPeriodSnapshot {
  return {
    totalCapital: bs.totalAssets,
    operatingCF,
    allowanceDoubtful: Math.abs(bs.allowanceDoubtful),
    notesAndReceivable: bs.notesReceivable + bs.accountsReceivableConstruction,
    constructionPayable: bs.constructionPayable,
    inventoryAndMaterials: bs.wipConstruction + bs.materialInventory,
    advanceReceived: bs.advanceReceivedConstruction,
  };
}
