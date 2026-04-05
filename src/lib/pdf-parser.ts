/**
 * PDF決算書パーサー v3
 *
 * 一次抽出: Gemini Vision API（PDF直接入力）
 * フォールバック1: Document AI Form Parser
 * フォールバック2: Google Cloud Vision API OCR
 * フォールバック3: pdfjs-dist テキスト抽出 + 正規表現マッピング
 *
 * v3 改善点:
 * - Gemini 2.5 Flash による高精度な構造化データ抽出を一次手段として使用
 * - 従来の Document AI / Vision API / テキスト解析はフォールバックとして維持
 */

import type { RawFinancialData } from './engine/types';
import { extractFinancialDataWithGemini, isGeminiAvailable, autoCorrectUnit } from './gemini-extractor';
import { logger } from './logger';

interface ParseResult {
  data: Partial<RawFinancialData>;
  warnings: string[];
  mappings: { source: string; target: string; value: number }[];
  ocrUsed: boolean;
  rawText?: string; // デバッグ用
}

// ─── テキスト抽出（座標ベース行再構成） ───

interface TextItem {
  str: string;
  x: number;
  y: number;
  width: number;
}

/** pdfjs-dist でテキストPDFからテキスト抽出（座標ベース行再構成） */
async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');

  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;

  const allLines: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    // テキストアイテムを座標付きで収集
    const items: TextItem[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !('transform' in item)) continue;
      const raw = item as { str: string; transform: number[]; width: number };
      if (!raw.str.trim()) continue;
      items.push({
        str: raw.str,
        x: raw.transform[4],  // x座標
        y: raw.transform[5],  // y座標
        width: raw.width,
      });
    }

    // Y座標でグルーピングして「行」を再構成
    // PDFの座標は下から上なので、Y降順でソート
    const yTolerance = 3; // 同一行とみなすY座標の許容差
    const groups = new Map<number, TextItem[]>();

    for (const item of items) {
      let foundKey: number | null = null;
      for (const key of groups.keys()) {
        if (Math.abs(item.y - key) <= yTolerance) {
          foundKey = key;
          break;
        }
      }
      if (foundKey !== null) {
        groups.get(foundKey)!.push(item);
      } else {
        groups.set(item.y, [item]);
      }
    }

    // Y座標降順（上から下へ）、各行内はX座標昇順（左から右へ）
    const sortedKeys = [...groups.keys()].sort((a, b) => b - a);
    for (const key of sortedKeys) {
      const lineItems = groups.get(key)!.sort((a, b) => a.x - b.x);

      // 間隔が大きい部分にタブ区切りを挿入（表の列区切り）
      let line = '';
      for (let j = 0; j < lineItems.length; j++) {
        if (j > 0) {
          const gap = lineItems[j].x - (lineItems[j - 1].x + lineItems[j - 1].width);
          if (gap > 10) {
            line += '\t';
          } else if (gap > 2) {
            line += ' ';
          }
        }
        line += lineItems[j].str;
      }
      if (line.trim()) {
        allLines.push(line.trim());
      }
    }

    allLines.push('--- PAGE BREAK ---');
  }

  return allLines.join('\n');
}

/** Google Cloud Vision API でスキャンPDFをOCR（複数ページ対応） */
async function ocrWithVision(buffer: Buffer): Promise<string> {
  const { ImageAnnotatorClient } = await import('@google-cloud/vision');
  const client = new ImageAnnotatorClient();
  const content = buffer.toString('base64');

  const features = [{ type: 'DOCUMENT_TEXT_DETECTION' as const }];
  const imageContext = { languageHints: ['ja', 'en'] };
  const inputConfig = { mimeType: 'application/pdf', content };

  // batchAnnotateFiles は1リクエストあたり最大5ページ
  // 決算書は通常6-10ページなので、5ページずつ分割してリクエスト
  const MAX_PAGES_PER_REQUEST = 5;
  const allText: string[] = [];

  // まず最初の5ページをリクエスト
  for (let startPage = 1; startPage <= 20; startPage += MAX_PAGES_PER_REQUEST) {
    const pages = Array.from(
      { length: MAX_PAGES_PER_REQUEST },
      (_, i) => startPage + i
    );

    try {
      const [result] = await client.batchAnnotateFiles({
        requests: [{ inputConfig, features, imageContext, pages }],
      });

      const responses = result?.responses?.[0]?.responses || [];
      if (responses.length === 0 && startPage > 1) {
        // これ以上ページがない
        break;
      }

      for (const pageResp of responses) {
        const text = pageResp?.fullTextAnnotation?.text;
        if (text) {
          allText.push(text);
          allText.push('--- PAGE BREAK ---');
        }
      }

      // 返されたページ数が要求数より少なければ、最後のバッチ
      if (responses.length < MAX_PAGES_PER_REQUEST) break;
    } catch (e) {
      // ページ範囲外のエラーなら終了
      const msg = e instanceof Error ? e.message : String(e);
      if (startPage > 1 && (msg.includes('page') || msg.includes('INVALID'))) {
        break;
      }
      // 最初のバッチで失敗した場合はエラーを投げる
      if (startPage === 1) throw e;
      break;
    }
  }

  return allText.join('\n');
}

// ─── Document AI Form Parser ───

interface DocAIField {
  name: string;
  value: string;
  confidence: number;
}

interface DocAIResult {
  fullText: string;
  pageTexts: string[];
  formFields: DocAIField[];
}

async function ocrWithDocumentAI(buffer: Buffer): Promise<DocAIResult | null> {
  const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'jww-dxf-converter';
  const location = 'us';
  const processorId = process.env.DOCUMENT_AI_PROCESSOR_ID || '660ca751a3b05c46';

  try {
    const { DocumentProcessorServiceClient } = await import('@google-cloud/documentai');
    const client = new DocumentProcessorServiceClient();

    const name = `projects/${projectId}/locations/${location}/processors/${processorId}`;
    const [response] = await client.processDocument({
      name,
      rawDocument: {
        content: buffer.toString('base64'),
        mimeType: 'application/pdf',
      },
    });

    const document = response.document;
    if (!document?.text) return null;

    const fullText = document.text;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extractText = (textAnchor: any): string => {
      if (!textAnchor?.textSegments) return '';
      return (textAnchor.textSegments as Array<{ startIndex?: unknown; endIndex?: unknown }>)
        .map(seg => {
          const start = Number(seg.startIndex || 0);
          const end = Number(seg.endIndex || 0);
          return fullText.slice(start, end);
        })
        .join('')
        .trim();
    };

    const allFields: DocAIField[] = [];
    const pageTexts: string[] = [];

    for (const page of document.pages || []) {
      // ページテキスト
      const texts: string[] = [];
      for (const para of page.paragraphs || []) {
        const t = extractText(para.layout?.textAnchor);
        if (t) texts.push(t);
      }
      pageTexts.push(texts.join('\n'));

      // フォームフィールド
      for (const field of page.formFields || []) {
        const fieldName = extractText(field.fieldName?.textAnchor).replace(/[:\s：]+$/, '').trim();
        const fieldValue = extractText(field.fieldValue?.textAnchor).trim();
        const confidence = Number(field.fieldValue?.confidence ?? 0);
        if (fieldName && fieldValue) {
          allFields.push({ name: fieldName, value: fieldValue, confidence });
        }
      }

      // テーブルからもフィールド抽出
      for (const table of page.tables || []) {
        for (const row of table.bodyRows || []) {
          const cells = row.cells || [];
          if (cells.length >= 2) {
            const label = extractText(cells[0].layout?.textAnchor).trim();
            const value = extractText(cells[1].layout?.textAnchor).trim();
            if (label && value && /[\d０-９]/.test(value)) {
              allFields.push({ name: label, value, confidence: 0.8 });
            }
          }
        }
      }
    }

    return { fullText, pageTexts, formFields: allFields };
  } catch (e) {
    logger.error('Document AI error:', e);
    return null;
  }
}

/** Document AI formFields から MAPPING_RULES を使って財務データを埋める */
function mapDocAIFieldsToData(
  fields: DocAIField[],
  data: Partial<RawFinancialData>,
  mappings: { source: string; target: string; value: number }[],
): void {
  const usedTargets = new Set<string>();

  for (const field of fields) {
    const label = cleanLabelText(
      field.name
        .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
        .replace(/\u3000/g, ' ')
    );
    const numVal = parseJapaneseNumber(field.value);
    if (!label || numVal === null) continue;

    for (const rule of MAPPING_RULES) {
      if (usedTargets.has(rule.target)) continue;
      if (shouldSkip(label, rule.target)) continue;

      if (matchLabel(label, rule.patterns)) {
        rule.assign(data, numVal);
        mappings.push({ source: `DocAI:${label}`, target: rule.target, value: numVal });
        usedTargets.add(rule.target);
        break;
      }
    }
  }
}

// ─── テキストから数値抽出 v2 ───

/**
 * テキスト行から「科目名 金額」のペアを抽出
 *
 * v2: 表形式PDF対応
 *  - タブ区切り対応（座標ベース行再構成でタブが入る）
 *  - 「科目名  金額  金額」のパターン（当期/前期並列）
 *  - 全角数字対応
 *  - 「※」「注」などの注釈除外
 *  - 空白カンマ混在対応
 */
function extractLabelValuePairs(text: string): { label: string; value: number }[] {
  const pairs: { label: string; value: number }[] = [];
  const lines = text.split('\n');

  for (const line of lines) {
    if (line.startsWith('--- PAGE BREAK ---')) continue;
    if (!line.trim()) continue;

    // 全角→半角数字
    let normalized = line
      .replace(/[０-９]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
      .replace(/\u3000/g, '\t')  // 全角スペース→タブ
      .replace(/，/g, ',')        // 全角カンマ→半角
      .replace(/．/g, '.')        // 全角ピリオド→半角
      .trim();

    // 注釈行はスキップ
    if (/^[※注（\(]/.test(normalized)) continue;

    // タブ区切りの場合、セルに分割
    const cells = normalized.split(/\t+/);

    if (cells.length >= 2) {
      // 表形式: 最初のセルが科目名、後続セルに数値がある
      const labelCell = cells[0].trim();
      if (!labelCell || /^\d/.test(labelCell)) continue;

      // 数値セルを探す（最初に見つかった有効な数値を使用）
      for (let ci = 1; ci < cells.length; ci++) {
        const numResult = parseJapaneseNumber(cells[ci].trim());
        if (numResult !== null) {
          const cleanLabel = cleanLabelText(labelCell);
          if (cleanLabel && cleanLabel.length >= 1) {
            pairs.push({ label: cleanLabel, value: numResult });
          }
          break; // 最初の数値列（当期）を取る
        }
      }
    } else {
      // 単一行: 「科目名 金額」パターン
      // 科目名部分と数値部分を分離
      const match = normalized.match(
        /^(.+?)\s+(△|▲|-)?\s*([\d,]+(?:\.\d+)?)\s*(?:千?円?)?$/
      );
      if (match) {
        const label = cleanLabelText(match[1]);
        const sign = (match[2] === '△' || match[2] === '▲' || match[2] === '-') ? -1 : 1;
        const numStr = match[3].replace(/,/g, '');
        const value = parseFloat(numStr);
        if (!isNaN(value) && label && label.length >= 1) {
          pairs.push({ label, value: sign * value });
        }
      }
    }
  }

  return pairs;
}

/** 日本語の数値表記を解析（カンマ付き、△▲マイナス、空白混在） */
function parseJapaneseNumber(s: string): number | null {
  if (!s) return null;

  // 先頭の△▲マイナスを処理
  let sign = 1;
  let cleaned = s.trim();

  if (cleaned.startsWith('△') || cleaned.startsWith('▲')) {
    sign = -1;
    cleaned = cleaned.slice(1).trim();
  } else if (cleaned.startsWith('-') || cleaned.startsWith('−') || cleaned.startsWith('‐')) {
    sign = -1;
    cleaned = cleaned.slice(1).trim();
  }

  // 末尾の「千円」「円」を除去
  cleaned = cleaned.replace(/[千百万億]?円$/g, '').trim();

  // カンマと空白を除去
  cleaned = cleaned.replace(/[,\s]/g, '');

  if (!cleaned) return null;
  if (!/^\d+(\.\d+)?$/.test(cleaned)) return null;

  const value = parseFloat(cleaned);
  return isNaN(value) ? null : sign * value;
}

/** 科目名テキストをクリーニング */
function cleanLabelText(s: string): string {
  return s
    .replace(/^[・\-\s]+/, '')  // 先頭の記号除去
    .replace(/\s+$/, '')         // 末尾空白除去
    .replace(/\(.*?\)/g, '')     // 括弧内除去
    .replace(/（.*?）/g, '')     // 全角括弧内除去
    .trim();
}

// ─── 科目マッピング v2 ───

interface MappingRule {
  patterns: (string | RegExp)[];
  target: string;
  section: string; // BS/PL/原価/SGA/合計 — デバッグ用
  assign: (data: Partial<RawFinancialData>, value: number) => void;
}

const MAPPING_RULES: MappingRule[] = [
  // ── PL科目 ──
  { patterns: ['完成工事高'], target: 'PL/完成工事高', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.completedConstruction = v; } },
  { patterns: [/出来高工事高/, /出来高/], target: 'PL/出来高工事高', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.progressConstruction = v; } },
  { patterns: [/^売上高$/, '売上高合計', /^売上高計$/], target: 'PL/売上高', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.totalSales = v; } },
  { patterns: ['完成工事原価', /^売上原価$/], target: 'PL/完成工事原価', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.costOfSales = v; } },
  { patterns: ['売上総利益', /売上総損益/], target: 'PL/売上総利益', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.grossProfit = v; } },
  { patterns: [/^販売費及び一般管理費/, /販管費合計/, /^販売費/], target: 'PL/販管費', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.sgaTotal = v; } },
  { patterns: [/^営業利益$/], target: 'PL/営業利益', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.operatingProfit = v; } },
  { patterns: [/^受取利息$/], target: 'PL/受取利息', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.interestIncome = v; } },
  { patterns: [/^受取配当金$/], target: 'PL/受取配当金', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.dividendIncome = v; } },
  { patterns: [/支払利息/, /支払利息割引料/], target: 'PL/支払利息', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.interestExpense = v; } },
  { patterns: [/^経常利益$/], target: 'PL/経常利益', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.ordinaryProfit = v; } },
  { patterns: [/^特別利益$/], target: 'PL/特別利益', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.specialGain = v; } },
  { patterns: [/^特別損失$/], target: 'PL/特別損失', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.specialLoss = v; } },
  { patterns: [/^税引前当期/, /^税引前純利益/], target: 'PL/税引前利益', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.preTaxProfit = v; } },
  { patterns: [/^法人税、住民税/, /^法人税等(?!調整)/, /^法人税$/], target: 'PL/法人税等', section: 'PL',
    assign: (d, v) => { if (d.pl && !d.pl.corporateTax) d.pl.corporateTax = v; } },
  { patterns: [/^当期純利益/, /^当期利益$/], target: 'PL/当期純利益', section: 'PL',
    assign: (d, v) => { if (d.pl) d.pl.netIncome = v; } },

  // ── BS流動資産 ──
  { patterns: [/現金及び預金/, /現金預金/], target: '流動資産/現金預金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['現金及び預金'] = v; } },
  { patterns: [/^受取手形$/], target: '流動資産/受取手形', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['受取手形'] = v; } },
  { patterns: [/完成工事未収入金/], target: '流動資産/完成工事未収入金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['完成工事未収入金'] = v; } },
  { patterns: [/^有価証券$/], target: '流動資産/有価証券', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['有価証券'] = v; } },
  { patterns: [/^未成工事支出金$/], target: '流動資産/未成工事支出金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['未成工事支出金'] = v; } },
  { patterns: [/^材料貯蔵品$/], target: '流動資産/材料貯蔵品', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['材料貯蔵品'] = v; } },
  { patterns: [/^短期貸付金$/], target: '流動資産/短期貸付金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['短期貸付金'] = v; } },
  { patterns: [/^前払費用$/], target: '流動資産/前払費用', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['前払費用'] = v; } },
  { patterns: [/^繰延税金資産$/], target: '流動資産/繰延税金資産', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['繰延税金資産'] = v; } },
  { patterns: [/^貸倒引当金$/], target: '流動資産/貸倒引当金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentAssets['貸倒引当金'] = v; } },

  // ── BS有形固定資産 ──
  { patterns: [/^建物$/], target: '有形固定資産/建物', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.tangibleFixed['建物'] = v; } },
  { patterns: [/^構築物$/], target: '有形固定資産/構築物', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.tangibleFixed['構築物'] = v; } },
  { patterns: [/^建物付属設備$/], target: '有形固定資産/建物付属設備', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.tangibleFixed['建物付属設備'] = v; } },
  { patterns: [/^機械装置$/, /機械及び装置/], target: '有形固定資産/機械装置', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.tangibleFixed['機械装置'] = v; } },
  { patterns: [/^車両運搬具$/], target: '有形固定資産/車両運搬具', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.tangibleFixed['車両運搬具'] = v; } },
  { patterns: [/^工具器具備品$/, /^工具器具/], target: '有形固定資産/工具器具備品', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.tangibleFixed['工具器具備品'] = v; } },
  { patterns: [/^土地$/], target: '有形固定資産/土地', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.tangibleFixed['土地'] = v; } },

  // ── BS無形固定資産 ──
  { patterns: [/^電話加入権$/], target: '無形固定資産/電話加入権', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.intangibleFixed['電話加入権'] = v; } },
  { patterns: [/^ソフトウェア$/], target: '無形固定資産/ソフトウェア', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.intangibleFixed['ソフトウェア'] = v; } },

  // ── BS投資その他 ──
  { patterns: [/^投資有価証券$/], target: '投資/投資有価証券', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.investments['投資有価証券'] = v; } },
  { patterns: [/^関係会社株式$/], target: '投資/関係会社株式', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.investments['関係会社株式'] = v; } },
  { patterns: [/^長期貸付金$/], target: '投資/長期貸付金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.investments['長期貸付金'] = v; } },
  { patterns: [/^保険積立金$/], target: '投資/保険積立金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.investments['保険積立金'] = v; } },
  { patterns: [/^長期前払費用$/], target: '投資/長期前払費用', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.investments['長期前払費用'] = v; } },

  // ── BS流動負債 ──
  { patterns: [/^支払手形$/], target: '流動負債/支払手形', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['支払手形'] = v; } },
  { patterns: [/^工事未払金$/], target: '流動負債/工事未払金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['工事未払金'] = v; } },
  { patterns: [/^未払外注費$/], target: '流動負債/未払外注費', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['未払外注費'] = v; } },
  { patterns: [/^短期借入金$/], target: '流動負債/短期借入金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['短期借入金'] = v; } },
  { patterns: [/^未払金$/], target: '流動負債/未払金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['未払金'] = v; } },
  { patterns: [/^未払給与$/], target: '流動負債/未払給与', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['未払給与'] = v; } },
  { patterns: [/^未払経費$/], target: '流動負債/未払経費', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['未払経費'] = v; } },
  { patterns: [/^未払法人税等$/], target: '流動負債/未払法人税等', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['未払法人税等'] = v; } },
  { patterns: [/^未成工事受入金$/], target: '流動負債/未成工事受入金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['未成工事受入金'] = v; } },
  { patterns: [/^預り金$/], target: '流動負債/預り金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['預り金'] = v; } },
  { patterns: [/^未払消費税等$/], target: '流動負債/未払消費税等', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.currentLiabilities['未払消費税等'] = v; } },

  // ── BS固定負債 ──
  { patterns: [/^長期借入金$/], target: '固定負債/長期借入金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.fixedLiabilities['長期借入金'] = v; } },
  { patterns: [/^リース債務$/], target: '固定負債/リース債務', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.fixedLiabilities['リース債務'] = v; } },

  // ── BS純資産 ──
  { patterns: [/^資本金$/], target: '純資産/資本金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.equity['資本金'] = v; } },
  { patterns: [/^利益準備金$/], target: '純資産/利益準備金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.equity['利益準備金'] = v; } },
  { patterns: [/^別途積立金$/], target: '純資産/別途積立金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.equity['別途積立金'] = v; } },
  { patterns: [/繰越利益剰余金/], target: '純資産/繰越利益剰余金', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.equity['繰越利益剰余金'] = v; } },
  { patterns: [/^自己株式$/], target: '純資産/自己株式', section: 'BS',
    assign: (d, v) => { if (d.bs) d.bs.equity['自己株式'] = v; } },

  // ── BS合計行 ──
  { patterns: [/流動資産合計/, /流動資産　合計/], target: 'BS/流動資産合計', section: '合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.currentAssets = v; } },
  { patterns: [/有形固定資産合計/, /有形固定資産　合計/], target: 'BS/有形固定資産合計', section: '合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.tangibleFixed = v; } },
  { patterns: [/無形固定資産合計/], target: 'BS/無形固定資産合計', section: '合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.intangibleFixed = v; } },
  { patterns: [/投資その他.*合計/], target: 'BS/投資その他合計', section: '合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.investments = v; } },
  { patterns: [/^固定資産合計$/], target: 'BS/固定資産合計', section: '合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.fixedAssets = v; } },
  { patterns: [/^資産合計$/, /資産の部合計/], target: 'BS/資産合計', section: '合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.totalAssets = v; } },
  { patterns: [/流動負債合計/], target: 'BS/流動負債合計', section: '合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.currentLiabilities = v; } },
  { patterns: [/固定負債合計/], target: 'BS/固定負債合計', section: '合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.fixedLiabilities = v; } },
  { patterns: [/^負債合計$/, /負債の部合計/], target: 'BS/負債合計', section: '合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.totalLiabilities = v; } },
  { patterns: [/^純資産合計$/, /純資産の部合計/], target: 'BS/純資産合計', section: '合計',
    assign: (d, v) => { if (d.bs) d.bs.totals.totalEquity = v; } },

  // ── 完成工事原価報告書 ──
  { patterns: [/^材料費$/], target: '原価/材料費', section: '原価',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.materials = v; } },
  { patterns: [/^労務費$/], target: '原価/労務費', section: '原価',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.labor = v; } },
  { patterns: [/^外注費$/], target: '原価/外注費', section: '原価',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.subcontract = v; } },
  { patterns: [/^経費$/], target: '原価/経費', section: '原価',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.expenses = v; } },
  { patterns: [/^減価償却費$/], target: '原価/減価償却費', section: '原価',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.mfgDepreciation = v; } },
  { patterns: [/期首未成工事支出金/], target: '原価/期首WIP', section: '原価',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.wipBeginning = v; } },
  { patterns: [/期末未成工事支出金/], target: '原価/期末WIP', section: '原価',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.wipEnding = v; } },
  { patterns: [/完成工事原価$/], target: '原価/合計', section: '原価',
    assign: (d, v) => { if (d.manufacturing) d.manufacturing.totalCost = v; } },

  // ── 販管費の減価償却費 ──
  { patterns: [/販管費.*減価償却/, /^減価償却費$/], target: 'SGA/減価償却費', section: 'SGA',
    assign: (d, v) => { if (d.sga) d.sga.sgaDepreciation = v; } },
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

/**
 * OCRテキスト専用: ページ別に財務諸表を識別し、構造的に数値抽出
 *
 * 戦略:
 *  1. PAGE BREAKでページ分割
 *  2. 各ページの種類を判定（PL/BS/製造原価/販管費/株主資本等変動）
 *  3. PL: キーワード間の数値を構造的に抽出
 *  4. BS: 合計行をキーワード検索
 *  5. 製造原価/販管費: セクション内の数値を抽出
 */
function extractFromOcrText(
  text: string,
  data: Partial<RawFinancialData>,
  mappings: { source: string; target: string; value: number }[],
): void {
  // ── ページ分割 ──
  const pages = text.split('--- PAGE BREAK ---').map(p => p.trim()).filter(Boolean);

  // ── ページ種別判定 ──
  let plPage = '';
  let bsPage = '';
  let mfgPage = '';
  let sgaPage = '';

  for (const page of pages) {
    if (page.includes('損') && page.includes('益') && page.includes('売上')) {
      plPage = page;
    } else if (page.includes('資産の部') && page.includes('負債')) {
      bsPage = page;
    } else if (page.includes('製造原') || (page.includes('材料費') && page.includes('労務費'))) {
      mfgPage = page;
    } else if (page.includes('販売費および一般管理費') && !page.includes('売上高')) {
      sgaPage = page;
    }
  }

  /** ページ内から全数値を抽出 */
  function extractNumbers(pageText: string): number[] {
    const nums: number[] = [];
    const regex = /(?:△|▲)?[\d][\d, ]*(?:\.\d+)?/g;
    let match: RegExpExecArray | null;
    while ((match = regex.exec(pageText)) !== null) {
      const parsed = parseJapaneseNumber(match[0]);
      if (parsed !== null) nums.push(parsed);
    }
    return nums;
  }

  /** キーワード後の最初の数値を取得（ページ内検索） */
  function findAfter(pageText: string, keyword: string | RegExp, minVal = 0): number | null {
    let idx: number;
    if (typeof keyword === 'string') {
      idx = pageText.indexOf(keyword);
    } else {
      const m = keyword.exec(pageText);
      idx = m ? m.index : -1;
    }
    if (idx === -1) return null;

    // キーワード以降のテキストから最初の数値を取得
    const after = pageText.slice(idx);
    const numMatch = /(?:△|▲)?[\d][\d, ]*/.exec(after);
    if (!numMatch) return null;
    const val = parseJapaneseNumber(numMatch[0]);
    if (val !== null && Math.abs(val) >= minVal) return val;
    return null;
  }

  /** 登録ヘルパー */
  function record(section: string, value: number): void {
    mappings.push({ source: `OCR:${section}`, target: section, value });
  }

  // ══════ PL ══════
  if (plPage) {
    // PLページの数値を全て抽出（出現順）
    const nums = extractNumbers(plPage);

    // PL構造: 数値は右端列（合計列）に出現する
    // 典型的な出現順:
    //   完成工事高, 出来高, 売上高計,
    //   当期製造原価(=売上原価), 売上原価合計, 売上総利益,
    //   販管費合計, 営業利益,
    //   受取利息, 受取配当金, 雑収入, 営業外収益合計,
    //   支払利息, 雑支出, 営業外費用合計,
    //   経常利益, 特別利益, 特別利益合計,
    //   税前利益, 法人税等, 当期純利益

    // ── 売上高計: PLページ内の最大値 ──
    const plNums = extractNumbers(plPage);
    if (plNums.length > 0) {
      const maxVal = Math.max(...plNums);
      if (maxVal > 100000) {
        data.pl!.totalSales = maxVal;
        record('PL/売上高計', maxVal);
      }
    }

    // ── 売上原価: 「原価」「合計」キーワード後の数値 ──
    // OCRパターン: 「売上 原 価 合 計\n売上総利益\n1,397,874,304\n1,397,874,304\n270,254,025」
    const costIdx = plPage.search(/原.*価.*合.*計|売上原価/);
    if (costIdx >= 0) {
      const afterCost = plPage.slice(costIdx);
      const costNums = extractNumbers(afterCost);
      // 最初の大きな数値 = 売上原価
      const bigCostNums = costNums.filter(n => n > 100000);
      if (bigCostNums.length > 0) {
        data.pl!.costOfSales = bigCostNums[0];
        record('PL/売上原価', bigCostNums[0]);
      }
    }

    // ── 売上総利益 = 売上高 - 売上原価（計算が最も確実） ──
    if (data.pl!.totalSales > 0 && data.pl!.costOfSales > 0) {
      data.pl!.grossProfit = data.pl!.totalSales - data.pl!.costOfSales;
      record('PL/売上総利益(計算)', data.pl!.grossProfit);
    }

    // 販管費合計 + 営業利益
    // OCRパターン: 「管理費合計\n営業利益(損失)\n215,364,095\n54,889,930」
    const sgaTotalIdx = plPage.indexOf('管理費合計') ?? plPage.indexOf('管理費');
    if (sgaTotalIdx >= 0) {
      const afterSga = plPage.slice(sgaTotalIdx);
      const sgaNums = extractNumbers(afterSga);
      // 最初の2つの数値: [販管費合計, 営業利益]
      if (sgaNums.length >= 2) {
        data.pl!.sgaTotal = sgaNums[0];
        record('PL/販管費合計', sgaNums[0]);
        data.pl!.operatingProfit = sgaNums[1];
        record('PL/営業利益', sgaNums[1]);
      } else if (sgaNums.length >= 1) {
        data.pl!.sgaTotal = sgaNums[0];
        record('PL/販管費合計', sgaNums[0]);
      }
    }

    // 営業外収益: 受取利息, 受取配当金
    const ri = findAfter(plPage, /受.*取.*利/);
    if (ri !== null) { data.pl!.interestIncome = ri; record('PL/受取利息', ri); }

    const rd = findAfter(plPage, /受.*取.*配/);
    if (rd !== null) { data.pl!.dividendIncome = rd; record('PL/受取配当金', rd); }

    // 支払利息
    const ie = findAfter(plPage, /支.*払.*利/);
    if (ie !== null) { data.pl!.interestExpense = ie; record('PL/支払利息', ie); }

    // PLページ末尾の数値列を使って、経常利益〜当期純利益を取得
    // OCRのPLページ末尾は常にこの順番:
    //   ..., 営業外収益合計, [支払利息項目群], 営業外費用合計,
    //   経常利益, [特別利益], [特別利益合計], 税前利益, 法人税等, 当期純利益
    //
    // 実際のOCR: 36,950,613 / 6,042,453 / 13,620 / 6,056,073 / 85,784,470 / 155,691 / 155,691 / 85,940,161 / 29,850,402 / 56,089,759

    // PLページの全数値
    const plAllNums = extractNumbers(plPage);

    if (plAllNums.length >= 3) {
      const last3 = plAllNums.slice(-3);
      // 最後の3つ: [税前利益, 法人税等, 当期純利益]
      // 検証: 税前利益 = 法人税等 + 当期純利益
      if (Math.abs(last3[0] - (last3[1] + last3[2])) < 100) {
        data.pl!.preTaxProfit = last3[0];
        record('PL/税前利益', last3[0]);
        data.pl!.corporateTax = last3[1];
        record('PL/法人税等', last3[1]);
        data.pl!.netIncome = last3[2];
        record('PL/当期純利益', last3[2]);
      } else {
        data.pl!.netIncome = plAllNums[plAllNums.length - 1];
        record('PL/当期純利益', plAllNums[plAllNums.length - 1]);
      }
    }

    // 経常利益: PLの末尾10個の数値から推定
    // 構造: ...経常利益, [特別利益, 特別利益合計], 税前利益, 法人税等, 当期純利益
    if (plAllNums.length >= 6 && data.pl!.preTaxProfit > 0) {
      const tail10 = plAllNums.slice(-10);

      // 税前利益の位置を探す
      const preTaxIdx = tail10.lastIndexOf(data.pl!.preTaxProfit);
      if (preTaxIdx >= 0) {
        // 税前利益の2つ前 or 3つ前に経常利益がある
        // 特別利益がある場合: 経常利益, 特別利益, 特別利益合計, 税前利益
        // 特別利益がない場合: 経常利益 = 税前利益

        // 特別利益の有無を確認
        if (preTaxIdx >= 3) {
          // 特別利益 = preTaxIdx-2 の値（2つが同じ値なら特別利益合計）
          const sp1 = tail10[preTaxIdx - 2];
          const sp2 = tail10[preTaxIdx - 1];
          if (sp1 === sp2 && sp1 < data.pl!.preTaxProfit) {
            // 特別利益 = sp1
            data.pl!.specialGain = sp1;
            record('PL/特別利益', sp1);
            // 経常利益 = preTaxIdx - 3
            if (preTaxIdx >= 3) {
              data.pl!.ordinaryProfit = tail10[preTaxIdx - 3];
              record('PL/経常利益', tail10[preTaxIdx - 3]);
            }
          }
        }

        // 経常利益がまだ0なら、計算で求める
        if (data.pl!.ordinaryProfit === 0) {
          const op = data.pl!.preTaxProfit - data.pl!.specialGain + data.pl!.specialLoss;
          if (op > 0) {
            data.pl!.ordinaryProfit = op;
            record('PL/経常利益(計算)', op);
          }
        }
      }
    }
  }

  // ══════ BS ══════
  if (bsPage) {
    // BS合計行の取得戦略:
    // OCRでは2列構造（左: 資産の部 / 右: 負債+純資産の部）のため、
    // 「純資産の部合計」のOCR値は信頼できない（資産合計と混同される）
    // → 資産合計 と 負債合計 から 純資産合計 を計算する

    // 負債合計: 比較的信頼性が高い
    const tl = findAfter(bsPage, '負債の部合計', 10000);
    if (tl !== null) { data.bs!.totals.totalLiabilities = tl; record('BS/負債合計', tl); }

    // 資産合計: BSページ内の最大値 = 資産合計（= 負債・純資産の部合計）
    const bsNums = extractNumbers(bsPage);
    if (bsNums.length > 0) {
      const maxBs = Math.max(...bsNums);
      if (maxBs > 100000) {
        data.bs!.totals.totalAssets = maxBs;
        record('BS/資産合計', maxBs);
      }
    }

    // 純資産合計 = 資産合計 - 負債合計（計算が最も確実）
    if (data.bs!.totals.totalAssets > 0 && data.bs!.totals.totalLiabilities > 0) {
      data.bs!.totals.totalEquity = data.bs!.totals.totalAssets - data.bs!.totals.totalLiabilities;
      record('BS/純資産合計(計算)', data.bs!.totals.totalEquity);
    }

    // 個別科目
    const cw = findAfter(bsPage, '完成工事未収入金');
    if (cw !== null) { data.bs!.currentAssets['完成工事未収入金'] = cw; record('BS/完成工事未収入金', cw); }

    const lb = findAfter(bsPage, /長期.*借入/);
    if (lb !== null) { data.bs!.fixedLiabilities['長期借入金'] = lb; record('BS/長期借入金', lb); }

    const cap = findAfter(bsPage, '資本金】');
    if (cap !== null) { data.bs!.equity['資本金'] = cap; record('BS/資本金', cap); }

    const lr = findAfter(bsPage, '利益準備金】');
    if (lr !== null) { data.bs!.equity['利益準備金'] = lr; record('BS/利益準備金', lr); }

    const bt = findAfter(bsPage, '別途積立');
    if (bt !== null) { data.bs!.equity['別途積立金'] = bt; record('BS/別途積立金', bt); }

    const re = findAfter(bsPage, '繰越利益剰余');
    if (re !== null) { data.bs!.equity['繰越利益剰余金'] = re; record('BS/繰越利益剰余金', re); }

    const ts = findAfter(bsPage, '自己株式】');
    if (ts !== null) { data.bs!.equity['自己株式'] = ts; record('BS/自己株式', ts); }
  }

  // ══════ 製造原価 ══════
  if (mfgPage) {
    // 製造原価報告書の構造:
    //   【材料費】→ 金額(材料費小計)
    //   【労務費】→ 金額(労務費小計)
    //   【製造経費】→ ...
    //   【外注加工費】→ 金額(外注費)
    //   工費合計 → 金額
    //   期首未成工事支出金 → 金額
    //   期末未成工事支出金 → 金額
    //   当期製品製造原価合計 → 金額

    // 材料費: 【材料費】の直後の数値
    const mat = findAfter(mfgPage, '材料費】');
    if (mat !== null) { data.manufacturing!.materials = mat; record('原価/材料費', mat); }

    // 労務費: 【労務費】の直後の数値
    const lab = findAfter(mfgPage, '労務費');
    if (lab !== null) { data.manufacturing!.labor = lab; record('原価/労務費', lab); }

    // 外注加工費: 数値が大きいものを取得
    // OCRでは「外注加工費\n外注\n965,982,707」のパターン
    // findAfterの結果と、ページ内の大きな数値を比較
    const mfgNums = extractNumbers(mfgPage);
    // 外注費は通常ページ内で最大の数値のひとつ
    const subIdx = mfgPage.indexOf('外注');
    if (subIdx >= 0) {
      const afterSub = mfgPage.slice(subIdx);
      const subNums = extractNumbers(afterSub);
      // 外注費は通常10万以上
      const bigNums = subNums.filter(n => n > 100000);
      if (bigNums.length > 0) {
        data.manufacturing!.subcontract = bigNums[0];
        record('原価/外注費', bigNums[0]);
      }
    }

    // 期首・期末WIP & 当期製品製造原価合計
    const wb = findAfter(mfgPage, '期首未成工事支出金');
    if (wb !== null) { data.manufacturing!.wipBeginning = wb; record('原価/期首WIP', wb); }

    const we = findAfter(mfgPage, '期末未成工事支出金');
    if (we !== null) { data.manufacturing!.wipEnding = we; record('原価/期末WIP', we); }

    const tc = findAfter(mfgPage, /当期製品製造原価合計/);
    if (tc !== null && tc > 100000) {
      data.manufacturing!.totalCost = tc;
      record('原価/合計', tc);
    } else {
      // ページの最後の大きな数値 = 当期製品製造原価合計
      const lastBig = mfgNums.filter(n => n > 100000);
      if (lastBig.length > 0) {
        const last = lastBig[lastBig.length - 1];
        data.manufacturing!.totalCost = last;
        record('原価/合計(末尾)', last);
      }
    }
  }

  // ══════ 販管費 ══════
  if (sgaPage) {
    // 減価償却費
    const dep = findAfter(sgaPage, '減価償却');
    if (dep !== null) { data.sga!.sgaDepreciation = dep; record('SGA/減価償却費', dep); }

    // 販管費合計（販管費ページの末尾の数値）
    if (data.pl && data.pl.sgaTotal === 0) {
      const sgaNums = extractNumbers(sgaPage);
      if (sgaNums.length > 0) {
        const lastNum = sgaNums[sgaNums.length - 1];
        if (lastNum > 10000) {
          data.pl.sgaTotal = lastNum;
          record('PL/販管費合計(SGA)', lastNum);
        }
      }
    }
  }
}

/** 「未払法人税等」→ PL/法人税等にマッチさせない */
function shouldSkip(label: string, target: string): boolean {
  if (target === 'PL/法人税等' && label.includes('未払')) return true;
  if (target === 'PL/営業利益' && label.includes('営業外')) return true;
  // 「経費」が「販管費」行に誤マッチしないようにする
  if (target === '原価/経費' && label.includes('販売費')) return true;
  return false;
}

// ─── メインパーサー ───

function initEmptyData(): Partial<RawFinancialData> {
  return {
    bs: {
      currentAssets: {}, tangibleFixed: {}, intangibleFixed: {},
      investments: {}, currentLiabilities: {}, fixedLiabilities: {},
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
 * 1. まずテキスト抽出（座標ベース行再構成）
 * 2. テキストが少なければスキャンPDFと判断しOCR実行
 * 3. 抽出テキストから科目・金額ペアを認識
 */
export async function parsePDF(buffer: Buffer): Promise<ParseResult> {
  const warnings: string[] = [];
  const mappings: { source: string; target: string; value: number }[] = [];
  const data = initEmptyData();
  let ocrUsed = false;

  // ─── Step 0: Gemini Vision API で一次抽出を試行 ───
  if (isGeminiAvailable()) {
    try {
      logger.info(`Gemini extraction starting for PDF (${(buffer.length / 1024 / 1024).toFixed(1)}MB)`);
      const geminiResult = await extractFinancialDataWithGemini(buffer);
      if (geminiResult) {
        logger.info('Gemini extraction succeeded, merging data...');
        // Gemini の結果を data にマージ
        mergeGeminiFinancialData(geminiResult.data, data, mappings);
        const geminiCount = mappings.filter(m => m.source.startsWith('Gemini:')).length;
        if (geminiCount > 0) {
          warnings.push(
            `Gemini AIで${geminiCount}項目を読み取りました。数値を確認してください。`
          );
          return { data, warnings, mappings, ocrUsed: true, rawText: '[Gemini Vision API で抽出]' };
        } else {
          logger.warn('Gemini returned data but 0 mappings were created');
        }
      } else {
        logger.warn('Gemini returned null — empty response or parse failure');
        warnings.push('Gemini AI抽出で結果が得られませんでした。従来の方法で解析します。');
      }
    } catch (e) {
      logger.error('Gemini extraction failed, falling back to legacy methods:', e);
      warnings.push('Gemini AI抽出に失敗しました。従来の方法で解析します。');
    }
  } else {
    logger.warn('Gemini not available (no credentials/project env vars)');
  }

  // ─── Step 1: テキスト抽出を試行（pdfjs-dist） ───
  let text = '';
  try {
    text = await extractTextFromPDF(buffer);
  } catch {
    warnings.push('テキスト抽出に失敗しました。OCRを試行します。');
  }

  const meaningfulChars = text.replace(/[\s\r\n\-]/g, '').replace(/PAGE BREAK/g, '').length;
  const isScanned = meaningfulChars < 100;

  // ─── Step 2: Document AI Form Parser（フォールバック1） ───
  const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.K_SERVICE;

  let docAIUsed = false;

  if (hasCredentials) {
    try {
      const docResult = await ocrWithDocumentAI(buffer);
      if (docResult) {
        docAIUsed = true;

        // Document AIのフォームフィールドから直接マッピング
        mapDocAIFieldsToData(docResult.formFields, data, mappings);

        // Document AIのページテキスト（パラグラフ結合）をメインテキストとして使用
        const docAIText = docResult.pageTexts.join('\n--- PAGE BREAK ---\n');
        const docAIChars = docAIText.replace(/[\s\r\n\-]/g, '').replace(/PAGE BREAK/g, '').length;
        if (docAIChars > meaningfulChars) {
          text = docAIText;
          ocrUsed = true;
        }
      }
    } catch (e) {
      logger.error('Document AI failed, falling back:', e);
    }
  }

  // ─── Step 3: スキャンPDFでDocument AIも使えない場合 → Vision API フォールバック ───
  if (isScanned && !docAIUsed) {
    if (!hasCredentials) {
      warnings.push('OCR機能を使用するにはGoogle Cloud認証設定が必要です。');
      return { data, warnings, mappings, ocrUsed: false, rawText: text };
    }

    try {
      text = await ocrWithVision(buffer);
      ocrUsed = true;
      if (!text) {
        warnings.push('OCRでテキストを検出できませんでした。');
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      warnings.push(`OCR処理に失敗しました: ${msg}`);
      return { data, warnings, mappings, ocrUsed: false, rawText: text };
    }
  }

  if (!text) {
    warnings.push('PDFからテキストを抽出できませんでした。');
    return { data, warnings, mappings, ocrUsed, rawText: '' };
  }

  // ─── Step 4: テキストから追加マッピング（フォールバック2） ───
  mapTextToData(text, data, mappings);

  // OCRテキストの場合、コンテキストベース抽出も実行
  if (ocrUsed || mappings.length < 5) {
    extractFromOcrText(text, data, mappings);
  }

  if (mappings.length === 0) {
    warnings.push(
      'PDFから決算書データを認識できませんでした。Excelでのアップロードを推奨します。'
    );
  } else if (docAIUsed) {
    const docAICount = mappings.filter(m => m.source.startsWith('DocAI:')).length;
    if (docAICount > 0) {
      warnings.push(
        `Document AIで${docAICount}項目、テキスト解析で${mappings.length - docAICount}項目を読み取りました。`
      );
    }
  } else if (ocrUsed) {
    warnings.push(
      `OCRで${mappings.length}項目を読み取りました。数値を必ずご確認ください。`
    );
  }

  // ─── Step 5: 単位自動補正（全抽出パス共通） ───
  // Gemini / Document AI / テキスト解析 いずれのパスでも
  // 円単位で返されていれば千円に補正する
  autoCorrectUnit(data);

  return { data, warnings, mappings, ocrUsed: ocrUsed || docAIUsed, rawText: text.slice(0, 5000) };
}

// ─── Gemini データマージ ───

/**
 * Gemini から取得した RawFinancialData を既存の data 構造にマージする
 */
function mergeGeminiFinancialData(
  gemini: Partial<RawFinancialData>,
  data: Partial<RawFinancialData>,
  mappings: { source: string; target: string; value: number }[],
): void {
  // BS
  if (gemini.bs) {
    if (gemini.bs.currentAssets && Object.keys(gemini.bs.currentAssets).length > 0) {
      if (!data.bs) data.bs = { currentAssets: {}, tangibleFixed: {}, intangibleFixed: {}, investments: {}, currentLiabilities: {}, fixedLiabilities: {}, equity: {}, totals: { currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0, investments: 0, fixedAssets: 0, totalAssets: 0, currentLiabilities: 0, fixedLiabilities: 0, totalLiabilities: 0, totalEquity: 0 } };
      for (const [key, val] of Object.entries(gemini.bs.currentAssets)) {
        data.bs.currentAssets[key] = val;
        mappings.push({ source: `Gemini:BS流動資産:${key}`, target: `bs.currentAssets.${key}`, value: val });
      }
    }
    if (gemini.bs.tangibleFixed) {
      if (!data.bs) data.bs = { currentAssets: {}, tangibleFixed: {}, intangibleFixed: {}, investments: {}, currentLiabilities: {}, fixedLiabilities: {}, equity: {}, totals: { currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0, investments: 0, fixedAssets: 0, totalAssets: 0, currentLiabilities: 0, fixedLiabilities: 0, totalLiabilities: 0, totalEquity: 0 } };
      for (const [key, val] of Object.entries(gemini.bs.tangibleFixed)) {
        data.bs.tangibleFixed[key] = val;
        mappings.push({ source: `Gemini:BS有形固定:${key}`, target: `bs.tangibleFixed.${key}`, value: val });
      }
    }
    if (gemini.bs.intangibleFixed) {
      if (!data.bs) data.bs = { currentAssets: {}, tangibleFixed: {}, intangibleFixed: {}, investments: {}, currentLiabilities: {}, fixedLiabilities: {}, equity: {}, totals: { currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0, investments: 0, fixedAssets: 0, totalAssets: 0, currentLiabilities: 0, fixedLiabilities: 0, totalLiabilities: 0, totalEquity: 0 } };
      for (const [key, val] of Object.entries(gemini.bs.intangibleFixed)) {
        data.bs.intangibleFixed[key] = val;
        mappings.push({ source: `Gemini:BS無形固定:${key}`, target: `bs.intangibleFixed.${key}`, value: val });
      }
    }
    if (gemini.bs.investments) {
      if (!data.bs) data.bs = { currentAssets: {}, tangibleFixed: {}, intangibleFixed: {}, investments: {}, currentLiabilities: {}, fixedLiabilities: {}, equity: {}, totals: { currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0, investments: 0, fixedAssets: 0, totalAssets: 0, currentLiabilities: 0, fixedLiabilities: 0, totalLiabilities: 0, totalEquity: 0 } };
      for (const [key, val] of Object.entries(gemini.bs.investments)) {
        data.bs.investments[key] = val;
        mappings.push({ source: `Gemini:BS投資:${key}`, target: `bs.investments.${key}`, value: val });
      }
    }
    if (gemini.bs.currentLiabilities) {
      if (!data.bs) data.bs = { currentAssets: {}, tangibleFixed: {}, intangibleFixed: {}, investments: {}, currentLiabilities: {}, fixedLiabilities: {}, equity: {}, totals: { currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0, investments: 0, fixedAssets: 0, totalAssets: 0, currentLiabilities: 0, fixedLiabilities: 0, totalLiabilities: 0, totalEquity: 0 } };
      for (const [key, val] of Object.entries(gemini.bs.currentLiabilities)) {
        data.bs.currentLiabilities[key] = val;
        mappings.push({ source: `Gemini:BS流動負債:${key}`, target: `bs.currentLiabilities.${key}`, value: val });
      }
    }
    if (gemini.bs.fixedLiabilities) {
      if (!data.bs) data.bs = { currentAssets: {}, tangibleFixed: {}, intangibleFixed: {}, investments: {}, currentLiabilities: {}, fixedLiabilities: {}, equity: {}, totals: { currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0, investments: 0, fixedAssets: 0, totalAssets: 0, currentLiabilities: 0, fixedLiabilities: 0, totalLiabilities: 0, totalEquity: 0 } };
      for (const [key, val] of Object.entries(gemini.bs.fixedLiabilities)) {
        data.bs.fixedLiabilities[key] = val;
        mappings.push({ source: `Gemini:BS固定負債:${key}`, target: `bs.fixedLiabilities.${key}`, value: val });
      }
    }
    if (gemini.bs.equity) {
      if (!data.bs) data.bs = { currentAssets: {}, tangibleFixed: {}, intangibleFixed: {}, investments: {}, currentLiabilities: {}, fixedLiabilities: {}, equity: {}, totals: { currentAssets: 0, tangibleFixed: 0, intangibleFixed: 0, investments: 0, fixedAssets: 0, totalAssets: 0, currentLiabilities: 0, fixedLiabilities: 0, totalLiabilities: 0, totalEquity: 0 } };
      for (const [key, val] of Object.entries(gemini.bs.equity)) {
        data.bs.equity[key] = val;
        mappings.push({ source: `Gemini:BS純資産:${key}`, target: `bs.equity.${key}`, value: val });
      }
    }
    if (gemini.bs.totals && data.bs) {
      Object.assign(data.bs.totals, gemini.bs.totals);
      for (const [key, val] of Object.entries(gemini.bs.totals)) {
        if (val !== 0) {
          mappings.push({ source: `Gemini:BS合計:${key}`, target: `bs.totals.${key}`, value: val });
        }
      }
    }
  }

  // PL
  if (gemini.pl) {
    if (!data.pl) data.pl = { completedConstruction: 0, progressConstruction: 0, totalSales: 0, costOfSales: 0, grossProfit: 0, sgaItems: {}, sgaTotal: 0, operatingProfit: 0, interestIncome: 0, dividendIncome: 0, miscIncome: 0, interestExpense: 0, miscExpense: 0, ordinaryProfit: 0, specialGain: 0, specialLoss: 0, preTaxProfit: 0, corporateTax: 0, netIncome: 0 };
    const plKeys: (keyof RawFinancialData['pl'])[] = [
      'completedConstruction', 'progressConstruction', 'totalSales', 'costOfSales',
      'grossProfit', 'sgaTotal', 'operatingProfit', 'interestIncome', 'dividendIncome',
      'miscIncome', 'interestExpense', 'miscExpense', 'ordinaryProfit', 'specialGain',
      'specialLoss', 'preTaxProfit', 'corporateTax', 'netIncome',
    ];
    for (const key of plKeys) {
      const val = gemini.pl[key];
      if (typeof val === 'number' && val !== 0) {
        (data.pl as Record<string, unknown>)[key] = val;
        mappings.push({ source: `Gemini:PL:${key}`, target: `pl.${key}`, value: val });
      }
    }
    if (gemini.pl.sgaItems && Object.keys(gemini.pl.sgaItems).length > 0) {
      for (const [key, val] of Object.entries(gemini.pl.sgaItems)) {
        data.pl.sgaItems[key] = val;
        mappings.push({ source: `Gemini:PL販管費:${key}`, target: `pl.sgaItems.${key}`, value: val });
      }
    }
  }

  // Manufacturing
  if (gemini.manufacturing) {
    if (!data.manufacturing) data.manufacturing = { materials: 0, labor: 0, expenses: 0, subcontract: 0, mfgDepreciation: 0, wipBeginning: 0, wipEnding: 0, totalCost: 0 };
    const mfgKeys: (keyof RawFinancialData['manufacturing'])[] = [
      'materials', 'labor', 'expenses', 'subcontract', 'mfgDepreciation',
      'wipBeginning', 'wipEnding', 'totalCost',
    ];
    for (const key of mfgKeys) {
      const val = gemini.manufacturing[key];
      if (typeof val === 'number' && val !== 0) {
        data.manufacturing[key] = val;
        mappings.push({ source: `Gemini:製造:${key}`, target: `manufacturing.${key}`, value: val });
      }
    }
  }

  // SGA depreciation
  if (gemini.sga?.sgaDepreciation) {
    if (!data.sga) data.sga = { sgaDepreciation: 0 };
    data.sga.sgaDepreciation = gemini.sga.sgaDepreciation;
    mappings.push({ source: 'Gemini:販管費減価償却', target: 'sga.sgaDepreciation', value: gemini.sga.sgaDepreciation });
  }
}
