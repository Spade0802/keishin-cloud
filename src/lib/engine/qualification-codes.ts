/**
 * 有資格区分コード表（経審 技術職員 Z1評点の基礎）
 *
 * 公式の経営事項審査における有資格区分コードと、
 * 各コードの対応業種・基本点数をマスターデータとして定義する。
 *
 * 点数ルール:
 *   6点 = 1級 + 監理技術者講習受講 + 監理技術者資格者証
 *   5点 = 1級施工管理技士、技術士、1級建築士 等
 *   4点 = 監理技術者補佐（1級技士補）
 *   3点 = 登録基幹技能者、能力評価レベル4技能者
 *   2点 = 2級施工管理技士、第一種電気工事士、1級技能士 等
 *   1点 = 第二種電気工事士（実務3年）、2級技能士（実務3年）等
 */

/** 資格の基本グレード */
export type QualificationGrade =
  | '1級'        // 5点（監理技術者条件で6点に昇格可能）
  | '1級技士補'  // 4点（監理技術者補佐）
  | '基幹技能者' // 3点
  | '2級'        // 2点
  | 'その他';    // 1点

/** ポイントマッピング */
export const GRADE_BASE_POINTS: Record<QualificationGrade, number> = {
  '1級': 5,
  '1級技士補': 4,
  '基幹技能者': 3,
  '2級': 2,
  'その他': 1,
};

/** 資格コード1件の定義 */
export interface QualificationCodeEntry {
  /** 有資格区分コード（3桁数値） */
  code: number;
  /** 資格名称 */
  name: string;
  /** 基本グレード */
  grade: QualificationGrade;
  /** 基本点数（監理技術者昇格前） */
  basePoints: number;
  /** 対応業種コード（2桁文字列の配列） */
  targetIndustries: string[];
  /** 1級資格か（監理技術者昇格の対象になるか） */
  canUpgradeToSupervisor: boolean;
}

/**
 * 有資格区分コード マスターテーブル
 *
 * 業種コード:
 *   01=土木, 02=建築, 03=大工, 04=左官, 05=とび・土工・コンクリート,
 *   06=石, 07=屋根, 08=電気, 09=管, 10=タイル・れんが・ブロック,
 *   11=鋼構造物, 12=鉄筋, 13=舗装, 14=しゅんせつ, 15=板金,
 *   16=ガラス, 17=塗装, 18=防水, 19=内装仕上, 20=機械器具設置,
 *   21=熱絶縁, 22=電気通信, 23=造園, 24=さく井, 25=建具,
 *   26=水道施設, 27=消防施設, 28=清掃施設, 29=解体
 */
export const QUALIFICATION_CODE_TABLE: QualificationCodeEntry[] = [
  // ────────────────────────────────────────────────
  // 建設機械施工管理技士
  // ────────────────────────────────────────────────
  { code: 101, name: '1級建設機械施工管理技士', grade: '1級', basePoints: 5, targetIndustries: ['01', '05', '13'], canUpgradeToSupervisor: true },
  { code: 102, name: '2級建設機械施工管理技士（第1種〜第6種）', grade: '2級', basePoints: 2, targetIndustries: ['01', '05', '13'], canUpgradeToSupervisor: false },
  { code: 170, name: '1級建設機械施工管理技士補', grade: '1級技士補', basePoints: 4, targetIndustries: ['01', '05', '13'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // 土木施工管理技士
  // ────────────────────────────────────────────────
  { code: 103, name: '1級土木施工管理技士', grade: '1級', basePoints: 5, targetIndustries: ['01', '05', '13', '14', '24', '26', '29'], canUpgradeToSupervisor: true },
  { code: 104, name: '2級土木施工管理技士（土木）', grade: '2級', basePoints: 2, targetIndustries: ['01', '05', '13', '14', '24', '26', '29'], canUpgradeToSupervisor: false },
  { code: 171, name: '1級土木施工管理技士補', grade: '1級技士補', basePoints: 4, targetIndustries: ['01', '05', '13', '14', '24', '26', '29'], canUpgradeToSupervisor: false },
  { code: 105, name: '2級土木施工管理技士（鋼構造物塗装）', grade: '2級', basePoints: 2, targetIndustries: ['17'], canUpgradeToSupervisor: false },
  { code: 106, name: '2級土木施工管理技士（薬液注入）', grade: '2級', basePoints: 2, targetIndustries: ['01', '05'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // 建築施工管理技士
  // ────────────────────────────────────────────────
  { code: 107, name: '1級建築施工管理技士', grade: '1級', basePoints: 5, targetIndustries: ['02', '03', '04', '05', '06', '07', '10', '11', '15', '16', '17', '18', '19', '25', '29'], canUpgradeToSupervisor: true },
  { code: 108, name: '2級建築施工管理技士（建築）', grade: '2級', basePoints: 2, targetIndustries: ['02', '29'], canUpgradeToSupervisor: false },
  { code: 172, name: '1級建築施工管理技士補', grade: '1級技士補', basePoints: 4, targetIndustries: ['02', '03', '04', '05', '06', '07', '10', '11', '15', '16', '17', '18', '19', '25', '29'], canUpgradeToSupervisor: false },
  { code: 109, name: '2級建築施工管理技士（躯体）', grade: '2級', basePoints: 2, targetIndustries: ['02', '03', '05', '10', '11', '12', '29'], canUpgradeToSupervisor: false },
  { code: 110, name: '2級建築施工管理技士（仕上げ）', grade: '2級', basePoints: 2, targetIndustries: ['02', '03', '04', '07', '15', '16', '17', '18', '19', '25', '29'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // 電気工事施工管理技士
  // ────────────────────────────────────────────────
  { code: 127, name: '1級電気工事施工管理技士', grade: '1級', basePoints: 5, targetIndustries: ['08'], canUpgradeToSupervisor: true },
  { code: 128, name: '2級電気工事施工管理技士', grade: '2級', basePoints: 2, targetIndustries: ['08'], canUpgradeToSupervisor: false },
  { code: 173, name: '1級電気工事施工管理技士補', grade: '1級技士補', basePoints: 4, targetIndustries: ['08'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // 管工事施工管理技士
  // ────────────────────────────────────────────────
  { code: 129, name: '1級管工事施工管理技士', grade: '1級', basePoints: 5, targetIndustries: ['09', '21', '27'], canUpgradeToSupervisor: true },
  { code: 130, name: '2級管工事施工管理技士', grade: '2級', basePoints: 2, targetIndustries: ['09', '21', '27'], canUpgradeToSupervisor: false },
  { code: 174, name: '1級管工事施工管理技士補', grade: '1級技士補', basePoints: 4, targetIndustries: ['09', '21', '27'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // 電気通信工事施工管理技士
  // ────────────────────────────────────────────────
  { code: 131, name: '1級電気通信工事施工管理技士', grade: '1級', basePoints: 5, targetIndustries: ['22'], canUpgradeToSupervisor: true },
  { code: 132, name: '2級電気通信工事施工管理技士', grade: '2級', basePoints: 2, targetIndustries: ['22'], canUpgradeToSupervisor: false },
  { code: 175, name: '1級電気通信工事施工管理技士補', grade: '1級技士補', basePoints: 4, targetIndustries: ['22'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // 造園施工管理技士
  // ────────────────────────────────────────────────
  { code: 133, name: '1級造園施工管理技士', grade: '1級', basePoints: 5, targetIndustries: ['23'], canUpgradeToSupervisor: true },
  { code: 134, name: '2級造園施工管理技士', grade: '2級', basePoints: 2, targetIndustries: ['23'], canUpgradeToSupervisor: false },
  { code: 176, name: '1級造園施工管理技士補', grade: '1級技士補', basePoints: 4, targetIndustries: ['23'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // 建築士
  // ────────────────────────────────────────────────
  { code: 135, name: '1級建築士', grade: '1級', basePoints: 5, targetIndustries: ['02', '03', '04', '05', '06', '07', '10', '11', '15', '16', '17', '18', '19', '25'], canUpgradeToSupervisor: true },
  { code: 136, name: '2級建築士', grade: '2級', basePoints: 2, targetIndustries: ['02', '03', '19', '25'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // 技術士（各部門）
  // ────────────────────────────────────────────────
  { code: 137, name: '技術士（建設部門）', grade: '1級', basePoints: 5, targetIndustries: ['01', '02', '05', '13', '14', '24', '26', '29'], canUpgradeToSupervisor: true },
  { code: 138, name: '技術士（農業部門 - 農業土木）', grade: '1級', basePoints: 5, targetIndustries: ['01', '05', '13', '14', '24', '26', '29'], canUpgradeToSupervisor: true },
  { code: 139, name: '技術士（電気電子部門）', grade: '1級', basePoints: 5, targetIndustries: ['08', '22'], canUpgradeToSupervisor: true },
  { code: 140, name: '技術士（機械部門）', grade: '1級', basePoints: 5, targetIndustries: ['09', '20', '21'], canUpgradeToSupervisor: true },
  { code: 141, name: '技術士（上下水道部門）', grade: '1級', basePoints: 5, targetIndustries: ['09', '26', '27'], canUpgradeToSupervisor: true },
  { code: 142, name: '技術士（水産部門 - 水産土木）', grade: '1級', basePoints: 5, targetIndustries: ['01', '05', '13', '14', '24', '26', '29'], canUpgradeToSupervisor: true },
  { code: 143, name: '技術士（森林部門 - 林業/森林土木）', grade: '1級', basePoints: 5, targetIndustries: ['01', '05', '23'], canUpgradeToSupervisor: true },
  { code: 144, name: '技術士（総合技術監理部門）', grade: '1級', basePoints: 5, targetIndustries: ['01', '02', '05', '08', '09', '13', '14', '20', '21', '22', '23', '24', '26', '27', '29'], canUpgradeToSupervisor: true },
  { code: 145, name: '技術士（衛生工学部門）', grade: '1級', basePoints: 5, targetIndustries: ['09', '21', '27', '28'], canUpgradeToSupervisor: true },

  // ────────────────────────────────────────────────
  // 電気工事士
  // ────────────────────────────────────────────────
  { code: 152, name: '第一種電気工事士', grade: '2級', basePoints: 2, targetIndustries: ['08'], canUpgradeToSupervisor: false },
  { code: 153, name: '第二種電気工事士（実務経験3年以上）', grade: 'その他', basePoints: 1, targetIndustries: ['08'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // 消防設備士
  // ────────────────────────────────────────────────
  { code: 155, name: '甲種消防設備士', grade: '2級', basePoints: 2, targetIndustries: ['27'], canUpgradeToSupervisor: false },
  { code: 156, name: '乙種消防設備士', grade: 'その他', basePoints: 1, targetIndustries: ['27'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // 技能士（1級 = 2点、2級+実務3年 = 1点）
  // ────────────────────────────────────────────────
  // 建築大工
  { code: 201, name: '1級建築大工技能士', grade: '2級', basePoints: 2, targetIndustries: ['02', '03'], canUpgradeToSupervisor: false },
  { code: 202, name: '2級建築大工技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['02', '03'], canUpgradeToSupervisor: false },
  // 型枠施工
  { code: 203, name: '1級型枠施工技能士', grade: '2級', basePoints: 2, targetIndustries: ['02', '03'], canUpgradeToSupervisor: false },
  { code: 204, name: '2級型枠施工技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['02', '03'], canUpgradeToSupervisor: false },
  // とび
  { code: 205, name: '1級とび技能士', grade: '2級', basePoints: 2, targetIndustries: ['05', '29'], canUpgradeToSupervisor: false },
  { code: 206, name: '2級とび技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['05', '29'], canUpgradeToSupervisor: false },
  // 左官
  { code: 207, name: '1級左官技能士', grade: '2級', basePoints: 2, targetIndustries: ['04'], canUpgradeToSupervisor: false },
  { code: 208, name: '2級左官技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['04'], canUpgradeToSupervisor: false },
  // 配管
  { code: 209, name: '1級配管技能士', grade: '2級', basePoints: 2, targetIndustries: ['09', '21', '27'], canUpgradeToSupervisor: false },
  { code: 210, name: '2級配管技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['09', '21', '27'], canUpgradeToSupervisor: false },
  // 鉄筋施工
  { code: 211, name: '1級鉄筋施工技能士', grade: '2級', basePoints: 2, targetIndustries: ['12'], canUpgradeToSupervisor: false },
  { code: 212, name: '2級鉄筋施工技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['12'], canUpgradeToSupervisor: false },
  // ブロック建築
  { code: 213, name: '1級ブロック建築技能士', grade: '2級', basePoints: 2, targetIndustries: ['10'], canUpgradeToSupervisor: false },
  { code: 214, name: '2級ブロック建築技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['10'], canUpgradeToSupervisor: false },
  // 石工
  { code: 215, name: '1級石工技能士', grade: '2級', basePoints: 2, targetIndustries: ['06'], canUpgradeToSupervisor: false },
  { code: 216, name: '2級石工技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['06'], canUpgradeToSupervisor: false },
  // かわらぶき
  { code: 217, name: '1級かわらぶき技能士', grade: '2級', basePoints: 2, targetIndustries: ['07'], canUpgradeToSupervisor: false },
  { code: 218, name: '2級かわらぶき技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['07'], canUpgradeToSupervisor: false },
  // 板金
  { code: 219, name: '1級建築板金技能士', grade: '2級', basePoints: 2, targetIndustries: ['15'], canUpgradeToSupervisor: false },
  { code: 220, name: '2級建築板金技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['15'], canUpgradeToSupervisor: false },
  // ガラス施工
  { code: 221, name: '1級ガラス施工技能士', grade: '2級', basePoints: 2, targetIndustries: ['16'], canUpgradeToSupervisor: false },
  { code: 222, name: '2級ガラス施工技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['16'], canUpgradeToSupervisor: false },
  // 塗装
  { code: 223, name: '1級塗装技能士', grade: '2級', basePoints: 2, targetIndustries: ['17'], canUpgradeToSupervisor: false },
  { code: 224, name: '2級塗装技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['17'], canUpgradeToSupervisor: false },
  // 防水施工
  { code: 225, name: '1級防水施工技能士', grade: '2級', basePoints: 2, targetIndustries: ['18'], canUpgradeToSupervisor: false },
  { code: 226, name: '2級防水施工技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['18'], canUpgradeToSupervisor: false },
  // 内装仕上げ施工
  { code: 227, name: '1級内装仕上げ施工技能士', grade: '2級', basePoints: 2, targetIndustries: ['19'], canUpgradeToSupervisor: false },
  { code: 228, name: '2級内装仕上げ施工技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['19'], canUpgradeToSupervisor: false },
  // 熱絶縁施工
  { code: 229, name: '1級熱絶縁施工技能士', grade: '2級', basePoints: 2, targetIndustries: ['21'], canUpgradeToSupervisor: false },
  { code: 230, name: '2級熱絶縁施工技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['21'], canUpgradeToSupervisor: false },
  // さく井
  { code: 231, name: '1級さく井技能士', grade: '2級', basePoints: 2, targetIndustries: ['24'], canUpgradeToSupervisor: false },
  { code: 232, name: '2級さく井技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['24'], canUpgradeToSupervisor: false },
  // 建具製作
  { code: 233, name: '1級建具製作技能士', grade: '2級', basePoints: 2, targetIndustries: ['25'], canUpgradeToSupervisor: false },
  { code: 234, name: '2級建具製作技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['25'], canUpgradeToSupervisor: false },
  // 造園
  { code: 235, name: '1級造園技能士', grade: '2級', basePoints: 2, targetIndustries: ['23'], canUpgradeToSupervisor: false },
  { code: 236, name: '2級造園技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['23'], canUpgradeToSupervisor: false },
  // 溶接
  { code: 237, name: '1級鉄工（製缶）技能士', grade: '2級', basePoints: 2, targetIndustries: ['11'], canUpgradeToSupervisor: false },
  { code: 238, name: '2級鉄工（製缶）技能士（実務3年）', grade: 'その他', basePoints: 1, targetIndustries: ['11'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // 登録基幹技能者（3点）
  // ────────────────────────────────────────────────
  { code: 301, name: '登録基幹技能者（土木）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['01'], canUpgradeToSupervisor: false },
  { code: 302, name: '登録基幹技能者（建築）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['02'], canUpgradeToSupervisor: false },
  { code: 303, name: '登録基幹技能者（大工）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['03'], canUpgradeToSupervisor: false },
  { code: 304, name: '登録基幹技能者（左官）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['04'], canUpgradeToSupervisor: false },
  { code: 305, name: '登録基幹技能者（とび）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['05'], canUpgradeToSupervisor: false },
  { code: 306, name: '登録基幹技能者（石）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['06'], canUpgradeToSupervisor: false },
  { code: 307, name: '登録基幹技能者（屋根）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['07'], canUpgradeToSupervisor: false },
  { code: 308, name: '登録基幹技能者（電気）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['08'], canUpgradeToSupervisor: false },
  { code: 309, name: '登録基幹技能者（管）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['09'], canUpgradeToSupervisor: false },
  { code: 310, name: '登録基幹技能者（タイル）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['10'], canUpgradeToSupervisor: false },
  { code: 311, name: '登録基幹技能者（鋼構造物）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['11'], canUpgradeToSupervisor: false },
  { code: 312, name: '登録基幹技能者（鉄筋）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['12'], canUpgradeToSupervisor: false },
  { code: 313, name: '登録基幹技能者（舗装）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['13'], canUpgradeToSupervisor: false },
  { code: 315, name: '登録基幹技能者（板金）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['15'], canUpgradeToSupervisor: false },
  { code: 317, name: '登録基幹技能者（塗装）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['17'], canUpgradeToSupervisor: false },
  { code: 318, name: '登録基幹技能者（防水）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['18'], canUpgradeToSupervisor: false },
  { code: 319, name: '登録基幹技能者（内装仕上）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['19'], canUpgradeToSupervisor: false },
  { code: 320, name: '登録基幹技能者（機械器具）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['20'], canUpgradeToSupervisor: false },
  { code: 321, name: '登録基幹技能者（熱絶縁）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['21'], canUpgradeToSupervisor: false },
  { code: 322, name: '登録基幹技能者（電気通信）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['22'], canUpgradeToSupervisor: false },
  { code: 323, name: '登録基幹技能者（造園）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['23'], canUpgradeToSupervisor: false },
  { code: 325, name: '登録基幹技能者（建具）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['25'], canUpgradeToSupervisor: false },
  { code: 327, name: '登録基幹技能者（消防施設）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['27'], canUpgradeToSupervisor: false },
  { code: 329, name: '登録基幹技能者（解体）', grade: '基幹技能者', basePoints: 3, targetIndustries: ['29'], canUpgradeToSupervisor: false },

  // ────────────────────────────────────────────────
  // その他（実務経験のみ等 = 1点）
  // ────────────────────────────────────────────────
  { code: 999, name: '実務経験者（10年以上）', grade: 'その他', basePoints: 1, targetIndustries: [], canUpgradeToSupervisor: false },
];

/**
 * コード番号で資格を高速検索するためのMap
 */
const _codeMap = new Map<number, QualificationCodeEntry>();
for (const entry of QUALIFICATION_CODE_TABLE) {
  _codeMap.set(entry.code, entry);
}

/**
 * 有資格区分コードからエントリを取得する
 * @returns エントリ、または未知のコードの場合は1点のデフォルトエントリ
 */
export function getQualificationByCode(code: number): QualificationCodeEntry {
  const entry = _codeMap.get(code);
  if (entry) return entry;

  // 未知のコード → 1点（その他）として扱う
  return {
    code,
    name: `不明な資格コード(${code})`,
    grade: 'その他',
    basePoints: 1,
    targetIndustries: [],
    canUpgradeToSupervisor: false,
  };
}

/**
 * 資格コードが指定業種に対応しているかチェック
 */
export function isQualificationValidForIndustry(
  qualCode: number,
  industryCode: string,
): boolean {
  const entry = getQualificationByCode(qualCode);
  // targetIndustries が空 = 業種問わず（実務経験者など）
  if (entry.targetIndustries.length === 0 && entry.code === 999) return true;
  return entry.targetIndustries.includes(industryCode.padStart(2, '0'));
}
