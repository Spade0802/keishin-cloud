/**
 * 経営審査提出書PDFパーサー v2
 *
 * 一次抽出: Gemini Vision API（PDF直接入力）
 * フォールバック: Document AI / Vision API / pdfjs-dist テキスト解析
 *
 * 提出書PDF（編集用表形式 or スキャン）から以下を抽出:
 * - 基本情報（会社名、許可番号、審査基準日）
 * - 続紙（自己資本額、利益額、技術職員数）
 * - 別紙一（業種別完成工事高・元請完成工事高）
 * - 別紙三（社会性等 W項目）
 * - 別紙二（技術職員名簿）※ベストエフォート
 */

import type { SocialItems } from './engine/types';
import { extractKeishinDataWithGemini, isGeminiAvailable } from './gemini-extractor';

// ─── 結果型 ───

export interface KeishinPdfResult {
  basicInfo: {
    companyName: string;
    permitNumber: string;
    reviewBaseDate: string;
    periodNumber: string;
  };
  /** 自己資本額（千円） */
  equity: number;
  /** 利払後事業利益額 2期平均（千円） */
  ebitda: number;
  /** 技術職員数 */
  techStaffCount: number;
  /** 業種別完成工事高 */
  industries: Array<{
    name: string;
    code: string;
    prevCompletion: number;
    currCompletion: number;
    prevPrimeContract: number;
    currPrimeContract: number;
    /** 技術職員数値（Z1計算用、業種別の点数） */
    techStaffValue?: number;
  }>;
  /** W項目（社会性等）*/
  wItems: Partial<SocialItems>;
  /** 営業年数 */
  businessYears: number;
  /** 警告 */
  warnings: string[];
  /** マッピング詳細 */
  mappings: { source: string; target: string; value: string | number }[];
  /** デバッグ用rawText */
  rawText?: string;
}

// ─── Document AI 構造化データ型 ───

interface DocumentAIFormField {
  name: string;
  value: string;
  confidence: number;
  pageIndex: number;
}

interface DocumentAIPageData {
  pageIndex: number;
  text: string;
  formFields: DocumentAIFormField[];
}

interface DocumentAIResult {
  fullText: string;
  pages: DocumentAIPageData[];
  formFields: DocumentAIFormField[];
}

// ─── テキスト抽出 ───

async function extractTextFromPDF(buffer: Buffer): Promise<string> {
  const pdfjsLib = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const uint8Array = new Uint8Array(buffer);
  const doc = await pdfjsLib.getDocument({ data: uint8Array }).promise;
  const allLines: string[] = [];

  for (let i = 1; i <= doc.numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();

    const items: { str: string; x: number; y: number; width: number }[] = [];
    for (const item of content.items) {
      if (!('str' in item) || !('transform' in item)) continue;
      const raw = item as { str: string; transform: number[]; width: number };
      if (!raw.str.trim()) continue;
      items.push({ str: raw.str, x: raw.transform[4], y: raw.transform[5], width: raw.width });
    }

    const yTolerance = 3;
    const groups = new Map<number, typeof items>();
    for (const item of items) {
      let foundKey: number | null = null;
      for (const key of groups.keys()) {
        if (Math.abs(item.y - key) <= yTolerance) { foundKey = key; break; }
      }
      if (foundKey !== null) groups.get(foundKey)!.push(item);
      else groups.set(item.y, [item]);
    }

    const sortedKeys = [...groups.keys()].sort((a, b) => b - a);
    for (const key of sortedKeys) {
      const lineItems = groups.get(key)!.sort((a, b) => a.x - b.x);
      let line = '';
      for (let j = 0; j < lineItems.length; j++) {
        if (j > 0) {
          const gap = lineItems[j].x - (lineItems[j - 1].x + lineItems[j - 1].width);
          if (gap > 10) line += '\t';
          else if (gap > 2) line += ' ';
        }
        line += lineItems[j].str;
      }
      if (line.trim()) allLines.push(line.trim());
    }
    allLines.push('--- PAGE BREAK ---');
  }
  return allLines.join('\n');
}

async function ocrWithVision(buffer: Buffer): Promise<string> {
  const { ImageAnnotatorClient } = await import('@google-cloud/vision');
  const client = new ImageAnnotatorClient();
  const content = buffer.toString('base64');
  const features = [{ type: 'DOCUMENT_TEXT_DETECTION' as const }];
  const imageContext = { languageHints: ['ja', 'en'] };
  const inputConfig = { mimeType: 'application/pdf', content };
  const MAX_PAGES = 5;
  const allText: string[] = [];

  for (let startPage = 1; startPage <= 30; startPage += MAX_PAGES) {
    const pages = Array.from({ length: MAX_PAGES }, (_, i) => startPage + i);
    try {
      const [result] = await client.batchAnnotateFiles({
        requests: [{ inputConfig, features, imageContext, pages }],
      });
      const responses = result?.responses?.[0]?.responses || [];
      if (responses.length === 0 && startPage > 1) break;
      for (const pageResp of responses) {
        const text = pageResp?.fullTextAnnotation?.text;
        if (text) { allText.push(text); allText.push('--- PAGE BREAK ---'); }
      }
      if (responses.length < MAX_PAGES) break;
    } catch (e) {
      if (startPage === 1) throw e;
      break;
    }
  }
  return allText.join('\n');
}

// ─── Document AI Form Parser ───

async function ocrWithDocumentAI(buffer: Buffer): Promise<DocumentAIResult | null> {
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

    // テキストアンカーからテキストを抽出するヘルパー
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

    const allFormFields: DocumentAIFormField[] = [];
    const pages: DocumentAIPageData[] = [];

    for (let i = 0; i < (document.pages || []).length; i++) {
      const page = document.pages![i];

      // ページテキスト: パラグラフを結合
      const pageTexts: string[] = [];
      for (const para of page.paragraphs || []) {
        const t = extractText(para.layout?.textAnchor);
        if (t) pageTexts.push(t);
      }
      const pageText = pageTexts.join('\n');

      // フォームフィールド抽出
      const pageFields: DocumentAIFormField[] = [];
      for (const field of page.formFields || []) {
        const fieldName = extractText(field.fieldName?.textAnchor).replace(/[:\s：]+$/, '').trim();
        const fieldValue = extractText(field.fieldValue?.textAnchor).trim();
        const confidence = field.fieldValue?.confidence ?? 0;

        if (fieldName && fieldValue) {
          const f: DocumentAIFormField = {
            name: fieldName,
            value: fieldValue,
            confidence: Number(confidence),
            pageIndex: i,
          };
          pageFields.push(f);
          allFormFields.push(f);
        }
      }

      pages.push({
        pageIndex: i,
        text: pageText,
        formFields: pageFields,
      });
    }

    return { fullText, pages, formFields: allFormFields };
  } catch (e) {
    console.error('Document AI error:', e);
    return null;
  }
}

// ─── ユーティリティ ───

function parseNum(s: string): number {
  const cleaned = s
    .replace(/[０-９]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0xFEE0))
    .replace(/[,\s　]/g, '')
    .replace(/千円$/, '')
    .replace(/人$/, '')
    .replace(/年$/, '')
    .replace(/台$/, '')
    .trim();
  const val = parseInt(cleaned, 10);
  return isNaN(val) ? 0 : val;
}

/** キーワード後の数値を抽出（改行をまたいで検索） */
function findNumberAfter(text: string, keyword: string | RegExp, maxChars = 300): number {
  let idx: number;
  if (typeof keyword === 'string') {
    idx = text.indexOf(keyword);
  } else {
    const m = keyword.exec(text);
    idx = m ? m.index : -1;
  }
  if (idx === -1) return 0;
  const after = text.slice(idx, idx + maxChars);
  // 改行を含めて最初の数値を探す
  const m = /[\d０-９][\d０-９,.\s]*/.exec(after);
  if (!m) return 0;
  return parseNum(m[0]);
}

/** キーワード後の「数値+単位」パターンを抽出（改行をまたぐ対応） */
function findValueWithUnit(text: string, keyword: string, unit: string, maxChars = 400): number {
  const idx = text.indexOf(keyword);
  if (idx === -1) return 0;
  const after = text.slice(idx, idx + maxChars);
  // 「44,332千円」「20人」のように数値+単位を探す（改行をまたいでもOK）
  const pattern = new RegExp(`([\\d０-９][\\d０-９,]*?)\\s*${unit}`);
  const m = pattern.exec(after);
  if (m) return parseNum(m[1]);
  // 単位なしでも最初の数値を返す
  return findNumberAfter(text, keyword, maxChars);
}

// ─── 業種名正規化 ───

const INDUSTRY_NAME_MAP: Record<string, string> = {
  '土木一式工事': '土木', '土木一式': '土木', '土木工事': '土木',
  '建築一式工事': '建築', '建築一式': '建築', '建築工事': '建築',
  '大工工事': '大工', '左官工事': '左官',
  'とび・土工工事': 'とび', 'とび・土工・コンクリート工事': 'とび',
  '石工事': '石', '屋根工事': '屋根', '電気工事': '電気',
  '管工事': '管', 'タイル・れんが・ブロック工事': 'タイル',
  '鋼構造物工事': '鋼構造物', '鉄筋工事': '鉄筋',
  'ほ装工事': 'ほ装', '舗装工事': 'ほ装',
  'しゅんせつ工事': 'しゅんせつ', '板金工事': '板金',
  'ガラス工事': 'ガラス', '塗装工事': '塗装', '防水工事': '防水',
  '内装仕上工事': '内装', '機械器具設置工事': '機械器具',
  '熱絶縁工事': '熱絶縁', '電気通信工事': '電気通信',
  '造園工事': '造園', 'さく井工事': 'さく井', '建具工事': '建具',
  '水道施設工事': '水道', '消防施設工事': '消防施設',
  '清掃施設工事': '清掃', '解体工事': '解体',
};

function normalizeIndustryName(name: string): string {
  const trimmed = name.trim().replace(/\s+/g, '');
  if (INDUSTRY_NAME_MAP[trimmed]) return INDUSTRY_NAME_MAP[trimmed];
  // 「工事」を除去してみる
  const noKouji = trimmed.replace(/工事$/, '');
  for (const [k, v] of Object.entries(INDUSTRY_NAME_MAP)) {
    if (k.includes(noKouji) || noKouji.includes(v)) return v;
  }
  return trimmed;
}

// ─── ページ別パーサー ───

function parseBasicInfo(text: string, result: KeishinPdfResult): void {
  // Document AIで既に取得済みの場合はスキップ
  if (result.basicInfo.companyName && result.basicInfo.reviewBaseDate) return;

  // 会社名: 「商号又は名称」の後方から会社名（法人格+社名）を探す
  // OCRでは「商号又は名称\n審査基準日\nアヅサ電気工業株式会社」のように改行で分離される
  const companyPatterns = [
    // 「○○株式会社」「株式会社○○」「○○(株)」「(株)○○」のフルネーム（4文字以上）
    /([^\n]{2,}(?:株式会社|有限会社|合同会社|合資会社))/,
    /((?:株式会社|有限会社|合同会社|合資会社)[^\n]{2,})/,
    /([^\n]{2,}\(株\))/,
    /(\(株\)[^\n]{2,})/,
    /([^\n]{2,}（株）)/,
    /(（株）[^\n]{2,})/,
  ];
  // 「商号又は名称」の近く（後ろ500文字）で最初にマッチする会社名
  const nameSection = text.slice(0, Math.min(text.length, 3000));
  for (const p of companyPatterns) {
    const m = p.exec(nameSection);
    if (m) {
      let name = (m[1] || m[0]).trim();
      // 法令文言を除外
      if (name.includes('建設業法') || name.includes('規定により')) continue;
      // 短すぎるもの（「株式会社」だけ等）は除外
      const coreName = name.replace(/株式会社|有限会社|合同会社|合資会社|\(株\)|（株）/g, '').trim();
      if (coreName.length < 2) continue;
      result.basicInfo.companyName = name;
      result.mappings.push({ source: '基本情報', target: '会社名', value: name });
      break;
    }
  }

  // 許可番号
  const permitM = text.match(/((?:千葉県|東京都|[^\s]{2,4}[都道府県]|国土交通大臣)(?:知事)?(?:\s*[\(（].*?[\)）])?\s*許可[^\n]*(?:第\s*\d+\s*号)?)/);
  if (permitM) {
    result.basicInfo.permitNumber = permitM[1].trim();
    result.mappings.push({ source: '基本情報', target: '許可番号', value: permitM[1].trim() });
  }

  // 審査基準日 — 「令和X年X月X日」パターンを優先（OCRで「審査基準日」と日付が別行になる場合対応）
  const datePatterns = [
    /審査基準日[\s\S]{0,100}?(令和\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日)/,
    /審査基準日[\s\S]{0,100}?(平成\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日)/,
    /審査基準日[\s\S]{0,100}?(R\d+[.\s]*\d+[.\s]*\d+)/,
    // 「審査基準日」が近くにあり「令和」で始まる日付行
    /(令和\d+年\d+月\d+日)/,
  ];
  for (const p of datePatterns) {
    const dateM = text.match(p);
    if (dateM) {
      result.basicInfo.reviewBaseDate = dateM[1].trim();
      result.mappings.push({ source: '基本情報', target: '審査基準日', value: dateM[1].trim() });
      break;
    }
  }
}

function parseX2Summary(text: string, result: KeishinPdfResult): void {
  // Document AIで3項目とも取得済みならスキップ
  if (result.equity > 0 && result.ebitda > 0 && result.techStaffCount > 0) return;

  // X2ページ（続紙）のOCRテキスト構造:
  //   「自己資本額\n...317 282,007 (TH)\n(千円)」
  //   → OCRが表セルを連結し「317 282,007」のように読む場合がある
  //   「利益額 (利払前税引前償却前利益)\n1 486 (千円)」
  //   「技術職員数\n₤19 17 W\n(人)」

  // 自己資本額: 「(千円)」の直前の数値を探す戦略
  // まず「自己資本額」セクションを切り出し
  const equityIdx = text.indexOf('自己資本額');
  if (equityIdx >= 0 && result.equity === 0) {
    // 「自己資本額」から「利益額」or「利払前」の間のテキストを対象に
    const ebitdaIdx = text.indexOf('利益額', equityIdx);
    const section = text.slice(equityIdx, ebitdaIdx > equityIdx ? ebitdaIdx : equityIdx + 400);
    // OCR例: "317 282,007 (TH)" → "317,282" + ノイズ
    // "(千円)" or "(TH)" の前にある数値を探す
    const senEnM = section.match(/([\d\s,]+)\s*(?:\(千円\)|千円|\(TH\)|\(T\))/);
    if (senEnM) {
      // OCRスペースを除去して結合: "317 282,007" → "317282007"
      // ただし異常に大きい場合は最初の有効な数値部分だけ使う
      const rawDigits = senEnM[1].replace(/\s+/g, '').replace(/,/g, '');
      let val = parseInt(rawDigits, 10);
      // 妥当性チェック: 自己資本額は通常 -10億〜100億千円
      if (val > 10000000) {
        // 大きすぎる→OCRノイズ
        // "317 282,007" → スペースで分割 ["317", "282,007"]
        // "317" + "282" (カンマの前だけ) = "317282"
        const spaceParts = senEnM[1].trim().split(/\s+/);
        if (spaceParts.length >= 2) {
          // 各パートから先頭の数字部分のみ抽出して結合
          // カンマは残す（"282,007"→"282"でカンマ前だけ取る）
          const digits = spaceParts.map(p => {
            const d = p.match(/^\d+/);
            return d ? d[0] : '';
          }).filter(Boolean);
          const combined = parseInt(digits.join(''), 10);
          if (combined > 0 && combined < 10000000) {
            val = combined;
          } else if (digits.length > 0) {
            val = parseInt(digits[0], 10); // フォールバック: 最初のパートだけ
          }
        } else {
          val = 0; // 単一パートで異常に大きい場合はスキップ
        }
      }
      if (val > 0 && val < 10000000) {
        result.equity = val;
        result.mappings.push({ source: '続紙', target: '自己資本額', value: result.equity });
      }
    }
    if (result.equity === 0) {
      const v = findValueWithUnit(text, '自己資本額', '千円');
      if (v > 0 && v < 10000000) {
        result.equity = v;
        result.mappings.push({ source: '続紙', target: '自己資本額', value: result.equity });
      }
    }
  }

  // 利益額（2期平均）
  const profitIdx = text.indexOf('利益額');
  if (profitIdx >= 0 && result.ebitda === 0) {
    const techIdx = text.indexOf('技術職員数', profitIdx);
    const section = text.slice(profitIdx, techIdx > profitIdx ? techIdx : profitIdx + 800);

    // 全「(千円)」「(TH)」の前にある数値を収集
    const allSenEn = [...section.matchAll(/([\d\s,]+)\s*(?:\(千円\)|千円|\(TH\))/g)];

    // 「利払前税引前償却前利益」の直後の「(千円)」値を最優先
    const ribaraiIdx = section.indexOf('利払前');
    if (ribaraiIdx >= 0) {
      const afterRibarai = section.slice(ribaraiIdx);
      const m = afterRibarai.match(/([\d\s,]+)\s*(?:\(千円\)|千円|\(TH\))/);
      if (m) {
        const val = parseNum(m[1].replace(/\s+/g, ''));
        if (val > 0 && val < 10000000) {
          result.ebitda = val;
          result.mappings.push({ source: '続紙', target: '利益額(2期平均)', value: result.ebitda });
        }
      }
    }

    // フォールバック: 「2期平均」近くの千円値
    if (result.ebitda === 0) {
      for (const m of allSenEn) {
        const val = parseNum(m[1].replace(/\s+/g, ''));
        if (val > 0 && val < 10000000) {
          result.ebitda = val;
          result.mappings.push({ source: '続紙', target: '利益額(2期平均)', value: result.ebitda });
          break;
        }
      }
    }
  }

  // 技術職員数
  const techIdx2 = text.indexOf('技術職員数');
  if (techIdx2 >= 0 && result.techStaffCount === 0) {
    const section = text.slice(techIdx2, techIdx2 + 200);
    // 「(人)」or「人」の前の数値
    const personM = section.match(/([\d\s,]+)\s*(?:\(人\)|人(?!\s*[名員]))/);
    if (personM) {
      const val = parseNum(personM[1].replace(/\s+/g, ''));
      if (val > 0 && val < 10000) {
        result.techStaffCount = val;
        result.mappings.push({ source: '続紙', target: '技術職員数', value: result.techStaffCount });
      }
    }
    if (result.techStaffCount === 0) {
      // フォールバック: 最初の2-3桁数値
      const numM = section.match(/(\d{1,4})\s*(?:\(人\)|人|W)/);
      if (numM) {
        const val = parseInt(numM[1], 10);
        if (val > 0 && val < 10000) {
          result.techStaffCount = val;
          result.mappings.push({ source: '続紙', target: '技術職員数', value: result.techStaffCount });
        }
      }
    }
  }
}

function parseIndustries(text: string, result: KeishinPdfResult): void {
  const lines = text.split('\n');

  // ── 経審業種コード（3桁）→ 正規化業種名 ──
  const CODE_MAP: Record<string, string> = {
    '010': '土木', '020': '建築', '030': '大工', '040': '左官',
    '050': 'とび', '060': '石', '070': '屋根', '080': '電気',
    '090': '管', '100': 'タイル', '110': '鋼構造物', '120': '鉄筋',
    '130': 'ほ装', '140': 'しゅんせつ', '150': '板金', '160': 'ガラス',
    '170': '塗装', '180': '防水', '190': '内装', '200': '機械器具',
    '210': '熱絶縁', '220': '電気通信', '230': '造園', '240': 'さく井',
    '250': '建具', '260': '水道', '270': '消防施設', '280': '清掃', '290': '解体',
  };

  // 業種名（長い順）
  const INDUSTRY_NAMES = [
    '電気通信工事', '消防施設工事', '水道施設工事', '清掃施設工事',
    '機械器具設置工事', 'タイル・れんが・ブロック工事',
    'とび・土工・コンクリート工事', 'とび・土工工事',
    '土木一式工事', '建築一式工事', '鋼構造物工事',
    '内装仕上工事', '熱絶縁工事',
    '電気工事', '管工事', '大工工事', '左官工事',
    '屋根工事', '石工事', '鉄筋工事', 'ほ装工事', '舗装工事',
    'しゅんせつ工事', '板金工事', 'ガラス工事', '塗装工事', '防水工事',
    '造園工事', 'さく井工事', '建具工事', '解体工事',
  ];

  const industryData: KeishinPdfResult['industries'] = [];

  // ── 補助: 行から数値配列を抽出 ──
  function extractNums(s: string): number[] {
    return [...s.matchAll(/[\d,]+/g)]
      .map(m => parseNum(m[0]))
      .filter(v => v > 0);
  }

  // ── 補助: コード3桁を末尾から判定 ──
  function matchCode(numStr: string): string | null {
    const raw = numStr.replace(/,/g, '');
    if (raw.length === 3 && CODE_MAP[raw]) return raw;
    if (raw.length >= 4 && raw.length <= 6) {
      const suffix = raw.slice(-3);
      if (CODE_MAP[suffix]) return suffix;
    }
    return null;
  }

  // ═══════════════════════════════════════════
  // 戦略A: 全文からコード+4数値のパターンを正規表現で検索
  //   例: "32080 813494 337419 1111068 660534"
  //   → code suffix=080(電気), values=[813494, 337419, 1111068, 660534]
  //   行分割に依存しない（OCRで\nがリテラルの場合にも対応）
  // ═══════════════════════════════════════════
  // 5つ以上の連続する数値トークン（スペース/タブ区切り・改行は跨がない）
  const codeDataPattern = /(\d[\d,]*)[ \t]+(\d[\d,]*)[ \t]+(\d[\d,]*)[ \t]+(\d[\d,]*)[ \t]+(\d[\d,]*)/g;
  let cdm: RegExpExecArray | null;
  while ((cdm = codeDataPattern.exec(text)) !== null) {
    const tokens = [cdm[1], cdm[2], cdm[3], cdm[4], cdm[5]];
    // 最初の1-2トークンがコードか判定
    for (let ci = 0; ci <= 1; ci++) {
      const code3 = matchCode(tokens[ci]);
      if (!code3) continue;
      if (industryData.some(d => d.code === code3)) continue;

      const vals = tokens.slice(ci + 1).map(n => parseNum(n));
      if (vals.length >= 4) {
        industryData.push({
          name: CODE_MAP[code3], code: code3,
          prevCompletion: vals[0], prevPrimeContract: vals[1],
          currCompletion: vals[2], currPrimeContract: vals[3],
        });
      }
      break;
    }
  }

  // ═══════════════════════════════════════════
  // 戦略B: 構造化テキスト — 行に業種名+4数値
  // ═══════════════════════════════════════════
  for (const line of lines) {
    for (const indName of INDUSTRY_NAMES) {
      if (!line.includes(indName)) continue;
      const name = normalizeIndustryName(indName);
      if (industryData.some(d => d.name === name)) continue;

      const afterName = line.slice(line.indexOf(indName) + indName.length);
      const nums = extractNums(afterName);
      if (nums.length >= 4) {
        industryData.push({
          name, code: '',
          prevCompletion: nums[0], prevPrimeContract: nums[1],
          currCompletion: nums[2], currPrimeContract: nums[3],
        });
      }
    }
  }

  // ═══════════════════════════════════════════
  // 戦略C: OCR形式 — テキストをセクション分割して解析
  //   別紙一のOCRでは「工事の種類」で各業種セクションが区切られ、
  //   業種コード+数値 と 業種名 が別の行にある
  //   また合計行から検算可能
  // ═══════════════════════════════════════════

  // C-1: テキスト内の全業種名を出現順に収集
  const foundNames: string[] = [];
  const foundSet = new Set<string>();
  for (const indName of INDUSTRY_NAMES) {
    if (!text.includes(indName)) continue;
    const name = normalizeIndustryName(indName);
    if (foundSet.has(name) || name === '合計') continue;
    foundSet.add(name);
    foundNames.push(name);
  }

  // C-2: 戦略Aで見つかってない業種について、セクション単位で数値を探す
  for (const name of foundNames) {
    if (industryData.some(d => d.name === name)) continue;

    // 業種名の前後の広い範囲から数値を収集
    // OCRでは数値が名前の前に来ることが多い（フォーム構造のため）
    const indName = INDUSTRY_NAMES.find(n => normalizeIndustryName(n) === name) || name;
    const nameIdx = text.indexOf(indName);
    if (nameIdx === -1) continue;

    // 名前の前800文字を検索範囲に（同セクション内の数値）
    // ただし前のセクションの「工事の種類」以降のみ
    const beforeText = text.slice(Math.max(0, nameIdx - 800), nameIdx);
    const sectionStart = beforeText.lastIndexOf('工事の種類');
    const searchBefore = sectionStart >= 0
      ? beforeText.slice(sectionStart)
      : beforeText.slice(-400);

    // 名前の後200文字も検索
    const searchAfter = text.slice(nameIdx, nameIdx + 200);
    const searchText = searchBefore + '\n' + searchAfter;

    // 大きめの数値（完工高は千円単位で少なくとも3桁以上）を収集
    const allNums: number[] = [];
    for (const m of searchText.matchAll(/\b[\d,]{3,}\b/g)) {
      const v = parseNum(m[0]);
      // 業種コード風（3xxxx台 or 2xxxx台で5桁）は除外
      const raw = m[0].replace(/,/g, '');
      if (raw.length === 5 && v >= 20000 && v < 40000) continue;
      // 年度（200x, 201x, 202x, 03, 04, 05, 06）は除外
      if (v >= 2000 && v <= 2030) continue;
      // 項番（31-34程度の2桁）は除外
      if (raw.length <= 2) continue;
      if (v > 0) allNums.push(v);
    }

    if (allNums.length >= 4) {
      industryData.push({
        name, code: '',
        prevCompletion: allNums[0], prevPrimeContract: allNums[1],
        currCompletion: allNums[2], currPrimeContract: allNums[3],
      });
    } else if (allNums.length >= 2) {
      industryData.push({
        name, code: '',
        prevCompletion: allNums[0], prevPrimeContract: 0,
        currCompletion: allNums[1], currPrimeContract: 0,
      });
    } else {
      // 数値が取れなくてもユーザーが手入力できるよう業種だけ追加
      industryData.push({
        name, code: '',
        prevCompletion: 0, prevPrimeContract: 0,
        currCompletion: 0, currPrimeContract: 0,
      });
    }
  }

  // ═══════════════════════════════════════════
  // 戦略D: 合計行から検算・補正
  // ═══════════════════════════════════════════
  const totalLine = lines.find(l => l.includes('合計'));
  if (totalLine) {
    const totalNums = extractNums(totalLine.slice(totalLine.indexOf('合計') + 2));
    if (totalNums.length >= 4) {
      result.mappings.push({
        source: '別紙一',
        target: '合計(検算用)',
        value: `前期=${totalNums[0]} 当期=${totalNums[2]} 前期元請=${totalNums[1]} 当期元請=${totalNums[3]}`,
      });
    }
  }

  // 「合計」「その他」は最終結果から除外
  result.industries = industryData.filter(d =>
    d.name !== '合計' && d.name !== 'その他'
  );

  for (const ind of result.industries) {
    result.mappings.push({
      source: '別紙一',
      target: `業種/${ind.name}`,
      value: `前期=${ind.prevCompletion} 当期=${ind.currCompletion} 前期元請=${ind.prevPrimeContract} 当期元請=${ind.currPrimeContract}`,
    });
  }
}

function parseWItems(text: string, result: KeishinPdfResult): void {
  const w: Partial<SocialItems> = {};

  // 有/無/1/2 の判定ヘルパー
  // OCRでは「雇用保険加入の有無\n[1. 有 2. 無、 3.適用除外 ]」のような形式
  // → 説明テキストの「1. 有 2. 無」は除外し、実際の記入値を探す
  function isYes(keyword: string): boolean | undefined {
    const idx = text.indexOf(keyword);
    if (idx === -1) return undefined;
    const after = text.slice(idx, idx + 300);

    // パターン1: 「[1. 有 2. 無、 3.適用除外]」のような選択肢リストがある場合、
    // その後に実際の回答値（1, 2, 有, 無）がある
    // ただしOCRではフォーム上の○印が検出しにくい

    // パターン2: 直接「加入の有無」の行で判定するのは難しいので
    // 選択肢テキスト「1. 有 2. 無」自体は除外
    const lines = after.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      // 選択肢の説明テキストは無視: 「[1. 有 2. 無」や「1. 有、 2. 無」
      if (/[12]\.\s*有.*[12]\.\s*無/.test(trimmed)) continue;
      if (/\[.*有.*無.*\]/.test(trimmed)) continue;
      if (trimmed.includes('有無')) continue;

      // 実際の回答: 行に「有」だけ or 「1」だけ（項目の回答として）
      if (/^\s*有\s*$/.test(trimmed) || /^\s*1\s*$/.test(trimmed)) return true;
      if (/^\s*無\s*$/.test(trimmed) || /^\s*2\s*$/.test(trimmed)) return false;
    }

    // フォールバック: キーワード直後の最初の「有」or「無」（説明文を除く）
    // 安全策として undefined を返す（判定不能）
    return undefined;
  }

  // W1: 労働福祉
  const emp = isYes('雇用保険');
  if (emp !== undefined) { w.employmentInsurance = emp; result.mappings.push({ source: '別紙三', target: 'W/雇用保険', value: emp ? '有' : '無' }); }

  const health = isYes('健康保険');
  if (health !== undefined) { w.healthInsurance = health; result.mappings.push({ source: '別紙三', target: 'W/健康保険', value: health ? '有' : '無' }); }

  const pension = isYes('厚生年金');
  if (pension !== undefined) { w.pensionInsurance = pension; result.mappings.push({ source: '別紙三', target: 'W/厚生年金', value: pension ? '有' : '無' }); }

  const kentai = isYes('建設業退職金共済');
  if (kentai !== undefined) { w.constructionRetirementMutualAid = kentai; result.mappings.push({ source: '別紙三', target: 'W/建退共', value: kentai ? '有' : '無' }); }

  const retire = isYes('退職一時金');
  if (retire !== undefined) { w.retirementSystem = retire; result.mappings.push({ source: '別紙三', target: 'W/退職一時金', value: retire ? '有' : '無' }); }

  const accident = isYes('法定外労働災害');
  if (accident !== undefined) { w.nonStatutoryAccidentInsurance = accident; result.mappings.push({ source: '別紙三', target: 'W/法定外労災', value: accident ? '有' : '無' }); }

  // W2: 担い手育成
  const youngCont = isYes('若年技術職員の継続');
  if (youngCont !== undefined) { w.youngTechContinuous = youngCont; }

  const youngNew = isYes('新規若年技術職員');
  if (youngNew !== undefined) { w.youngTechNew = youngNew; }

  // 技術職員数(W用)
  const techCountM = text.match(/技術者数\s*=?\s*(\d+)\s*人/);
  if (techCountM) w.techStaffCount = parseInt(techCountM[1]);

  // CPD単位
  const cpdM = text.match(/CPD\s*単位取得数[^\d]*([\d,]+)/);
  if (cpdM) w.cpdTotalUnits = parseNum(cpdM[1]);

  // 技能レベル向上者
  const skillM = text.match(/技能レベル向上者数[^\d]*([\d,]+)/);
  if (skillM) w.skillLevelUpCount = parseNum(skillM[1]);

  // W3: WLB認定
  const eruM = text.match(/女性活躍推進法[^\d]*([\d])/);
  if (eruM) { w.wlbEruboши = parseInt(eruM[1]); result.mappings.push({ source: '別紙三', target: 'W/女性活躍', value: eruM[1] }); }

  const kuruM = text.match(/次世代育成支援[^\d]*([\d])/);
  if (kuruM) { w.wlbKurumin = parseInt(kuruM[1]); result.mappings.push({ source: '別紙三', target: 'W/くるみん', value: kuruM[1] }); }

  const youthM = text.match(/青少年の雇用[^\d]*([\d])/);
  if (youthM) { w.wlbYouth = parseInt(youthM[1]); result.mappings.push({ source: '別紙三', target: 'W/ユースエール', value: youthM[1] }); }

  // CCUS
  const ccusM = text.match(/就業履[歴歷][^\d]*([\d])/);
  if (ccusM) { w.ccusImplementation = parseInt(ccusM[1]); }

  // W4: 営業継続
  const yearsM = text.match(/営業年数[^\d]*(\d+)\s*年/);
  if (yearsM) {
    const years = parseInt(yearsM[1]);
    w.businessYears = years;
    result.businessYears = years;
    result.mappings.push({ source: '別紙三', target: 'W/営業年数', value: years });
  }

  const disaster = isYes('防災活動');
  if (disaster !== undefined) w.disasterAgreement = disaster;

  const rehab = isYes('民事再生');
  if (rehab !== undefined) w.civilRehabilitation = rehab;

  // W5: 監査 — auditStatus
  // 値: 0=なし, 1=監査, 2=レビュー, 3=会計参与, 4=自主監査
  // 通常テキストから直接読むのは難しいのでスキップ（ユーザーに確認させる）

  // W6: 研究開発
  const rdM = text.match(/研究開発費[^\d]*([\d,]+)\s*千円/);
  if (rdM) { w.rdExpense2YearAvg = parseNum(rdM[1]); result.mappings.push({ source: '別紙三', target: 'W/研究開発費', value: parseNum(rdM[1]) }); }

  // W7: 建設機械
  const machineM = text.match(/建設機械[^\d]*(\d+)\s*台/);
  if (machineM) { w.constructionMachineCount = parseInt(machineM[1]); result.mappings.push({ source: '別紙三', target: 'W/建設機械', value: parseInt(machineM[1]) }); }

  // W8: ISO / エコアクション
  const iso9 = isYes('ISO9001');
  if (iso9 !== undefined) w.iso9001 = iso9;

  const iso14 = isYes('ISO14001');
  if (iso14 !== undefined) w.iso14001 = iso14;

  const eco = isYes('エコアクション');
  if (eco !== undefined) w.ecoAction21 = eco;

  result.wItems = w;
}

// ─── Document AI フォームフィールド直接抽出 ───

function parseFormFields(fields: DocumentAIFormField[], result: KeishinPdfResult): void {
  for (const f of fields) {
    const name = f.name.replace(/\s+/g, '');
    const value = f.value.trim();

    // 会社名
    if (name.includes('商号') || name.includes('名称')) {
      if (value.length >= 4 && !value.includes('建設業法')) {
        result.basicInfo.companyName = value;
        result.mappings.push({ source: 'Document AI', target: '会社名', value });
      }
    }

    // 審査基準日
    if (name.includes('審査基準日')) {
      const dateM = value.match(/(令和\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日|平成\s*\d+\s*年\s*\d+\s*月\s*\d+\s*日)/);
      if (dateM) {
        result.basicInfo.reviewBaseDate = dateM[1];
        result.mappings.push({ source: 'Document AI', target: '審査基準日', value: dateM[1] });
      }
    }

    // 許可番号
    if (name.includes('許可') && value.includes('号')) {
      result.basicInfo.permitNumber = value;
      result.mappings.push({ source: 'Document AI', target: '許可番号', value });
    }

    // 自己資本額
    if (name.includes('自己資本額')) {
      const v = parseNum(value);
      if (v > 0 && v < 10000000) {
        result.equity = v;
        result.mappings.push({ source: 'Document AI', target: '自己資本額', value: v });
      }
    }

    // 利益額
    if (name.includes('利益額') || name.includes('利払前')) {
      const v = parseNum(value);
      if (v > 0 && v < 10000000) {
        result.ebitda = v;
        result.mappings.push({ source: 'Document AI', target: '利益額', value: v });
      }
    }

    // 技術職員数 / 技術者数
    if (name.includes('技術職員数') || name.includes('技術者数')) {
      const v = parseNum(value);
      if (v > 0 && v < 10000) {
        result.techStaffCount = v;
        result.mappings.push({ source: 'Document AI', target: '技術職員数', value: v });
      }
    }

    // 営業年数
    if (name.includes('営業年数')) {
      const v = parseNum(value);
      if (v > 0 && v < 200) {
        result.businessYears = v;
        result.wItems.businessYears = v;
        result.mappings.push({ source: 'Document AI', target: '営業年数', value: v });
      }
    }
  }
}

// ─── メインパーサー ───

export async function parseKeishinPDF(buffer: Buffer): Promise<KeishinPdfResult> {
  const result: KeishinPdfResult = {
    basicInfo: { companyName: '', permitNumber: '', reviewBaseDate: '', periodNumber: '' },
    equity: 0,
    ebitda: 0,
    techStaffCount: 0,
    industries: [],
    wItems: {},
    businessYears: 0,
    warnings: [],
    mappings: [],
  };

  // ─── Step 0: Gemini Vision API で一次抽出を試行 ───
  if (isGeminiAvailable()) {
    try {
      const geminiResult = await extractKeishinDataWithGemini(buffer);
      if (geminiResult) {
        const gd = geminiResult.data;
        // 基本情報
        if (gd.basicInfo) {
          if (gd.basicInfo.companyName) result.basicInfo.companyName = gd.basicInfo.companyName;
          if (gd.basicInfo.permitNumber) result.basicInfo.permitNumber = gd.basicInfo.permitNumber;
          if (gd.basicInfo.reviewBaseDate) result.basicInfo.reviewBaseDate = gd.basicInfo.reviewBaseDate;
          if (gd.basicInfo.periodNumber) result.basicInfo.periodNumber = gd.basicInfo.periodNumber;
        }
        // 数値
        if (gd.equity) result.equity = gd.equity;
        if (gd.ebitda) result.ebitda = gd.ebitda;
        if (gd.techStaffCount) result.techStaffCount = gd.techStaffCount;
        if (gd.businessYears) result.businessYears = gd.businessYears;
        // 業種
        if (gd.industries && gd.industries.length > 0) {
          result.industries = gd.industries;
        }
        // W項目
        if (gd.wItems) {
          result.wItems = gd.wItems;
        }

        // マッピング記録
        const addMapping = (src: string, tgt: string, val: string | number) => {
          result.mappings.push({ source: `Gemini:${src}`, target: tgt, value: val });
        };
        if (result.basicInfo.companyName) addMapping('会社名', 'basicInfo.companyName', result.basicInfo.companyName);
        if (result.basicInfo.permitNumber) addMapping('許可番号', 'basicInfo.permitNumber', result.basicInfo.permitNumber);
        if (result.equity) addMapping('自己資本額', 'equity', result.equity);
        if (result.ebitda) addMapping('利益額', 'ebitda', result.ebitda);
        if (result.techStaffCount) addMapping('技術職員数', 'techStaffCount', result.techStaffCount);
        if (result.businessYears) addMapping('営業年数', 'businessYears', result.businessYears);
        for (const ind of result.industries) {
          addMapping(`業種:${ind.name}`, `industries`, ind.currCompletion);
        }

        result.warnings.push(
          `Gemini AIで読み取りました（${result.mappings.length}項目）。数値を確認してください。`
        );
        result.rawText = '[Gemini Vision API で抽出]';
        return result;
      }
    } catch (e) {
      console.error('Gemini keishin extraction failed, falling back:', e);
      result.warnings.push('Gemini AI抽出に失敗しました。従来の方法で解析します。');
    }
  }

  // ─── Step 1: テキスト抽出（pdfjs-dist） ───
  let text = '';
  let docAIResult: DocumentAIResult | null = null;

  try {
    text = await extractTextFromPDF(buffer);
  } catch {
    result.warnings.push('テキスト抽出に失敗しました。OCRを試行します。');
  }

  const meaningfulChars = text.replace(/[\s\r\n\-]/g, '').replace(/PAGE BREAK/g, '').length;
  const isScanned = meaningfulChars < 100;

  // ─── Step 2: Document AI Form Parser（フォールバック1） ───
  const hasCredentials = process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.K_SERVICE;

  if (hasCredentials) {
    try {
      docAIResult = await ocrWithDocumentAI(buffer);
      if (docAIResult) {
        const docAIPages = docAIResult.pages.map(p => p.text).join('\n--- PAGE BREAK ---\n');
        if (docAIPages.replace(/[\s\r\n\-]/g, '').replace(/PAGE BREAK/g, '').length > meaningfulChars) {
          text = docAIPages;
        }
        parseFormFields(docAIResult.formFields, result);
      }
    } catch (e) {
      console.error('Document AI failed, falling back:', e);
    }
  }

  // ─── Step 3: Vision API フォールバック ───
  if (isScanned && !docAIResult) {
    if (!hasCredentials) {
      result.warnings.push('OCR機能を使用するにはGoogle Cloud認証設定が必要です。');
      return result;
    }

    try {
      text = await ocrWithVision(buffer);
      if (!text) {
        result.warnings.push('OCRでテキストを検出できませんでした。');
        return result;
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.warnings.push(`OCR処理に失敗しました: ${msg}`);
      return result;
    }
  }

  // テキスト正規化: リテラル "\n"（backslash + n）を実際の改行に統一
  text = text.replace(/\\n/g, '\n');

  result.rawText = text.slice(0, 8000);

  // ページ分割
  const pages = text.split('--- PAGE BREAK ---').map(p => p.trim()).filter(Boolean);

  // ページ種別判定 & パース
  let hasBasicInfo = false;
  let hasX2 = false;
  let hasIndustries = false;
  let hasWItems = false;

  // ページ種別情報（デバッグ用）

  for (let pi = 0; pi < pages.length; pi++) {
    const page = pages[pi];
    const pageInfo: string[] = [];

    // 基本情報ページ
    if (!hasBasicInfo && (page.includes('経営規模等評価') || page.includes('総合評定値') || page.includes('商号又は名称'))) {
      parseBasicInfo(page, result);
      hasBasicInfo = true;
      pageInfo.push('基本情報');
    }

    // X2データページ（続紙）
    if (!hasX2 && page.includes('自己資本額') && page.includes('利益額')) {
      parseX2Summary(page, result);
      hasX2 = true;
      pageInfo.push('X2');
    }

    // 別紙一（業種別完成工事高）
    // 「別紙一による」は参照文なので除外。ページ先頭100文字に「別紙一」がある or 「工事の種類」がある
    const isBesshi1Page = (page.slice(0, 150).includes('別紙一') && !page.slice(0, 150).includes('別紙一による'))
      || (page.includes('工事の種類') && page.includes('完成工事高'));
    if (!hasIndustries && isBesshi1Page) {
      parseIndustries(page, result);
      hasIndustries = true;
      pageInfo.push(`別紙一(ind=${result.industries.length})`);
    }

    // 別紙三（社会性等 W項目） — 複数ページにまたがることがあるので全ページ試す
    // 「別紙三による」は参照文なので除外
    const isBesshi3Page = (page.includes('別紙三') && !page.includes('別紙三による'))
      || (page.includes('雇用保険') && page.includes('加入の有無'))
      || (page.includes('営業年数') && page.includes('営業継続'));
    if (isBesshi3Page) {
      parseWItems(page, result);
      hasWItems = true;
      pageInfo.push('W項目');
    }

    // pageInfo used for internal tracking only
  }

  // 全テキストからもフォールバック検索
  if (!hasBasicInfo) parseBasicInfo(text, result);
  if (!hasX2) parseX2Summary(text, result);
  if (!hasIndustries) parseIndustries(text, result);
  if (!hasWItems) parseWItems(text, result);

  // 業種の数値精度チェック: コードで検出した業種はOK、名前のみの業種は不確実
  const nameOnly = result.industries.filter(d => !d.code).map(d => d.name);
  if (nameOnly.length > 0) {
    result.warnings.push(`以下の業種は完工高の数値が不正確な可能性があります。確認してください: ${nameOnly.join('、')}`);
  }

  // サマリー
  if (result.industries.length === 0) {
    result.warnings.push('業種別完成工事高を読み取れませんでした。手入力してください。');
  }
  if (result.equity === 0 && result.ebitda === 0) {
    result.warnings.push('自己資本額・利益額を読み取れませんでした。');
  }

  return result;
}
