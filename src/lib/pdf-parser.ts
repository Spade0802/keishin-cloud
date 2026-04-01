/**
 * PDF決算書パーサー
 *
 * テキストPDF → pdf-parse でテキスト抽出
 * スキャンPDF → Google Cloud Vision API でOCR → テキスト抽出
 * 抽出テキスト → 財務データへマッピング
 */

import type { RawFinancialData } from './engine/types';

interface ParseResult {
  data: Partial<RawFinancialData>;
  warnings: string[];
  mappings: { source: string; target: string; value: number }[];
  ocrUsed: boolean;
}

// ─── テキスト抽出 ───

/** pdfjs-dist でテキストPDFからテキスト抽出 */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;

  const textParts: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items
      .filter((item) => 'str' in item)
      .map((item) => (item as { str: string }).str)
      .join(' ');
    textParts.push(pageText);
  }

  return textParts.join('\n');
}

/** Google Cloud Vision API でスキャンPDFをOCR */
async function ocrWithVision(buffer: Buffer): Promise<string> {
  const { ImageAnnotatorClient } = await import('@google-cloud/vision');

  // Cloud Run上ではデフォルトサービスアカウントで認証
  // ローカルではGOOGLE_APPLICATION_CREDENTIALS環境変数
  const client = new ImageAnnotatorClient();

  // PDF全ページをOCR (最大5ページ)
  const content = buffer.toString('base64');

  const [result] = await client.documentTextDetection({
    image: { content },
    imageContext: {
      languageHints: ['ja', 'en'],
    },
  });

  return result.fullTextAnnotation?.text || '';
}

// ─── テキストから数値抽出 ───

/**
 * テキスト行から「科目名 金額」のペアを抽出
 * 建設業決算書の様々なフォーマットに対応:
 *  - "完成工事高    1,668,128"
 *  - "完成工事高 1668128"
 *  - "完成工事高　　　　1,668,128千円"
 *  - 表形式: "完成工事高 | 1,668,128 | 1,500,000"
 */
function extractLabelValuePairs(text: string): { label: string; value: number }[] {
  const pairs: { label: string; value: number }[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    // 全角スペース→半角、タブ→スペースに正規化
    const normalized = line
      .replace(/\u3000/g, ' ')
      .replace(/\t/g, ' ')
      .replace(/\|/g, ' ')
      .trim();

    if (!normalized) continue;

    // パターン: 日本語ラベル + スペース + 数値（カンマ付き可、マイナス対応）
    // 複数の数値がある場合（当期/前期）、最初の数値を取る
    const match = normalized.match(
      /^([^\d△▲\-,.\s][^\d△▲\-,.]*?)\s+(△|▲)?[\s]*([\d,]+(?:\.\d+)?)/
    );

    if (match) {
      const label = match[1].trim();
      const isNegative = match[2] === '△' || match[2] === '▲';
      const numStr = match[3].replace(/,/g, '');
      const value = parseFloat(numStr);

      if (!isNaN(value) && label.length >= 2) {
        pairs.push({
          label,
          value: isNegative ? -value : value,
        });
      }
    }

    // 別パターン: マイナス記号が先頭の場合
    const matchNeg = normalized.match(
      /^([^\d△▲\-,.\s][^\d△▲\-,.]*?)\s+[-−]([\d,]+(?:\.\d+)?)/
    );
    if (matchNeg && !match) {
      const label = matchNeg[1].trim();
      const numStr = matchNeg[2].replace(/,/g, '');
      const value = parseFloat(numStr);
      if (!isNaN(value) && label.length >= 2) {
        pairs.push({ label, value: -value });
      }
    }
  }

  return pairs;
}

// ─── 科目マッピング（Fuzzyマッチ対応） ───

interface MappingRule {
  patterns: (string | RegExp)[];
  target: string;
  assign: (data: Partial<RawFinancialData>, value: number) => void;
}

const MAPPING_RULES: MappingRule[] = [
  // ── PL科目 ──
  {
    patterns: ['完成工事高'],
    target: 'PL/完成工事高',
    assign: (d, v) => { if (d.pl) d.pl.completedConstruction = v; },
  },
  {
    patterns: [/出来高/],
    target: 'PL/出来高工事高',
    assign: (d, v) => { if (d.pl) d.pl.progressConstruction = v; },
  },
  {
    patterns: ['売上高', '売上高合計'],
    target: 'PL/売上高',
    assign: (d, v) => { if (d.pl) d.pl.totalSales = v; },
  },
  {
    patterns: ['完成工事原価'],
    target: 'PL/完成工事原価',
    assign: (d, v) => { if (d.pl) d.pl.costOfSales = v; },
  },
  {
    patterns: ['売上総利益'],
    target: 'PL/売上総利益',
    assign: (d, v) => { if (d.pl) d.pl.grossProfit = v; },
  },
  {
    patterns: ['営業利益'],
    target: 'PL/営業利益',
    assign: (d, v) => { if (d.pl) d.pl.operatingProfit = v; },
  },
  {
    patterns: ['受取利息'],
    target: 'PL/受取利息',
    assign: (d, v) => { if (d.pl) d.pl.interestIncome = v; },
  },
  {
    patterns: ['受取配当金'],
    target: 'PL/受取配当金',
    assign: (d, v) => { if (d.pl) d.pl.dividendIncome = v; },
  },
  {
    patterns: [/支払利息/],
    target: 'PL/支払利息',
    assign: (d, v) => { if (d.pl) d.pl.interestExpense = v; },
  },
  {
    patterns: ['経常利益'],
    target: 'PL/経常利益',
    assign: (d, v) => { if (d.pl) d.pl.ordinaryProfit = v; },
  },
  {
    patterns: [/特別利益/],
    target: 'PL/特別利益',
    assign: (d, v) => { if (d.pl) d.pl.specialGain = v; },
  },
  {
    patterns: [/特別損失/],
    target: 'PL/特別損失',
    assign: (d, v) => { if (d.pl) d.pl.specialLoss = v; },
  },
  {
    patterns: [/法人税/, /法人税等/],
    target: 'PL/法人税等',
    assign: (d, v) => {
      if (d.pl && !d.pl.corporateTax) d.pl.corporateTax = v;
    },
  },
  {
    patterns: [/当期純利益/, /当期利益/],
    target: 'PL/当期純利益',
    assign: (d, v) => { if (d.pl) d.pl.netIncome = v; },
  },

  // ── BS流動資産 ──
  {
    patterns: ['現金及び預金', '現金預金'],
    target: '流動資産/現金及び預金',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['現金及び預金'] = v; },
  },
  {
    patterns: ['受取手形'],
    target: '流動資産/受取手形',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['受取手形'] = v; },
  },
  {
    patterns: ['完成工事未収入金'],
    target: '流動資産/完成工事未収入金',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['完成工事未収入金'] = v; },
  },
  {
    patterns: ['未成工事支出金'],
    target: '流動資産/未成工事支出金',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['未成工事支出金'] = v; },
  },
  {
    patterns: ['材料貯蔵品'],
    target: '流動資産/材料貯蔵品',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['材料貯蔵品'] = v; },
  },

  // ── BS有形固定資産 ──
  {
    patterns: ['建物'],
    target: '有形固定資産/建物',
    assign: (d, v) => { if (d.bs) d.bs.tangibleFixed['建物'] = v; },
  },
  {
    patterns: ['機械装置', '機械及び装置'],
    target: '有形固定資産/機械装置',
    assign: (d, v) => { if (d.bs) d.bs.tangibleFixed['機械装置'] = v; },
  },
  {
    patterns: ['車両運搬具'],
    target: '有形固定資産/車両運搬具',
    assign: (d, v) => { if (d.bs) d.bs.tangibleFixed['車両運搬具'] = v; },
  },
  {
    patterns: ['土地'],
    target: '有形固定資産/土地',
    assign: (d, v) => { if (d.bs) d.bs.tangibleFixed['土地'] = v; },
  },

  // ── BS流動負債 ──
  {
    patterns: ['支払手形'],
    target: '流動負債/支払手形',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['支払手形'] = v; },
  },
  {
    patterns: ['工事未払金'],
    target: '流動負債/工事未払金',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['工事未払金'] = v; },
  },
  {
    patterns: ['短期借入金'],
    target: '流動負債/短期借入金',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['短期借入金'] = v; },
  },
  {
    patterns: ['未成工事受入金'],
    target: '流動負債/未成工事受入金',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['未成工事受入金'] = v; },
  },

  // ── BS固定負債 ──
  {
    patterns: ['長期借入金'],
    target: '固定負債/長期借入金',
    assign: (d, v) => { if (d.bs) d.bs.fixedLiabilities['長期借入金'] = v; },
  },

  // ── BS純資産 ──
  {
    patterns: ['資本金'],
    target: '純資産/資本金',
    assign: (d, v) => { if (d.bs) d.bs.equity['資本金'] = v; },
  },
  {
    patterns: ['利益準備金'],
    target: '純資産/利益準備金',
    assign: (d, v) => { if (d.bs) d.bs.equity['利益準備金'] = v; },
  },
  {
    patterns: ['別途積立金'],
    target: '純資産/別途積立金',
    assign: (d, v) => { if (d.bs) d.bs.equity['別途積立金'] = v; },
  },
  {
    patterns: [/繰越利益/],
    target: '純資産/繰越利益剰余金',
    assign: (d, v) => { if (d.bs) d.bs.equity['繰越利益剰余金'] = v; },
  },

  // ── BS合計行 ──
  {
    patterns: [/流動資産合計/],
    target: 'BS/流動資産合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.currentAssets = v; },
  },
  {
    patterns: [/有形固定資産合計/],
    target: 'BS/有形固定資産合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.tangibleFixed = v; },
  },
  {
    patterns: ['固定資産合計'],
    target: 'BS/固定資産合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.fixedAssets = v; },
  },
  {
    patterns: ['資産合計', '資産の部合計'],
    target: 'BS/資産合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.totalAssets = v; },
  },
  {
    patterns: [/流動負債合計/],
    target: 'BS/流動負債合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.currentLiabilities = v; },
  },
  {
    patterns: [/固定負債合計/],
    target: 'BS/固定負債合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.fixedLiabilities = v; },
  },
  {
    patterns: ['負債合計', '負債の部合計'],
    target: 'BS/負債合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.totalLiabilities = v; },
  },
  {
    patterns: ['純資産合計', '純資産の部合計'],
    target: 'BS/純資産合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.totalEquity = v; },
  },

  // ── 原価報告書 ──
  {
    patterns: ['材料費'],
    target: '原価/材料費',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.materials = v; },
  },
  {
    patterns: ['労務費'],
    target: '原価/労務費',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.labor = v; },
  },
  {
    patterns: ['外注費'],
    target: '原価/外注費',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.subcontract = v; },
  },
  {
    patterns: [/^経費$/, '製造経費'],
    target: '原価/経費',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.expenses = v; },
  },
  {
    patterns: [/減価償却費/],
    target: '原価/減価償却費',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.mfgDepreciation = v; },
  },
];

function matchLabel(label: string, patterns: (string | RegExp)[]): boolean {
  for (const p of patterns) {
    if (typeof p === 'string') {
      if (label === p) return true;
    } else {
      if (p.test(label)) return true;
    }
  }
  return false;
}

// ── 「未払法人税等」を法人税のassignに誤マッチさせないための除外パターン ──
function shouldSkip(label: string, target: string): boolean {
  if (target === 'PL/法人税等' && label.includes('未払')) return true;
  return false;
}

// ─── メインパーサー ───

function initEmptyData(): Partial<RawFinancialData> {
  return {
    bs: {
      currentAssets: {},
      tangibleFixed: {},
      intangibleFixed: {},
      investments: {},
      currentLiabilities: {},
      fixedLiabilities: {},
      equity: {},
      totals: {
        currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0,
        investments: 0, fixedAssets: 0, totalAssets: 0,
        currentLiabilities: 0, fixedLiabilities: 0, totalLiabilities: 0,
        totalEquity: 0,
      },
    },
    pl: {
      completedConstruction: 0, progressConstruction: 0, totalSales: 0,
      costOfSales: 0, grossProfit: 0, sgaItems: {}, sgaTotal: 0,
      operatingProfit: 0, interestIncome: 0, dividendIncome: 0, miscIncome: 0,
      interestExpense: 0, miscExpense: 0, ordinaryProfit: 0,
      specialGain: 0, specialLoss: 0, preTaxProfit: 0, corporateTax: 0, netIncome: 0,
    },
    manufacturing: {
      materials: 0, labor: 0, expenses: 0, subcontract: 0,
      mfgDepreciation: 0, wipBeginning: 0, wipEnding: 0, totalCost: 0,
    },
    sga: { sgaDepreciation: 0 },
  };
}

function mapTextToData(
  text: string,
  data: Partial<RawFinancialData>,
  mappings: { source: string; target: string; value: number }[],
): void {
  const pairs = extractLabelValuePairs(text);
  const usedTargets = new Set<string>();

  for (const { label, value } of pairs) {
    for (const rule of MAPPING_RULES) {
      if (usedTargets.has(rule.target)) continue;
      if (shouldSkip(label, rule.target)) continue;

      if (matchLabel(label, rule.patterns)) {
        rule.assign(data, value);
        mappings.push({ source: label, target: rule.target, value });
        usedTargets.add(rule.target);
        break;
      }
    }
  }
}

/**
 * PDFファイルを解析して決算書データを抽出
 *
 * 1. まずテキスト抽出を試行
 * 2. テキストが少なければスキャンPDFと判断しOCR実行
 * 3. 抽出テキストから科目・金額ペアを認識
 */
export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  const warnings: string[] = [];
  const mappings: { source: string; target: string; value: number }[] = [];
  const data = initEmptyData();
  let ocrUsed = false;

  // Step 1: テキスト抽出を試行
  let text = '';
  try {
    text = await extractTextFromPDF(buffer);
  } catch (e) {
    warnings.push('テキスト抽出に失敗しました。OCRを試行します。');
  }

  // Step 2: テキストが少なければOCR（スキャンPDFの可能性）
  const meaningfulChars = text.replace(/[\s\r\n]/g, '').length;
  const isScanned = meaningfulChars < 100;

  if (isScanned) {
    if (!process.env.GOOGLE_APPLICATION_CREDENTIALS && !process.env.GOOGLE_CLOUD_PROJECT) {
      // Cloud Run上ではデフォルトサービスアカウントで動作するが、
      // ローカルでは明示的な設定が必要
      const hasDefaultCredentials = process.env.GCLOUD_PROJECT || process.env.K_SERVICE;
      if (!hasDefaultCredentials) {
        warnings.push(
          'OCR機能を使用するにはGoogle Cloud Vision APIの認証設定が必要です。' +
          'GOOGLE_APPLICATION_CREDENTIALS環境変数を設定してください。'
        );
        return { data, warnings, mappings, ocrUsed: false };
      }
    }

    try {
      text = await ocrWithVision(buffer);
      ocrUsed = true;
      if (!text) {
        warnings.push('OCRでテキストを検出できませんでした。ファイルの品質を確認してください。');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`OCR処理に失敗しました: ${msg}`);
      return { data, warnings, mappings, ocrUsed: false };
    }
  }

  if (!text) {
    warnings.push('PDFからテキストを抽出できませんでした。');
    return { data, warnings, mappings, ocrUsed };
  }

  // Step 3: テキストから科目マッピング
  mapTextToData(text, data, mappings);

  if (mappings.length === 0) {
    warnings.push(
      'PDFから決算書データを認識できませんでした。' +
      '科目名と金額が明確に記載された決算書PDFをご利用ください。'
    );
  } else if (ocrUsed) {
    warnings.push(
      `OCRで読み取りました（${mappings.length}項目）。` +
      'スキャン品質により誤認識の可能性があります。数値を必ずご確認ください。'
    );
  }

  return { data, warnings, mappings, ocrUsed };
}
