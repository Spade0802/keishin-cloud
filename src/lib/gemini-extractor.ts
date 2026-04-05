/**
 * Gemini Vision API による PDF データ抽出
 *
 * Vertex AI の Gemini 2.5 Flash を使い、PDF を直接入力して
 * 構造化された JSON を取得する。
 *
 * 決算書 (RawFinancialData) と 提出用資料 (KeishinPdfResult) の
 * 2 種類の抽出関数を提供する。
 *
 * 既存の Document AI / Vision API ベースのパーサーのフォールバックとして
 * ではなく、一次抽出手段として使用する。
 */

import type { RawFinancialData, SocialItems } from './engine/types';
import type { KeishinPdfResult } from './keishin-pdf-parser';
import { getGeminiModel, isRateLimitError } from './gemini-client';
import { logger } from './logger';
// splitPdfPages, getPdfPageCount no longer needed after API call optimization
import { calculateTechStaffValues, type ExtractedStaffMember } from './engine/tech-staff-calculator';

// ─── エラー型 ───

export type GeminiErrorType = 'ai_unavailable' | 'extraction_failed' | 'timeout' | 'rate_limited';

export class GeminiExtractionError extends Error {
  public readonly type: GeminiErrorType;
  public readonly originalError?: unknown;

  constructor(type: GeminiErrorType, message: string, originalError?: unknown) {
    super(message);
    this.name = 'GeminiExtractionError';
    this.type = type;
    this.originalError = originalError;
  }

  static fromError(err: unknown): GeminiExtractionError {
    if (err instanceof GeminiExtractionError) return err;
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('429') || msg.includes('quota') || msg.includes('Too Many Requests')) {
      return new GeminiExtractionError('rate_limited', `Gemini rate limited: ${msg}`, err);
    }
    if (msg.includes('timeout') || msg.includes('DEADLINE_EXCEEDED') || msg.includes('ETIMEDOUT')) {
      return new GeminiExtractionError('timeout', `Gemini request timed out: ${msg}`, err);
    }
    if (msg.includes('API key') || msg.includes('PERMISSION_DENIED') || msg.includes('not found') || msg.includes('Could not load')) {
      return new GeminiExtractionError('ai_unavailable', `Gemini AI unavailable: ${msg}`, err);
    }
    return new GeminiExtractionError('extraction_failed', `Gemini extraction failed: ${msg}`, err);
  }
}

// ─── GenerativeModel の統一インターフェース ───
//
// Vertex AI SDK と Google AI SDK は微妙にAPIが違うため、
// 共通のインターフェースでラップする。
// モデル取得は gemini-client.ts の共有ファクトリを使用する。

interface UnifiedModel {
  generateContent(request: {
    contents: Array<{
      role: string;
      parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
    }>;
  }): Promise<{
    response: {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> };
        finishReason?: string;
      }>;
    };
  }>;
}

async function getGenerativeModel(): Promise<UnifiedModel> {
  const gemini = await getGeminiModel();

  if (gemini.provider === 'gemini-paid') {
    logger.info(`Using Gemini Paid API (${gemini.modelName})`);
    const model = gemini.model;
    return {
      async generateContent(request) {
        const parts = request.contents[0].parts.map((p) => {
          if (p.inlineData) {
            return { inlineData: { mimeType: p.inlineData.mimeType, data: p.inlineData.data } };
          }
          return { text: p.text || '' };
        });
        try {
          const result = await model.generateContent(parts);
          const text = result.response.text();
          return {
            response: {
              candidates: [{
                content: { parts: [{ text }] },
                finishReason: result.response.candidates?.[0]?.finishReason ?? undefined,
              }],
            },
          };
        } catch (err: unknown) {
          if (isRateLimitError(err)) {
            const errMsg = err instanceof Error ? err.message : String(err);
            logger.warn(`[gemini-paid] Rate limited (429), falling back to Vertex AI: ${errMsg.slice(0, 200)}`);
            const vertexModel = gemini.getVertexModel() as unknown as UnifiedModel;
            logger.info(`[gemini-paid→vertex-ai] Retrying with Vertex AI (${gemini.modelName})`);
            return vertexModel.generateContent(request);
          }
          throw err;
        }
      },
    };
  }

  // Vertex AI 方式
  logger.info(`Using Vertex AI (${gemini.modelName})`);
  return gemini.model as unknown as UnifiedModel;
}

// ─── 決算書抽出 ───

const FINANCIAL_PROMPT = `あなたは日本の建設業の決算書（貸借対照表・損益計算書・完成工事原価報告書）を読み取る専門家です。

このPDFは建設業の決算書です。以下の項目をすべて読み取り、JSON形式で返してください。

## ★最重要: 金額の単位
- **すべての金額を「千円」単位で返してください。**
- PDFの金額が「円」単位（例: 1,668,128,000円）の場合は、**必ず1000で割って**千円に変換してください（例: 1,668,128）。
- PDFの金額が「千円」単位（例: 1,668,128千円）の場合は、そのまま返してください。
- PDFの金額が「百万円」単位の場合は、**1000を掛けて**千円に変換してください。
- **判断基準**: PDFのヘッダーや欄外に「単位：円」「（円）」と書かれていれば円単位です。「単位：千円」「（千円）」なら千円単位です。「単位：百万円」なら百万円単位です。
- **典型例**: 中小建設業の売上高は千円単位で数十万〜数百万程度です。1億以上の数値は円単位の可能性が高いです。

## マイナス表記のルール
- △、▲、()（カッコで囲まれた数値）、マイナス記号はすべて**負の数**として返してください。
- 例: △1,234 → -1234、(5,678) → -5678、▲999 → -999

## その他ルール
- 数値が読み取れない場合は 0 としてください。
- 勘定科目の表記揺れ（例:「売上高」と「完成工事高」）は以下のフィールド名に統一してください。
- totalsの合計値は、PDFに記載されている合計値をそのまま使ってください（自分で計算しないでください）。

## ★クロスバリデーション（必ず確認してください）
以下の等式が成り立たない場合、数値の読み間違いがあります。再度読み直してください:
- **totalAssets == totalLiabilities + totalEquity**（貸借対照表の左右一致）
- **fixedAssets == tangibleFixed + intangibleFixed + investments**
- **totalSales == completedConstruction + progressConstruction**
- **grossProfit == totalSales - costOfSales**
- **operatingProfit == grossProfit - sgaTotal**
- **ordinaryProfit == operatingProfit + (営業外収益合計) - (営業外費用合計)**
- **totalCost == materials + labor + subcontract + expenses + wipBeginning - wipEnding**
不一致がある場合は、PDFの数値をもう一度確認して正しい値を返してください。

## 出力JSON形式

{
  "bs": {
    "currentAssets": { "勘定科目名": 金額(千円), ... },
    "tangibleFixed": { "勘定科目名": 金額(千円), ... },
    "intangibleFixed": { "勘定科目名": 金額(千円), ... },
    "investments": { "勘定科目名": 金額(千円), ... },
    "currentLiabilities": { "勘定科目名": 金額(千円), ... },
    "fixedLiabilities": { "勘定科目名": 金額(千円), ... },
    "equity": { "勘定科目名": 金額(千円), ... },
    "totals": {
      "currentAssets": 0,
      "tangibleFixed": 0,
      "intangibleFixed": 0,
      "investments": 0,
      "fixedAssets": 0,
      "totalAssets": 0,
      "currentLiabilities": 0,
      "fixedLiabilities": 0,
      "totalLiabilities": 0,
      "totalEquity": 0
    }
  },
  "pl": {
    "completedConstruction": 0,
    "progressConstruction": 0,
    "totalSales": 0,
    "costOfSales": 0,
    "grossProfit": 0,
    "sgaItems": { "勘定科目名": 金額(千円), ... },
    "sgaTotal": 0,
    "operatingProfit": 0,
    "interestIncome": 0,
    "dividendIncome": 0,
    "miscIncome": 0,
    "interestExpense": 0,
    "miscExpense": 0,
    "ordinaryProfit": 0,
    "specialGain": 0,
    "specialLoss": 0,
    "preTaxProfit": 0,
    "corporateTax": 0,
    "netIncome": 0
  },
  "manufacturing": {
    "materials": 0,
    "labor": 0,
    "expenses": 0,
    "subcontract": 0,
    "mfgDepreciation": 0,
    "wipBeginning": 0,
    "wipEnding": 0,
    "totalCost": 0
  },
  "sga": {
    "sgaDepreciation": 0
  }
}

## 勘定科目のセマンティック・マッピング（意味で探してください）

### 損益計算書（PL）の科目
- **completedConstruction**: 「完成工事高」または「売上高」。PLの最上部、最初の収益項目。建設業では「完成工事高」が一般的。
- **progressConstruction**: 「兼業事業売上高」「その他の売上高」「不動産事業売上高」。完成工事高の直後に記載される副次的な売上。存在しない会社もある。
- **totalSales**: 「売上高合計」。completedConstruction + progressConstruction の合計行。
- **costOfSales**: 「完成工事原価」「売上原価」。売上高のすぐ下にある原価の合計行。
- **grossProfit**: 「完成工事総利益」「売上総利益」。売上高 - 原価の差額として記載される行。
- **sgaItems / sgaTotal**: 「販売費及び一般管理費」セクション内の明細と合計。
- **operatingProfit**: 「営業利益」。販管費の直後に記載される。
- **interestIncome**: 「受取利息」。「営業外収益」セクション内にある。
- **dividendIncome**: 「受取配当金」。「営業外収益」セクション内にある。
- **miscIncome**: 「雑収入」「その他」など、営業外収益のうちinterestIncome・dividendIncome以外の合計。
- **interestExpense**: 「支払利息」「支払利息割引料」。「営業外費用」セクション内にある。
- **miscExpense**: 「雑損失」「その他」など、営業外費用のうちinterestExpense以外の合計。
- **ordinaryProfit**: 「経常利益」。営業外収益・費用の後に記載される。
- **specialGain**: 「特別利益」の合計。
- **specialLoss**: 「特別損失」の合計。
- **preTaxProfit**: 「税引前当期純利益」「税引前当期利益」。
- **corporateTax**: 「法人税、住民税及び事業税」「法人税等」の合計。法人税等調整額も含める。
- **netIncome**: 「当期純利益」「当期利益」。PLの最終行。

### 貸借対照表（BS）の科目
- **currentAssets**: 「流動資産」セクション。現金預金、受取手形、完成工事未収入金（売掛金）、未成工事支出金（仕掛品）等を含む。
- **tangibleFixed**: 「有形固定資産」セクション。建物、構築物、機械装置、車両運搬具、工具器具備品、土地等。
- **intangibleFixed**: 「無形固定資産」セクション。ソフトウェア、特許権、電話加入権等。項目がない会社もある。
- **investments**: 「投資その他の資産」セクション。投資有価証券、長期貸付金、保険積立金等。
- **currentLiabilities**: 「流動負債」セクション。支払手形、工事未払金（買掛金）、短期借入金、未成工事受入金（前受金）等。
- **fixedLiabilities**: 「固定負債」セクション。長期借入金、退職給付引当金等。
- **equity**: 「純資産の部」「株主資本」セクション。資本金、資本剰余金、利益剰余金等。

### 完成工事原価報告書の科目
- **materials**: 「材料費」。原価報告書の最初の大項目。
- **labor**: 「労務費」。原価報告書の2番目の大項目。
- **subcontract**: 「外注費」。原価報告書の3番目の大項目。下請業者への支払い。
- **expenses**: 「経費」。原価報告書の4番目の大項目。
- **mfgDepreciation**: 「減価償却費」で、**完成工事原価報告書の「経費」の内訳**として記載されるもの。「うち減価償却費」と表記されることもある。
- **wipBeginning**: 「期首未成工事支出金」。前期からの繰越仕掛品。
- **wipEnding**: 「期末未成工事支出金」。当期末の仕掛品。マイナス計上される。
- **totalCost**: 「完成工事原価」の合計行。

### 販管費の減価償却費（重要: 混同注意）
- **sgaDepreciation**: 「減価償却費」で、**販売費及び一般管理費の明細**に記載されるもの。原価報告書の減価償却費（mfgDepreciation）とは別物。

## 表記揺れの対応表
| 建設業の表記 | 一般企業の表記 | フィールド |
|---|---|---|
| 完成工事高 | 売上高 | completedConstruction |
| 完成工事原価 | 売上原価 | costOfSales |
| 完成工事総利益 | 売上総利益 | grossProfit |
| 完成工事未収入金 | 売掛金 | (BS currentAssets内) |
| 工事未払金 | 買掛金 | (BS currentLiabilities内) |
| 未成工事支出金 | 仕掛品 | (BS currentAssets内) |
| 未成工事受入金 | 前受金 | (BS currentLiabilities内) |

PDFの全ページを読み取り、上記のJSONを返してください。`;

// (BS_PAGE_PROMPT, PL_PAGE_PROMPT, MFG_PAGE_PROMPT removed - consolidated into FINANCIAL_PROMPT)

/**
 * Gemini Vision API で決算書 PDF からデータを抽出する
 *
 * 最適化版: 1回の包括プロンプトでBS/PL/原価報告書を一括抽出。
 * 従来の5-14回のAPI呼び出しを1回に削減。
 * FINANCIAL_PROMPT は十分に詳細なクロスバリデーション指示を含んでおり、
 * 単一呼び出しでも高い精度を維持する。
 */
export async function extractFinancialDataWithGemini(
  buffer: Buffer,
): Promise<{ data: Partial<RawFinancialData>; method: string; enrichedFields?: string[] } | null> {
  try {
    const model = await getGenerativeModel();

    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf' as const,
        data: buffer.toString('base64'),
      },
    };

    // ── 1回の包括プロンプトで全セクション一括抽出 ──
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [pdfPart, { text: FINANCIAL_PROMPT }] }],
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    logger.info(`[Financial PDF] Single-pass extraction: ${text.length} chars`);

    const parsed = parseJsonResponse<Partial<RawFinancialData>>(text);

    if (!parsed || (!parsed.bs && !parsed.pl && !parsed.manufacturing)) {
      logger.warn('Financial extraction returned empty');
      return null;
    }

    // 単位補正
    autoCorrectUnit(parsed);

    // ── データ補完 ──
    const { enrichFinancialData } = await import('./data-enrichment');
    const enriched = enrichFinancialData(parsed);

    if (enriched.warnings.length > 0) {
      logger.warn('[Financial enrichment warnings]:', enriched.warnings);
    }

    return {
      data: enriched.data,
      method: 'Gemini (single-pass)',
      enrichedFields: enriched.enrichedFields,
    };
  } catch (e) {
    const typed = GeminiExtractionError.fromError(e);
    logger.error(`Gemini financial extraction failed [${typed.type}]:`, typed.message);
    throw typed;
  }
}

// ─── Excel → Gemini テキスト抽出 ───

const EXCEL_FINANCIAL_PROMPT = `あなたは日本の建設業の決算書（貸借対照表・損益計算書・完成工事原価報告書）を読み取る専門家です。

以下はExcelファイルから抽出した決算書データのテキストです。各シートのデータをタブ区切りで表示しています。

## シートの意味を判断する
- Excelファイルには複数のシートがある場合があります。各シートの内容を判断してください。
- 貸借対照表は「BS」「B/S」「貸借」「バランスシート」「貸借対照表」等のシート名の場合があります。
- 損益計算書は「PL」「P/L」「損益」「損益計算書」等のシート名の場合があります。
- 完成工事原価報告書は「原価」「原価報告書」「CR」等のシート名の場合があります。
- シート名だけでなく、シート内の見出し行やヘッダーからも内容を判断してください。

## Excelレイアウトの読み取り方
- 勘定科目名が左列、金額が右列に並ぶ縦型のレイアウトが一般的です。
- 当期と前期の2列がある場合は当期（最新期）の数値を使ってください。当期は右側の列であることが多いですが、列ヘッダー（「当期」「第N期」「令和X年」等）で判断してください。
- 空のセルは0として扱ってください。
- 科目名のインデント（スペース）は分類の階層を示します。インデントが浅い項目は大分類（例：流動資産）、深い項目は明細科目です。

## ★最重要: 金額の単位
- **すべての金額を「千円」単位で返してください。**
- 金額が「円」単位の場合は、**必ず1000で割って**千円に変換してください。
- 金額が「千円」単位の場合は、そのまま返してください。
- **判断基準**: ヘッダーに「単位：円」「（円）」と書かれていれば円単位です。数値が非常に大きい（売上高が1億以上）場合も円単位の可能性が高いです。
- 数値の整合性が取れない場合、単位の違い（円/千円/百万円）を確認してください。シートごとに単位が異なる場合もあります。

## Excel特有の注意点
- 数値が文字列として格納されている場合があります（カンマ付き「1,234,567」等）。カンマを除去して数値として読み取ってください。
- セル結合により空欄に見える箇所にも値がある場合があります。前後の文脈から判断してください。
- 非表示行・列のデータは含まれていない可能性があります。合計値と明細の差異がある場合はその影響を考慮してください。
- 括弧付きの数値（例：(1,234)）はマイナスを意味します。

## その他ルール
- 数値が読み取れない場合は 0 としてください。
- マイナスの金額は負の数（例: -1234）で返してください。△表記もマイナスです。
- 勘定科目の表記揺れ（例:「売上高」と「完成工事高」）は以下のフィールド名に統一してください。
- totalsの合計値は、データに記載されている合計値をそのまま使ってください。
- 複数の期のデータがある場合は、**当期（最新期）の数値**を使ってください。

## クロスバリデーション（整合性チェック）
出力前に以下の整合性を確認し、矛盾があれば元データを再確認してください:
- totalAssets = totalLiabilities + totalEquity（貸借一致の原則）
- totalAssets = currentAssets + fixedAssets（資産の内訳合計）
- fixedAssets = tangibleFixed + intangibleFixed + investments（固定資産の内訳）
- grossProfit = totalSales - costOfSales（売上総利益の計算）
- operatingProfit = grossProfit - sgaTotal（営業利益の計算）
- 整合性が取れない場合は、単位の違いや読み取り誤りを再確認してください。

## 出力JSON形式

{
  "bs": {
    "currentAssets": { "勘定科目名": 金額(千円), ... },
    "tangibleFixed": { "勘定科目名": 金額(千円), ... },
    "intangibleFixed": { "勘定科目名": 金額(千円), ... },
    "investments": { "勘定科目名": 金額(千円), ... },
    "currentLiabilities": { "勘定科目名": 金額(千円), ... },
    "fixedLiabilities": { "勘定科目名": 金額(千円), ... },
    "equity": { "勘定科目名": 金額(千円), ... },
    "totals": {
      "currentAssets": 0,
      "tangibleFixed": 0,
      "intangibleFixed": 0,
      "investments": 0,
      "fixedAssets": 0,
      "totalAssets": 0,
      "currentLiabilities": 0,
      "fixedLiabilities": 0,
      "totalLiabilities": 0,
      "totalEquity": 0
    }
  },
  "pl": {
    "completedConstruction": 0,
    "progressConstruction": 0,
    "totalSales": 0,
    "costOfSales": 0,
    "grossProfit": 0,
    "sgaItems": { "勘定科目名": 金額(千円), ... },
    "sgaTotal": 0,
    "operatingProfit": 0,
    "interestIncome": 0,
    "dividendIncome": 0,
    "miscIncome": 0,
    "interestExpense": 0,
    "miscExpense": 0,
    "ordinaryProfit": 0,
    "specialGain": 0,
    "specialLoss": 0,
    "preTaxProfit": 0,
    "corporateTax": 0,
    "netIncome": 0
  },
  "manufacturing": {
    "materials": 0,
    "labor": 0,
    "expenses": 0,
    "subcontract": 0,
    "mfgDepreciation": 0,
    "wipBeginning": 0,
    "wipEnding": 0,
    "totalCost": 0
  },
  "sga": {
    "sgaDepreciation": 0
  }
}

## 勘定科目のマッピングヒント
- 完成工事高 → completedConstruction
- 兼業事業売上高 → progressConstruction（兼業売上）
- 完成工事原価 → costOfSales
- 完成工事総利益 → grossProfit
- 受取利息 → interestIncome
- 受取配当金 → dividendIncome
- 支払利息 → interestExpense
- 材料費 → materials
- 労務費 → labor
- 外注費 → subcontract
- 経費 → expenses
- 減価償却費（原価報告書内）→ mfgDepreciation
- 減価償却費（販管費内）→ sgaDepreciation
- 期首未成工事支出金 → wipBeginning
- 期末未成工事支出金 → wipEnding

データを読み取り、上記のJSONを返してください。`;

/**
 * Excelファイルの全シートをタブ区切りテキストに変換する
 */
export function excelToText(buffer: ArrayBuffer): string {
  // 動的importを避けるため、呼び出し元でXLSXを渡す
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const XLSX = require('xlsx');
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sections: string[] = [];

  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const csv = XLSX.utils.sheet_to_csv(sheet, { FS: '\t', RS: '\n' });
    // 空行だらけのシートはスキップ
    const nonEmptyLines = csv.split('\n').filter((line: string) => line.replace(/\t/g, '').trim().length > 0);
    if (nonEmptyLines.length < 3) continue;
    sections.push(`=== シート: ${sheetName} ===\n${nonEmptyLines.join('\n')}`);
  }

  return sections.join('\n\n');
}

/**
 * Gemini AI で決算書 Excel からデータを抽出する
 *
 * ExcelのシートをテキストとしてGeminiに渡し、PDFと同品質の抽出を行う。
 * フォールバック: 従来のキーワードマッチ（excel-parser.ts）
 */
export async function extractFinancialDataFromExcel(
  buffer: ArrayBuffer,
): Promise<{ data: Partial<RawFinancialData>; method: string; warnings: string[] } | null> {
  const warnings: string[] = [];

  // Gemini利用可能かチェック
  if (isGeminiAvailable()) {
    try {
      const model = await getGenerativeModel();
      const excelText = excelToText(buffer);

      if (excelText.length < 50) {
        warnings.push('Excelファイルからデータを読み取れませんでした。');
        return null;
      }

      // テキストの長さを制限（トークン上限対策）
      const truncated = excelText.length > 30000
        ? excelText.substring(0, 30000) + '\n\n[...以下省略...]'
        : excelText;

      const prompt = `${EXCEL_FINANCIAL_PROMPT}\n\n--- Excelデータ ---\n${truncated}`;

      const result = await model.generateContent({
        contents: [
          {
            role: 'user',
            parts: [{ text: prompt }],
          },
        ],
      });

      const response = result.response;
      const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

      if (text) {
        const parsed = parseJsonResponse<Partial<RawFinancialData>>(text);
        if (parsed) {
          autoCorrectUnit(parsed);

          // データ補完
          const { enrichFinancialData } = await import('./data-enrichment');
          const enriched = enrichFinancialData(parsed);
          warnings.push(...enriched.warnings);

          if (enriched.enrichedFields.length > 0) {
            logger.info(`[Excel Gemini] Enriched ${enriched.enrichedFields.length} fields`);
          }

          return { data: enriched.data, method: 'Gemini (Excel)', warnings };
        }
      }

      warnings.push('Gemini AIでの解析に失敗しました。キーワードマッチにフォールバックします。');
    } catch (e) {
      logger.error('Gemini Excel extraction failed:', e);
      warnings.push('Gemini AIでの解析でエラーが発生しました。キーワードマッチにフォールバックします。');
    }
  }

  // フォールバック: 従来のキーワードマッチ
  return null; // 呼び出し元で既存のparseExcel()にフォールバック
}

// ─── 経審結果通知書 PDF → Gemini 抽出 ───

export interface ResultPdfScores {
  label: string;
  Y: string;
  X2: string;
  X21: string;
  X22: string;
  W: string;
  industries: Array<{ name: string; X1: string; Z: string; P: string }>;
}

const RESULT_PDF_PROMPT = `あなたは建設業の経営事項審査（経審）結果通知書を正確に読み取る専門AIです。

このPDFは「総合評定値通知書」（経審の結果通知書）です。
以下の情報を正確に抽出して、JSONで返してください。

## フォーマットに関する注意
- 結果通知書のフォーマットは都道府県や年度により異なる場合があります。セル位置ではなく、項目名の意味から値を特定してください。
- 業種別テーブルでは、業種名が左列に、X1, Z, P の順で右に並ぶのが一般的ですが、列順が異なる場合もあります。列ヘッダーを必ず確認してください。
- 業種名は正式名称（例:「電気工事」）または略称（例:「電気」）で記載されます。どちらの場合も略称で出力してください。

## 抽出すべき項目と意味

1. **label**: 審査対象の期（例: "第58期"、"令和6年3月期"）。見つからなければ空文字。
2. **Y**: 経営状況分析の評点（Y点）。財務分析8指標から算出される。通常200〜1595の範囲。3〜4桁の数値文字列。
3. **X2**: 自己資本額及び利益額の評点。X21とX22から算出される。通常454〜2280の範囲。3〜4桁の数値文字列。
4. **X21**: 自己資本額の評点。3〜4桁の数値文字列。X2だけ見つかった場合でもX21を別途探してください。
5. **X22**: 利益額の評点。3〜4桁の数値文字列。X2だけ見つかった場合でもX22を別途探してください。
6. **W**: 社会性等の評点（W点）。通常0〜2082の範囲。3〜4桁の数値文字列。
7. **industries**: 業種別の評点一覧。各業種について:
   - **name**: 業種名（略称で出力。例: "電気", "管", "土木"）
   - **X1**: 完成工事高の評点。業種ごとに異なる値。業種名の行に対応する数値を読み取る。通常397〜2447の範囲。数値文字列。
   - **Z**: 技術力の評点。X1と技術職員数から算出される。通常456〜2441の範囲。数値文字列。
   - **P**: 総合評定値（P点）。0.25*X1 + 0.15*X2 + 0.20*Y + 0.25*Z + 0.15*W で計算される。通常200〜2136の範囲。数値文字列。

## クロスバリデーション
- P点は X1, X2, Y, Z, W から計算されるため（P = 0.25*X1 + 0.15*X2 + 0.20*Y + 0.25*Z + 0.15*W）、抽出した値との整合性を確認してください。大きくずれている場合は読み取りを再確認してください。
- X2はX21とX22から算出されます。X2の値がX21やX22と大幅に乖離していないか確認してください。
- 各評点の妥当な範囲: Y=200-1595, X1=397-2447, X2=454-2280, Z=456-2441, W=0-2082, P=200-2136。範囲外の値が見つかった場合は読み取りミスの可能性があるため再確認してください。

## 注意事項
- 数値は必ず文字列で返してください（例: "1067", "810"）
- 見つからない項目は空文字 "" を返してください
- 業種が複数ある場合はすべて含めてください
- X1, Z, P は業種ごとに異なる値です

## 出力JSON形式
{
  "label": "第58期",
  "Y": "810",
  "X2": "795",
  "X21": "810",
  "X22": "687",
  "W": "750",
  "industries": [
    { "name": "電気", "X1": "1067", "Z": "780", "P": "850" },
    { "name": "管", "X1": "419", "Z": "620", "P": "520" }
  ]
}

PDFの全ページを読み取り、上記のJSONを返してください。`;

/**
 * Gemini Vision API で経審結果通知書 PDF からスコアを抽出する
 *
 * Document AI不要で、Gemini単独で高精度抽出を行う。
 * 単一呼び出しで抽出（プロンプトにクロスバリデーション指示を含むため十分正確）。
 */
export async function extractResultPdfWithGemini(
  buffer: Buffer,
): Promise<{ scores: ResultPdfScores; method: string } | null> {
  if (!isGeminiAvailable()) return null;

  try {
    const model = await getGenerativeModel();

    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf' as const,
        data: buffer.toString('base64'),
      },
    };

    // 単一呼び出しで抽出
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [pdfPart, { text: RESULT_PDF_PROMPT }] }],
    });

    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const scores = parseJsonResponse<ResultPdfScores>(text);

    if (!scores) {
      logger.warn('Gemini result PDF extraction: parse failed');
      return null;
    }

    logger.info('Result PDF Gemini extraction:', JSON.stringify(scores).slice(0, 300));
    return { scores, method: 'Gemini' };
  } catch (e) {
    const typed = GeminiExtractionError.fromError(e);
    logger.error(`Gemini result PDF extraction failed [${typed.type}]:`, typed.message);
    throw typed;
  }
}

// ─── 単位自動補正 ───

/**
 * Geminiが「円」で返した場合に自動で「千円」に補正する。
 *
 * 判定ロジック: totalAssets（総資産）が 10,000,000 千円（= 100億円）を超える場合、
 * 中小建設業ではありえないため、円で返されたと判断して全数値を1000で割る。
 * 目安: 中小建設業の総資産は通常 数千万～数十億円 = 千円で数万～数百万。
 */
export function autoCorrectUnit(data: Partial<RawFinancialData>): void {
  const totalAssets = data.bs?.totals?.totalAssets ?? 0;

  // 10,000,000千円 = 100億円を閾値とする
  if (totalAssets < 10_000_000) return;

  logger.warn(
    `Auto-correcting unit: totalAssets=${totalAssets} looks like yen, dividing all by 1000`
  );

  const divK = (n: number) => Math.floor(n / 1000);

  // BS個別科目
  if (data.bs) {
    for (const section of [
      'currentAssets', 'tangibleFixed', 'intangibleFixed',
      'investments', 'currentLiabilities', 'fixedLiabilities', 'equity',
    ] as const) {
      const rec = data.bs[section];
      if (rec && typeof rec === 'object') {
        for (const key of Object.keys(rec)) {
          (rec as Record<string, number>)[key] = divK((rec as Record<string, number>)[key] ?? 0);
        }
      }
    }
    // BS合計
    if (data.bs.totals) {
      for (const key of Object.keys(data.bs.totals)) {
        (data.bs.totals as Record<string, number>)[key] = divK(
          (data.bs.totals as Record<string, number>)[key] ?? 0
        );
      }
    }
  }

  // PL
  if (data.pl) {
    const pl = data.pl;
    const numKeys: Array<keyof typeof pl> = [
      'completedConstruction', 'progressConstruction', 'totalSales',
      'costOfSales', 'grossProfit', 'sgaTotal', 'operatingProfit',
      'interestIncome', 'dividendIncome', 'miscIncome',
      'interestExpense', 'miscExpense', 'ordinaryProfit',
      'specialGain', 'specialLoss', 'preTaxProfit',
      'corporateTax', 'netIncome',
    ];
    const plRecord = pl as Record<string, number | Record<string, number>>;
    for (const key of numKeys) {
      const val = plRecord[key];
      if (typeof val === 'number') {
        plRecord[key] = divK(val);
      }
    }
    // 販管費内訳
    if (pl.sgaItems && typeof pl.sgaItems === 'object') {
      for (const k of Object.keys(pl.sgaItems)) {
        pl.sgaItems[k] = divK(pl.sgaItems[k] ?? 0);
      }
    }
  }

  // 製造原価
  if (data.manufacturing) {
    for (const key of Object.keys(data.manufacturing)) {
      (data.manufacturing as Record<string, number>)[key] = divK(
        (data.manufacturing as Record<string, number>)[key] ?? 0
      );
    }
  }

  // 販管費減価償却
  if (data.sga) {
    data.sga.sgaDepreciation = divK(data.sga.sgaDepreciation ?? 0);
  }
}

// ─── 提出用資料抽出（マルチパス方式） ───
//
// 20ページの経審PDFを1回で全部読むと情報量が多すぎて読み漏れが発生する。
// セクション別に3つの専用プロンプトで並列抽出し、結果をマージする。

// ── 統合プロンプト: 基本情報 + 業種別完成工事高 + W項目を一括抽出 ──
const PROMPT_KEISHIN_COMPREHENSIVE = `あなたは日本の建設業の経営事項審査（経審）の提出書類を読み取る専門家です。

このPDFから以下の3セクションを**すべて**読み取ってください:
1. 基本情報（表紙・総括表・経営状況分析）
2. 業種別完成工事高（別紙一）
3. 社会性等W項目（別紙三）

---

## セクション1: 基本情報

### 読み取り対象
- 会社名（商号又は名称）
- 許可番号（例: 大阪府知事 第12345号、国土交通大臣 第12345号）
- 審査基準日（例: 2024-03-31）
- 審査対象事業年度（第N期）
- 自己資本額（千円）→ equity
- 利払前税引前償却前利益（千円）→ ebitda
- 技術職員数の合計 → techStaffCount
- 営業年数 → businessYears

### 値の妥当性チェック
- **自己資本額（equity）**: 千円単位で1,000,000,000（=1兆円）を超える場合は円単位の可能性→1000で割る。
- **営業年数（businessYears）**: 通常1〜100の範囲。固定帳票では各桁が別マス。1桁の場合は隣マスを再確認。
- **EBITDA（ebitda）**: 利払前税引前償却前利益。マイナスもあり得る。
- **技術職員数（techStaffCount）**: 通常1〜数百。

---

## セクション2: 業種別完成工事高（別紙一）

### ★最重要ルール
- 別紙一には2つの表: 「工事種類別完成工事高」と「工事種類別元請完成工事高」
- **各行の数値は業種ごとに異なります。** 全業種同一値は列の読み取りミスの可能性大。
- 金額は「千円」単位。

### テーブル列構造
| 業種コード | 業種名 | 2年前 | **前期** | **当期** | 計/平均 |
- prevCompletion = 前期の列、currCompletion = 当期の列
- **2年前の列をprevCompletionと間違えないこと！**
- ヘッダーの年度表記（令和X年等）で前期/当期を判断。

### 注意事項
- PDFに実際にデータ行がある業種だけを返す。存在しない業種は追加しない。
- 全値0の業種も行が存在すれば含める。
- 当期 < 前期は普通にあり得る。

### 業種コード対応表
01=土木一式, 02=建築一式, 03=大工, 04=左官, 05=とび・土工・コンクリート,
06=石, 07=屋根, 08=電気, 09=管, 10=タイル・れんが・ブロック,
11=鋼構造物, 12=鉄筋, 13=舗装, 14=しゅんせつ, 15=板金,
16=ガラス, 17=塗装, 18=防水, 19=内装仕上, 20=機械器具設置,
21=熱絶縁, 22=電気通信, 23=造園, 24=さく井, 25=建具,
26=水道施設, 27=消防施設, 28=清掃施設, 29=解体

### 技術職員数値
- 総括表や別紙二の業種別集計欄にある「技術職員数値」を各業種のtechStaffValueに設定。
- 見つからない場合は0。

---

## セクション3: 社会性等W項目（別紙三）

### 保険加入状況（有=true / 無=false）
- 雇用保険 → employmentInsurance
- 健康保険 → healthInsurance
- 厚生年金保険 → pensionInsurance

### 労働福祉
- 建設業退職金共済制度 → constructionRetirementMutualAid (true/false)
- 退職一時金制度 or 企業年金制度 → retirementSystem (true/false)
- 法定外労働災害補償制度 → nonStatutoryAccidentInsurance (true/false)

### 技術者・技能者
- 若年技術職員の継続的な育成及び確保 → youngTechContinuous (true/false)
- 新規若年技術職員の育成及び確保 → youngTechNew (true/false)
- 若年技術職員数 → youngTechCount (数値)
- 新規若年技術職員数 → newYoungTechCount (数値)
- CPD単位合計 → cpdTotalUnits (数値)
- 技能レベル向上者数 → skillLevelUpCount (数値)
- 技能者数（控除対象者含む） → skilledWorkerCount (数値)
- 控除対象者数 → deductionTargetCount (数値)

### ワークライフバランス
- えるぼし認定 → wlbEruboshi (0=なし, 1=1段階, 2=2段階, 3=3段階, 4=プラチナ)
- くるみん認定 → wlbKurumin (0=なし, 1=くるみん, 2=トライくるみん, 3=プラチナ)
- ユースエール認定 → wlbYouth (0=なし, 1=あり)

### CCUS
- CCUS活用 → ccusImplementation (0=なし, 1=民間工事, 2=全工事)

### 営業年数・法令遵守
- ★営業年数は通常2桁（10〜60年）。固定帳票では各桁が別マス。[5][7]→57年。1桁の場合は隣マスを再確認。
- 営業年数 → businessYears (数値)
- 民事再生法又は会社更生法 → civilRehabilitation (true/false)
- 防災活動への貢献 → disasterAgreement (true/false)
- 営業停止処分 → suspensionOrder (true/false)
- 指示処分 → instructionOrder (true/false)

### 監査・経理
- 監査の受審状況 → auditStatus (0=なし, 1=会計参与設置, 2=会計監査人設置)
- 公認会計士等の数 → certifiedAccountants (数値)
- 1級登録経理士の数 → firstClassAccountants (数値)
- 2級登録経理士の数 → secondClassAccountants (数値)

### その他
- 研究開発費 2期平均 → rdExpense2YearAvg (千円)
- 建設機械の所有及びリース台数 → constructionMachineCount (数値)
- ISO 9001 認証 → iso9001 (true/false)
- ISO 14001 認証 → iso14001 (true/false)
- エコアクション21 認証 → ecoAction21 (true/false)

### チェックボックスの読み取りルール
- true: ✓、○、レ、1、有、チェック済み
- false: 空欄、×、0、無、チェックなし
- 判断に迷う場合はfalse

---

## 出力JSON（3セクション統合）
{
  "basic": {
    "companyName": "",
    "permitNumber": "",
    "reviewBaseDate": "",
    "periodNumber": "",
    "equity": 0,
    "ebitda": 0,
    "techStaffCount": 0,
    "businessYears": 0
  },
  "industries": [
    {
      "name": "業種名",
      "code": "08",
      "prevCompletion": 0,
      "currCompletion": 0,
      "prevPrimeContract": 0,
      "currPrimeContract": 0,
      "techStaffValue": 0
    }
  ],
  "wItems": {
    "employmentInsurance": false,
    "healthInsurance": false,
    "pensionInsurance": false,
    "constructionRetirementMutualAid": false,
    "retirementSystem": false,
    "nonStatutoryAccidentInsurance": false,
    "youngTechContinuous": false,
    "youngTechNew": false,
    "techStaffCount": 0,
    "youngTechCount": 0,
    "newYoungTechCount": 0,
    "cpdTotalUnits": 0,
    "skillLevelUpCount": 0,
    "skilledWorkerCount": 0,
    "deductionTargetCount": 0,
    "wlbEruboshi": 0,
    "wlbKurumin": 0,
    "wlbYouth": 0,
    "ccusImplementation": 0,
    "businessYears": 0,
    "civilRehabilitation": false,
    "disasterAgreement": false,
    "suspensionOrder": false,
    "instructionOrder": false,
    "auditStatus": 0,
    "certifiedAccountants": 0,
    "firstClassAccountants": 0,
    "secondClassAccountants": 0,
    "rdExpense2YearAvg": 0,
    "constructionMachineCount": 0,
    "iso9001": false,
    "iso14001": false,
    "ecoAction21": false
  }
}

金額は「千円」単位。数値が見つからない場合は0。PDFの全ページを読み取ってください。`;

// ── Pass 6: 技術職員名簿（別紙二）── フォーマット非依存 ──
const PROMPT_TECH_STAFF = `あなたは日本の建設業の経営事項審査（経審）の技術職員名簿を読み取る専門家です。

このPDFの中から**技術職員名簿（別紙二）**の生データを正確に読み取ってください。
フォーマットは問いません（PDF、Excel出力、手書きスキャン等どれでも対応してください）。

## ★重要：あなたの仕事は「データ抽出のみ」です
- 点数の計算はしないでください
- 業種の推定はしないでください（PDFに書かれている値をそのまま読む）
- 有資格区分コードの値をPDFから正確に読み取ることが最重要です

## 読み取り対象（各行の列）

名簿の各行から以下の情報を読み取ってください:

1. **氏名** (name): 技術職員の氏名
2. **業種コード1** (industryCode1): 1つ目の業種コード（2桁の数字。例: "08"）
3. **有資格区分コード1** (qualificationCode1): 1つ目の有資格区分コード（3桁の数字。例: 127）
4. **講習受講フラグ1** (lectureFlag1): 監理技術者講習の受講状態。1=受講済、2=未受講、空欄の場合は0
5. **業種コード2** (industryCode2): 2つ目の業種コード（任意、なければ省略）
6. **有資格区分コード2** (qualificationCode2): 2つ目の有資格区分コード（任意、なければ省略）
7. **講習受講フラグ2** (lectureFlag2): 2つ目の講習受講フラグ（任意）
8. **監理技術者資格者証番号** (supervisorCertNumber): 監理技術者資格者証の交付番号（あれば文字列、なければ省略）

## 有資格区分コードの読み方のヒント

PDFの名簿には「有資格区分」列があり、3桁の数字が記載されています。
例: 127 = 1級電気工事施工管理技士, 128 = 2級電気工事施工管理技士
これらの数字をそのまま読み取ってください。**コードの意味を解釈する必要はありません。**

よく出てくるコード（読み取りの参考）:
101=1級建設機械, 102=2級建設機械, 103=1級土木, 104=2級土木,
107=1級建築, 108=2級建築(建築), 109=2級建築(躯体), 110=2級建築(仕上),
127=1級電気工事, 128=2級電気工事, 129=1級管工事, 130=2級管工事,
131=1級電気通信, 132=2級電気通信, 133=1級造園, 134=2級造園,
152=第一種電気工事士, 153=第二種電気工事士, 155=甲種消防設備士, 156=乙種消防設備士

## 業種コード一覧（読み取りの参考）
01=土木, 02=建築, 03=大工, 04=左官, 05=とび, 06=石, 07=屋根,
08=電気, 09=管, 10=タイル, 11=鋼構造物, 12=鉄筋, 13=舗装,
14=しゅんせつ, 15=板金, 16=ガラス, 17=塗装, 18=防水,
19=内装仕上, 20=機械器具, 21=熱絶縁, 22=電気通信, 23=造園,
24=さく井, 25=建具, 26=水道施設, 27=消防施設, 28=清掃施設, 29=解体

## ★重要な注意事項
- 名簿が見つからない場合は、staffListを空配列で返してください
- 数字が読みにくい場合でも、最善の推測で読み取ってください
- 点数や合計値の計算は一切不要です。生データだけ返してください
- 業種コード欄に記載がない場合は、空文字列ではなく省略してください

## 出力JSON

{
  "staffList": [
    {
      "name": "山田太郎",
      "industryCode1": "08",
      "qualificationCode1": 127,
      "lectureFlag1": 1,
      "industryCode2": "09",
      "qualificationCode2": 129,
      "lectureFlag2": 0,
      "supervisorCertNumber": "第12345号"
    },
    {
      "name": "鈴木花子",
      "industryCode1": "08",
      "qualificationCode1": 152,
      "lectureFlag1": 0
    }
  ],
  "totalStaffCount": 20
}`;

/** Geminiから返される生データ型（抽出のみ、計算なし） */
interface GeminiTechStaffRawResult {
  staffList: Array<{
    name: string;
    industryCode1?: string;
    qualificationCode1?: number;
    lectureFlag1?: number;
    industryCode2?: string;
    qualificationCode2?: number;
    lectureFlag2?: number;
    supervisorCertNumber?: string;
  }>;
  totalStaffCount: number;
}

/** Pass 6 の結果型（計算エンジン通過後） */
interface PassTechStaffResult {
  staffList: ExtractedStaffMember[];
  industryTotals: Record<string, number>;
  totalStaffCount: number;
}

/** Gemini から返された KeishinPdfResult の部分型 */
export interface KeishinGeminiResult {
  basicInfo: {
    companyName: string;
    permitNumber: string;
    reviewBaseDate: string;
    periodNumber: string;
  };
  equity: number;
  ebitda: number;
  techStaffCount: number;
  industries: Array<{
    name: string;
    code: string;
    prevCompletion: number;
    currCompletion: number;
    prevPrimeContract: number;
    currPrimeContract: number;
    techStaffValue?: number;
  }>;
  wItems: Partial<SocialItems>;
  businessYears: number;
  /** 技術職員名簿から抽出した個別職員リスト */
  staffList?: ExtractedStaffMember[];
}

/**
 * 技術職員名簿を抽出する（最適化版）
 *
 * PDF全体にPROMPT_TECH_STAFFを適用する単一呼び出し方式。
 * プロンプト自体が「技術職員名簿（別紙二）」のページを特定する指示を含んでおり、
 * ページ検出の追加API呼び出しは不要。
 */
async function extractTechStaffWithPageSplit(
  model: UnifiedModel,
  _buffer: Buffer,
  fullPdfPart: { inlineData: { mimeType: string; data: string } },
): Promise<PassTechStaffResult | null> {
  try {
    return await callTechStaffGemini(model, fullPdfPart);
  } catch (e) {
    const typed = GeminiExtractionError.fromError(e);
    logger.error(`[Tech Staff] extraction failed [${typed.type}]:`, typed.message);
    // Re-throw critical errors (auth/config issues); return null only for extraction failures
    if (typed.type === 'ai_unavailable' || typed.type === 'rate_limited') {
      throw typed;
    }
    return null;
  }
}

/**
 * PROMPT_TECH_STAFF を使ってGeminiから生データを抽出し、
 * 決定的計算エンジンで技術職員数値を算出する
 */
async function callTechStaffGemini(
  model: UnifiedModel,
  pdfPart: { inlineData: { mimeType: string; data: string } },
): Promise<PassTechStaffResult | null> {
  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [pdfPart, { text: PROMPT_TECH_STAFF }] }],
    });
    const text = result.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
    const rawData = parseJsonResponse<GeminiTechStaffRawResult>(text);

    if (!rawData?.staffList || rawData.staffList.length === 0) {
      logger.warn('[Tech Staff] No staff list extracted from PDF');
      return null;
    }

    logger.info(`[Tech Staff] Extracted ${rawData.staffList.length} raw staff entries from PDF`);

    // Geminiの生データを ExtractedStaffMember に変換
    const extractedStaff: ExtractedStaffMember[] = rawData.staffList.map((s) => ({
      name: s.name,
      industryCode1: s.industryCode1,
      qualificationCode1: s.qualificationCode1,
      lectureFlag1: s.lectureFlag1,
      industryCode2: s.industryCode2,
      qualificationCode2: s.qualificationCode2,
      lectureFlag2: s.lectureFlag2,
      supervisorCertNumber: s.supervisorCertNumber,
    }));

    // 決定的計算エンジンで点数を算出
    const calcResult = calculateTechStaffValues(extractedStaff);

    logger.info(`[Tech Staff] Calculated industryTotals:`, JSON.stringify(calcResult.industryTotals));

    // バリデーション: techStaffValueが異常に大きくないか
    for (const [code, val] of Object.entries(calcResult.industryTotals)) {
      if (val > 500) {
        logger.warn(`[Tech Staff] Suspicious value for industry ${code}: ${val}, capping at 500`);
        calcResult.industryTotals[code] = Math.min(val, 500);
      }
    }

    return {
      staffList: extractedStaff,
      industryTotals: calcResult.industryTotals,
      totalStaffCount: calcResult.totalStaffCount,
    };
  } catch (e) {
    const typed = GeminiExtractionError.fromError(e);
    logger.error(`[Tech Staff] callTechStaffGemini failed [${typed.type}]:`, typed.message);
    throw typed;
  }
}

// ── Pass別の型定義 ──
interface PassBasicResult {
  companyName: string;
  permitNumber: string;
  reviewBaseDate: string;
  periodNumber: string;
  equity: number;
  ebitda: number;
  techStaffCount: number;
  businessYears: number;
}

interface PassIndustriesResult {
  industries: Array<{
    name: string;
    code: string;
    prevCompletion: number;
    currCompletion: number;
    prevPrimeContract: number;
    currPrimeContract: number;
    techStaffValue?: number;
  }>;
}

/** 統合プロンプトの結果型 */
interface ComprehensiveKeishinResult {
  basic: PassBasicResult;
  industries: PassIndustriesResult['industries'];
  wItems: Partial<SocialItems>;
}

// ── Pass 4: 検証パス用プロンプト ──
function buildVerificationPrompt(merged: KeishinGeminiResult): string {
  const indStr = merged.industries
    .map((i) => `  ${i.name}(${i.code}): 前期完工高=${i.prevCompletion}, 当期完工高=${i.currCompletion}, 前期元請=${i.prevPrimeContract}, 当期元請=${i.currPrimeContract}`)
    .join('\n');

  return `あなたは日本の建設業の経営事項審査（経審）の提出書類を読み取る専門家です。

以下は、このPDFから自動抽出した結果です。
**PDFの原本と照合して、誤っている項目を修正してください。**

## 抽出結果（要検証）
- 会社名: ${merged.basicInfo.companyName}
- 許可番号: ${merged.basicInfo.permitNumber}
- 審査基準日: ${merged.basicInfo.reviewBaseDate}
- 自己資本額: ${merged.equity} 千円
- 利払前税引前償却前利益: ${merged.ebitda} 千円
- 技術職員数: ${merged.techStaffCount} 人
- 営業年数: ${merged.businessYears} 年

### 業種別完成工事高（千円）
${indStr}

## 検証ルール
1. **自己資本額（equity）**: 「経営状況分析」の「自己資本額」欄の値（千円単位）。100億を超える値は円で読んでいる可能性が高い → 1000で割る。
2. **営業年数（最重要）**: 「その他の審査項目（社会性等）」の「営業年数」欄。通常2桁（10〜60年程度）。固定帳票では各桁が別のマス目に入っています。
   - **営業年数が1桁（1〜9）の場合は必ず再確認してください。** 隣のマス目に2桁目がないか、PDFを注意深く確認してください。
   - 「57」を「5」、「35」を「3」と読み間違えるパターンが頻発します。
   - 初回許可年月日が読める場合、審査基準日との年数差と営業年数が一致するか確認してください。
3. **業種別完成工事高**: 「別紙一」の各列を正確に読む。前期/当期が逆になっていないか、桁が合っているか確認。
4. **許可番号**: 「○○県知事」か「国土交通大臣」か、番号は何番か。

## 出力
修正後の値だけをJSONで返してください。変更がない項目も全て含めてください。

{
  "companyName": "",
  "permitNumber": "",
  "reviewBaseDate": "",
  "periodNumber": "",
  "equity": 0,
  "ebitda": 0,
  "techStaffCount": 0,
  "businessYears": 0,
  "industries": [
    {
      "name": "",
      "code": "",
      "prevCompletion": 0,
      "currCompletion": 0,
      "prevPrimeContract": 0,
      "currPrimeContract": 0
    }
  ]
}`;
}

/** 検証パスの結果型 */
interface VerificationResult {
  companyName: string;
  permitNumber: string;
  reviewBaseDate: string;
  periodNumber: string;
  equity: number;
  ebitda: number;
  techStaffCount: number;
  businessYears: number;
  industries: Array<{
    name: string;
    code: string;
    prevCompletion: number;
    currCompletion: number;
    prevPrimeContract: number;
    currPrimeContract: number;
  }>;
}

/**
 * Gemini Vision API で経審提出書 PDF からデータを抽出する（最適化版）
 *
 * 3パス方式:
 * 1. 統合プロンプト（基本情報 + 業種 + W項目を一括抽出）
 * 2. 技術職員名簿（別紙二、別パーサーが必要）
 * 3. 検証パス（抽出結果をPDFと照合）
 *
 * 従来の7-15+回のAPI呼び出しを3回に削減。
 */
export async function extractKeishinDataWithGemini(
  buffer: Buffer,
): Promise<{ data: KeishinGeminiResult; method: string } | null> {
  try {
    const model = await getGenerativeModel();

    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf' as const,
        data: buffer.toString('base64'),
      },
    };

    // ── 2パス並列実行（統合プロンプト + 技術職員名簿）──
    const [comprehensiveResult, techStaffResult] = await Promise.allSettled([
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: PROMPT_KEISHIN_COMPREHENSIVE }] }] }),
      extractTechStaffWithPageSplit(model, buffer, pdfPart),
    ]);

    logger.info(
      'Keishin optimized extraction:',
      `comprehensive=${comprehensiveResult.status}, techStaff=${techStaffResult.status}`
    );

    // ── 統合結果をパース ──
    const comprehensiveText = comprehensiveResult.status === 'fulfilled'
      ? comprehensiveResult.value.response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      : '';
    const parsed = parseJsonResponse<ComprehensiveKeishinResult>(comprehensiveText);

    logger.debug('Comprehensive:', JSON.stringify(parsed).slice(0, 500));

    // ── マージ ──
    const merged: KeishinGeminiResult = {
      basicInfo: { companyName: '', permitNumber: '', reviewBaseDate: '', periodNumber: '' },
      equity: 0,
      ebitda: 0,
      techStaffCount: 0,
      industries: parsed?.industries || [],
      wItems: parsed?.wItems || {},
      businessYears: 0,
    };

    // 統合結果から基本情報を展開
    if (parsed?.basic) {
      merged.basicInfo.companyName = parsed.basic.companyName || '';
      merged.basicInfo.permitNumber = parsed.basic.permitNumber || '';
      merged.basicInfo.reviewBaseDate = parsed.basic.reviewBaseDate || '';
      merged.basicInfo.periodNumber = parsed.basic.periodNumber || '';
      merged.equity = parsed.basic.equity || 0;
      merged.ebitda = parsed.basic.ebitda || 0;
      merged.techStaffCount = parsed.basic.techStaffCount || 0;
      merged.businessYears = parsed.basic.businessYears || 0;
    }

    // W項目からtechStaffCount, businessYearsを補完
    const parsedW = parsed?.wItems;
    if (parsedW) {
      if (parsedW.techStaffCount && parsedW.techStaffCount > 0) {
        merged.techStaffCount = parsedW.techStaffCount;
      }
      if (parsedW.businessYears && parsedW.businessYears > 0) {
        merged.businessYears = parsedW.businessYears;
      }
    }

    // ── 技術職員数値の統合 ──
    const parsedTechStaff = techStaffResult.status === 'fulfilled'
      ? techStaffResult.value
      : null;

    if (parsedTechStaff?.industryTotals) {
      logger.info('[Tech Staff] industryTotals:', JSON.stringify(parsedTechStaff.industryTotals));
      logger.info('[Tech Staff] staffList:', parsedTechStaff.staffList?.length, 'entries');

      // 各業種のtechStaffValueを設定
      for (const ind of merged.industries) {
        const code = ind.code.padStart(2, '0');
        const techVal = parsedTechStaff.industryTotals[code] || parsedTechStaff.industryTotals[ind.code];
        if (techVal && techVal > 0) {
          if (!ind.techStaffValue || ind.techStaffValue === 0) {
            ind.techStaffValue = techVal;
            logger.debug(`[Tech Staff] Set ${ind.name}(${ind.code}) techStaffValue = ${techVal}`);
          }
        }
      }

      // techStaffCountの更新
      if (parsedTechStaff.totalStaffCount > 0 && merged.techStaffCount === 0) {
        merged.techStaffCount = parsedTechStaff.totalStaffCount;
      }

      // 個別職員リストを保存（TechStaffPanel自動入力用）
      if (parsedTechStaff.staffList && parsedTechStaff.staffList.length > 0) {
        merged.staffList = parsedTechStaff.staffList;
        logger.info(`[Tech Staff] Preserved ${parsedTechStaff.staffList.length} staff entries for TechStaffPanel`);
      }
    }

    // ── バリデーション ──
    validateAndCorrectKeishin(merged);

    // ── 検証パス（結果をPDFと照合） ──
    try {
      const verifyPrompt = buildVerificationPrompt(merged);
      const verifyResult = await model.generateContent({
        contents: [{ role: 'user', parts: [pdfPart, { text: verifyPrompt }] }],
      });
      const verifyText = verifyResult.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const verified = parseJsonResponse<VerificationResult>(verifyText);

      if (verified) {
        logger.debug('Verification:', JSON.stringify(verified).slice(0, 500));

        if (verified.companyName) merged.basicInfo.companyName = verified.companyName;
        if (verified.permitNumber) merged.basicInfo.permitNumber = verified.permitNumber;
        if (verified.reviewBaseDate) merged.basicInfo.reviewBaseDate = verified.reviewBaseDate;
        if (verified.periodNumber) merged.basicInfo.periodNumber = verified.periodNumber;
        if (verified.equity > 0) merged.equity = verified.equity;
        if (verified.ebitda !== undefined) merged.ebitda = verified.ebitda;
        if (verified.techStaffCount > 0) merged.techStaffCount = verified.techStaffCount;
        if (verified.businessYears > 0) {
          merged.businessYears = verified.businessYears;
          if (merged.wItems) {
            (merged.wItems as Record<string, unknown>).businessYears = verified.businessYears;
          }
        }
        if (verified.industries?.length > 0) {
          merged.industries = verified.industries;
        }

        validateAndCorrectKeishin(merged);
      }
    } catch (e) {
      logger.warn('Verification pass failed, using consensus data:', e);
    }

    // 業種品質チェック
    if (merged.industries.length >= 2) {
      const vals = merged.industries.map(
        (ind) => `${ind.prevCompletion}-${ind.currCompletion}-${ind.prevPrimeContract}-${ind.currPrimeContract}`
      );
      const allSame = vals.every((v) => v === vals[0]);
      if (allSame && vals[0] !== '0-0-0-0') {
        logger.warn('Industries identical after consensus. Resetting.');
        for (const ind of merged.industries) {
          ind.prevCompletion = 0;
          ind.currCompletion = 0;
          ind.prevPrimeContract = 0;
          ind.currPrimeContract = 0;
        }
      }
    }

    const hasAnyData =
      merged.basicInfo.companyName ||
      merged.equity > 0 ||
      merged.industries.length > 0 ||
      Object.keys(merged.wItems).length > 0;

    if (!hasAnyData) {
      logger.warn('Optimized extraction returned no meaningful data');
      return null;
    }

    // ── データ補完 ──
    const { enrichKeishinData } = await import('./data-enrichment');
    const enrichResult = enrichKeishinData(merged);
    if (enrichResult.warnings.length > 0) {
      logger.warn('[Keishin enrichment warnings]:', enrichResult.warnings);
    }

    return { data: merged, method: 'Gemini (optimized 3-pass)' };
  } catch (e) {
    const typed = GeminiExtractionError.fromError(e);
    logger.error(`Gemini keishin extraction failed [${typed.type}]:`, typed.message);
    throw typed;
  }
}

// ── バリデーション＆自動補正 ──

/**
 * 経審データのバリデーションと自動補正
 * - equity が異常に大きい → 円で読んでいるので千円に変換
 * - businessYears の妥当性チェック
 * - 業種コードの正規化
 */
function validateAndCorrectKeishin(data: KeishinGeminiResult): void {
  // equity: 10億千円（= 1兆円）を超える場合は円で読んでいる
  if (data.equity > 1_000_000_000) {
    logger.warn(`Keishin equity=${data.equity} looks like yen, dividing by 1000`);
    data.equity = Math.floor(data.equity / 1000);
  }
  // ebitda も同様
  if (Math.abs(data.ebitda) > 1_000_000_000) {
    logger.warn(`Keishin ebitda=${data.ebitda} looks like yen, dividing by 1000`);
    data.ebitda = Math.floor(data.ebitda / 1000);
  }

  // 業種の完工高も: 1億千円（= 1000億円）超は円の可能性
  for (const ind of data.industries) {
    if (ind.prevCompletion > 100_000_000 || ind.currCompletion > 100_000_000) {
      logger.warn(`Industry ${ind.name}: values look like yen, dividing by 1000`);
      ind.prevCompletion = Math.floor(ind.prevCompletion / 1000);
      ind.currCompletion = Math.floor(ind.currCompletion / 1000);
      ind.prevPrimeContract = Math.floor(ind.prevPrimeContract / 1000);
      ind.currPrimeContract = Math.floor(ind.currPrimeContract / 1000);
    }
  }

  // businessYears: 1桁は桁落ちの可能性が高い
  if (data.businessYears >= 1 && data.businessYears <= 9) {
    const hasSignificantRevenue = data.industries.some(
      (ind) => ind.currCompletion > 100_000 || ind.prevCompletion > 100_000,
    );
    if (hasSignificantRevenue) {
      logger.warn(
        `[validateAndCorrectKeishin] businessYears=${data.businessYears} seems too low for a company with significant revenue. Possible OCR digit-dropping.`,
      );
    }
  }

  // 業種コード正規化: "33" → 有効コード外なら除外
  const validCodes = new Set(Array.from({ length: 29 }, (_, i) => String(i + 1).padStart(2, '0')));
  data.industries = data.industries.filter((ind) => {
    const code = ind.code.padStart(2, '0');
    if (!validCodes.has(code)) {
      logger.warn(`Removing invalid industry code: ${ind.code} (${ind.name})`);
      return false;
    }
    ind.code = code;
    return true;
  });

  // 全値0の業種を除外（PDFに行がないのにGeminiが創作した可能性が高い）
  const beforeCount = data.industries.length;
  data.industries = data.industries.filter((ind) => {
    const allZero =
      ind.prevCompletion === 0 &&
      ind.currCompletion === 0 &&
      ind.prevPrimeContract === 0 &&
      ind.currPrimeContract === 0;
    if (allZero) {
      logger.warn(`Removing all-zero industry: ${ind.code} ${ind.name}`);
    }
    return !allZero;
  });
  if (beforeCount !== data.industries.length) {
    logger.info(`[validateAndCorrectKeishin] Filtered ${beforeCount - data.industries.length} all-zero industries (${beforeCount} → ${data.industries.length})`);
  }
}

// ─── JSON パース ヘルパー ───

/**
 * Gemini のレスポンステキストから JSON をパースする。
 * responseMimeType: application/json を指定しているため
 * 通常はそのまま JSON だが、マークダウンコードブロックで
 * 囲まれている場合にも対応する。
 */
function parseJsonResponse<T>(text: string): T | null {
  // そのままパース
  try {
    return JSON.parse(text) as T;
  } catch {
    // fallthrough
  }

  // ```json ... ``` ブロックを抽出
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1]) as T;
    } catch {
      // fallthrough
    }
  }

  // 最初の { から最後の } までを抽出
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1)) as T;
    } catch {
      // fallthrough
    }
  }

  logger.error('Failed to parse Gemini JSON response:', text.slice(0, 500));
  return null;
}

/**
 * Gemini 抽出が利用可能かどうかを判定する。
 * Cloud Run 環境か、GOOGLE_APPLICATION_CREDENTIALS が設定されている場合に true。
 */
export function isGeminiAvailable(): boolean {
  return !!(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    process.env.K_SERVICE
  );
}
