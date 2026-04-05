/**
 * 抽出フィールドマッピング設定
 *
 * Gemini PDF 抽出の出力フィールドと、ウィザードのフォームフィールドの
 * 対応関係を一元管理する。
 *
 * 各エントリは:
 * - extractionPath: KeishinPdfResult 内のドット区切りパス
 * - formTarget: ウィザード state のキー（or SocialItems のキー）
 * - section: どの Step / セクションに属するか
 * - type: 'number' | 'boolean' | 'string'
 * - validation: min/max/required 等
 * - priority: データソースの優先度
 */

// ─── データソース優先度 ───

export type DataSource =
  | 'direct_pdf'         // PDF から直接抽出（最高優先）
  | 'derived_from_pdf'   // PDF データから計算/推定
  | 'user_input'         // ユーザー手入力
  | null;                // データなし

export interface FieldMeta {
  source: DataSource;
  /** 値が設定された時刻 */
  timestamp: number;
  /** ユーザーが上書きしたか */
  userOverridden: boolean;
}

// ─── フィールドマッピング定義 ───

export type FieldSection =
  | 'basic_info'
  | 'financial'
  | 'industry'
  | 'w_items'
  | 'tech_staff';

export type FieldType = 'number' | 'boolean' | 'string';

export interface FieldMapping {
  /** KeishinPdfResult 内のパス（ドット区切り） */
  extractionPath: string;
  /** ウィザードの state key または SocialItems のキー */
  formTarget: string;
  /** 所属セクション */
  section: FieldSection;
  /** 値の型 */
  type: FieldType;
  /** 日本語ラベル */
  label: string;
  /** バリデーション */
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
  };
}

// ─── 基本情報マッピング ───

export const BASIC_INFO_MAPPINGS: FieldMapping[] = [
  {
    extractionPath: 'basicInfo.companyName',
    formTarget: 'basicInfo.companyName',
    section: 'basic_info',
    type: 'string',
    label: '会社名',
    validation: { required: true },
  },
  {
    extractionPath: 'basicInfo.permitNumber',
    formTarget: 'basicInfo.permitNumber',
    section: 'basic_info',
    type: 'string',
    label: '許可番号',
  },
  {
    extractionPath: 'basicInfo.reviewBaseDate',
    formTarget: 'basicInfo.reviewBaseDate',
    section: 'basic_info',
    type: 'string',
    label: '審査基準日',
  },
  {
    extractionPath: 'basicInfo.periodNumber',
    formTarget: 'basicInfo.periodNumber',
    section: 'basic_info',
    type: 'string',
    label: '決算期',
  },
];

// ─── 財務データマッピング ───

export const FINANCIAL_MAPPINGS: FieldMapping[] = [
  {
    extractionPath: 'equity',
    formTarget: 'equity',
    section: 'financial',
    type: 'number',
    label: '自己資本額',
    validation: { min: -10_000_000, max: 100_000_000 },
  },
  {
    extractionPath: 'ebitda',
    formTarget: 'ebitda',
    section: 'financial',
    type: 'number',
    label: '利払前税引前償却前利益',
    validation: { min: -10_000_000, max: 100_000_000 },
  },
];

// ─── 業種マッピング（動的：業種数による） ───

export const INDUSTRY_FIELD_KEYS = [
  'name',
  'prevCompletion',
  'currCompletion',
  'prevPrimeContract',
  'currPrimeContract',
  'techStaffValue',
] as const;

// ─── W項目（社会性等）マッピング ───

export const W_ITEMS_MAPPINGS: FieldMapping[] = [
  // 保険加入
  { extractionPath: 'wItems.employmentInsurance', formTarget: 'employmentInsurance', section: 'w_items', type: 'boolean', label: '雇用保険加入' },
  { extractionPath: 'wItems.healthInsurance', formTarget: 'healthInsurance', section: 'w_items', type: 'boolean', label: '健康保険加入' },
  { extractionPath: 'wItems.pensionInsurance', formTarget: 'pensionInsurance', section: 'w_items', type: 'boolean', label: '厚生年金保険加入' },

  // 労働福祉
  { extractionPath: 'wItems.constructionRetirementMutualAid', formTarget: 'constructionRetirementMutualAid', section: 'w_items', type: 'boolean', label: '建設業退職金共済制度' },
  { extractionPath: 'wItems.retirementSystem', formTarget: 'retirementSystem', section: 'w_items', type: 'boolean', label: '退職一時金制度' },
  { extractionPath: 'wItems.nonStatutoryAccidentInsurance', formTarget: 'nonStatutoryAccidentInsurance', section: 'w_items', type: 'boolean', label: '法定外労災補償制度' },

  // 技術者・技能者
  { extractionPath: 'wItems.youngTechContinuous', formTarget: 'youngTechContinuous', section: 'w_items', type: 'boolean', label: '若年技術職員の継続的育成確保' },
  { extractionPath: 'wItems.youngTechNew', formTarget: 'youngTechNew', section: 'w_items', type: 'boolean', label: '新規若年技術職員の育成確保' },
  { extractionPath: 'wItems.techStaffCount', formTarget: 'techStaffCount', section: 'w_items', type: 'number', label: '技術職員数', validation: { min: 0, max: 10000 } },
  { extractionPath: 'wItems.youngTechCount', formTarget: 'youngTechCount', section: 'w_items', type: 'number', label: '若年技術職員数', validation: { min: 0, max: 10000 } },
  { extractionPath: 'wItems.newYoungTechCount', formTarget: 'newYoungTechCount', section: 'w_items', type: 'number', label: '新規若年技術職員数', validation: { min: 0, max: 10000 } },
  { extractionPath: 'wItems.cpdTotalUnits', formTarget: 'cpdTotalUnits', section: 'w_items', type: 'number', label: 'CPD単位合計', validation: { min: 0, max: 100000 } },
  { extractionPath: 'wItems.skillLevelUpCount', formTarget: 'skillLevelUpCount', section: 'w_items', type: 'number', label: '技能レベル向上者数', validation: { min: 0, max: 10000 } },
  { extractionPath: 'wItems.skilledWorkerCount', formTarget: 'skilledWorkerCount', section: 'w_items', type: 'number', label: '技能者数', validation: { min: 0, max: 10000 } },
  { extractionPath: 'wItems.deductionTargetCount', formTarget: 'deductionTargetCount', section: 'w_items', type: 'number', label: '控除対象者数', validation: { min: 0, max: 10000 } },

  // WLB
  { extractionPath: 'wItems.wlbEruboши', formTarget: 'wlbEruboши', section: 'w_items', type: 'number', label: 'えるぼし認定', validation: { min: 0, max: 4 } },
  { extractionPath: 'wItems.wlbKurumin', formTarget: 'wlbKurumin', section: 'w_items', type: 'number', label: 'くるみん認定', validation: { min: 0, max: 4 } },
  { extractionPath: 'wItems.wlbYouth', formTarget: 'wlbYouth', section: 'w_items', type: 'number', label: 'ユースエール認定', validation: { min: 0, max: 2 } },

  // CCUS
  { extractionPath: 'wItems.ccusImplementation', formTarget: 'ccusImplementation', section: 'w_items', type: 'number', label: 'CCUS活用レベル', validation: { min: 0, max: 3 } },

  // 営業年数・法令遵守
  { extractionPath: 'wItems.businessYears', formTarget: 'businessYears', section: 'w_items', type: 'number', label: '営業年数', validation: { min: 0, max: 100 } },
  { extractionPath: 'wItems.civilRehabilitation', formTarget: 'civilRehabilitation', section: 'w_items', type: 'boolean', label: '民事再生法・会社更生法' },
  { extractionPath: 'wItems.disasterAgreement', formTarget: 'disasterAgreement', section: 'w_items', type: 'boolean', label: '防災協定' },
  { extractionPath: 'wItems.suspensionOrder', formTarget: 'suspensionOrder', section: 'w_items', type: 'boolean', label: '営業停止処分' },
  { extractionPath: 'wItems.instructionOrder', formTarget: 'instructionOrder', section: 'w_items', type: 'boolean', label: '指示処分' },

  // 監査・経理
  { extractionPath: 'wItems.auditStatus', formTarget: 'auditStatus', section: 'w_items', type: 'number', label: '監査受審状況', validation: { min: 0, max: 4 } },
  { extractionPath: 'wItems.certifiedAccountants', formTarget: 'certifiedAccountants', section: 'w_items', type: 'number', label: '公認会計士数', validation: { min: 0, max: 100 } },
  { extractionPath: 'wItems.firstClassAccountants', formTarget: 'firstClassAccountants', section: 'w_items', type: 'number', label: '建設業経理士1級', validation: { min: 0, max: 100 } },
  { extractionPath: 'wItems.secondClassAccountants', formTarget: 'secondClassAccountants', section: 'w_items', type: 'number', label: '建設業経理士2級', validation: { min: 0, max: 100 } },

  // 研究開発・機械・ISO
  { extractionPath: 'wItems.rdExpense2YearAvg', formTarget: 'rdExpense2YearAvg', section: 'w_items', type: 'number', label: '研究開発費（2期平均）', validation: { min: 0, max: 100_000_000 } },
  { extractionPath: 'wItems.constructionMachineCount', formTarget: 'constructionMachineCount', section: 'w_items', type: 'number', label: '建設機械保有台数', validation: { min: 0, max: 1000 } },
  { extractionPath: 'wItems.iso9001', formTarget: 'iso9001', section: 'w_items', type: 'boolean', label: 'ISO 9001' },
  { extractionPath: 'wItems.iso14001', formTarget: 'iso14001', section: 'w_items', type: 'boolean', label: 'ISO 14001' },
  { extractionPath: 'wItems.ecoAction21', formTarget: 'ecoAction21', section: 'w_items', type: 'boolean', label: 'エコアクション21' },
];

// ─── 技術職員関連マッピング ───

export const TECH_STAFF_MAPPINGS: FieldMapping[] = [
  { extractionPath: 'techStaffCount', formTarget: 'techStaffCount', section: 'tech_staff', type: 'number', label: '技術職員数合計', validation: { min: 0, max: 10000 } },
  { extractionPath: 'businessYears', formTarget: 'businessYears', section: 'w_items', type: 'number', label: '営業年数', validation: { min: 0, max: 100 } },
];

// ─── 全マッピングの統合 ───

export const ALL_MAPPINGS: FieldMapping[] = [
  ...BASIC_INFO_MAPPINGS,
  ...FINANCIAL_MAPPINGS,
  ...W_ITEMS_MAPPINGS,
  ...TECH_STAFF_MAPPINGS,
];

// ─── ヘルパー関数 ───

/**
 * ドット区切りパスでオブジェクトから値を取得
 */
export function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object') {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

/**
 * 業種名の正規化（短縮名 → 正式名への変換テーブル）
 */
export const INDUSTRY_NAME_ALIASES: Record<string, string> = {
  '土木': '土木一式工事',
  '建築': '建築一式工事',
  '大工': '大工工事',
  '左官': '左官工事',
  'とび': 'とび・土工・コンクリート工事',
  '石': '石工事',
  '屋根': '屋根工事',
  '電気': '電気工事',
  '管': '管工事',
  'タイル': 'タイル・れんが・ブロック工事',
  '鋼構造物': '鋼構造物工事',
  '鉄筋': '鉄筋工事',
  '舗装': '舗装工事',
  'ほ装': '舗装工事',
  'しゅんせつ': 'しゅんせつ工事',
  '板金': '板金工事',
  'ガラス': 'ガラス工事',
  '塗装': '塗装工事',
  '防水': '防水工事',
  '内装': '内装仕上工事',
  '内装仕上': '内装仕上工事',
  '機械器具': '機械器具設置工事',
  '熱絶縁': '熱絶縁工事',
  '電気通信': '電気通信工事',
  '造園': '造園工事',
  'さく井': 'さく井工事',
  '建具': '建具工事',
  '水道': '水道施設工事',
  '水道施設': '水道施設工事',
  '消防施設': '消防施設工事',
  '清掃': '清掃施設工事',
  '解体': '解体工事',
};

/**
 * 業種名を正式名に正規化する
 * 既に正式名であればそのまま返す
 */
export function normalizeIndustryName(name: string): string {
  if (!name) return name;
  // 末尾に「工事」が付いていて、ALIASES に含まれなければ正式名とみなす
  if (name.endsWith('工事')) {
    return INDUSTRY_NAME_ALIASES[name] ?? name;
  }
  return INDUSTRY_NAME_ALIASES[name] ?? name;
}
