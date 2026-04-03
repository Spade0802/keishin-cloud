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

// ─── 設定 ───

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';

// ─── Vertex AI クライアント ───

async function getGenerativeModel() {
  const { VertexAI } = await import('@google-cloud/vertexai');
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    'jww-dxf-converter';

  const vertexAI = new VertexAI({
    project: projectId,
    location: VERTEX_LOCATION,
  });

  return vertexAI.getGenerativeModel({
    model: GEMINI_MODEL,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  });
}

// ─── 決算書抽出 ───

const FINANCIAL_PROMPT = `あなたは日本の建設業の決算書（貸借対照表・損益計算書・完成工事原価報告書）を読み取る専門家です。

このPDFは建設業の決算書です。以下の項目をすべて読み取り、JSON形式で返してください。

## ルール
- 金額の単位は「千円」で統一してください。PDF上の金額が「円」単位の場合は1000で割って千円に変換してください。
- 数値が読み取れない場合は 0 としてください。
- マイナスの金額は負の数（例: -1234）で返してください。△表記もマイナスです。
- 勘定科目の表記揺れ（例:「売上高」と「完成工事高」）は以下のフィールド名に統一してください。

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

PDFの全ページを読み取り、上記のJSONを返してください。`;

/**
 * Gemini Vision API で決算書 PDF からデータを抽出する
 */
export async function extractFinancialDataWithGemini(
  buffer: Buffer,
): Promise<{ data: Partial<RawFinancialData>; method: string } | null> {
  try {
    const model = await getGenerativeModel();

    const pdfPart = {
      inlineData: {
        mimeType: 'application/pdf' as const,
        data: buffer.toString('base64'),
      },
    };

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [pdfPart, { text: FINANCIAL_PROMPT }],
        },
      ],
    });

    const response = result.response;
    const text =
      response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!text) {
      console.warn('Gemini returned empty response for financial PDF');
      return null;
    }

    const parsed = parseJsonResponse<Partial<RawFinancialData>>(text);
    if (!parsed) return null;

    return { data: parsed, method: 'Gemini' };
  } catch (e) {
    console.error('Gemini financial extraction failed:', e);
    return null;
  }
}

// ─── 提出用資料抽出 ───

const KEISHIN_PROMPT = `あなたは日本の建設業の経営事項審査（経審）の提出書類を読み取る専門家です。

このPDFは経営事項審査の提出用資料です。以下の情報をすべて読み取り、JSON形式で返してください。

## ルール
- 金額の単位は「千円」で統一してください。
- 数値が読み取れない場合は 0 としてください。
- 「有」は true、「無」は false としてください。
- 業種コードは2桁の文字列（例: "01", "02"）で返してください。

## 出力JSON形式

{
  "basicInfo": {
    "companyName": "会社名",
    "permitNumber": "許可番号（例: 大阪府知事 第12345号）",
    "reviewBaseDate": "審査基準日（例: 2024-03-31）",
    "periodNumber": "審査対象事業年度（第N期）"
  },
  "equity": 0,
  "ebitda": 0,
  "techStaffCount": 0,
  "industries": [
    {
      "name": "業種名（例: 土木一式工事）",
      "code": "業種コード（例: 01）",
      "prevCompletion": 0,
      "currCompletion": 0,
      "prevPrimeContract": 0,
      "currPrimeContract": 0
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
    "wlbEruboши": 0,
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
  },
  "businessYears": 0
}

## 読み取りヒント
- 「自己資本額」→ equity（千円）
- 「利払前税引前償却前利益」→ ebitda（千円）
- 「技術職員数」→ techStaffCount
- 別紙一に業種ごとの完成工事高がある
- 別紙三に社会性等（W項目）がある
- 「雇用保険」「健康保険」「厚生年金保険」の加入有無
- 「建設業退職金共済」の加入有無
- 「退職一時金 or 企業年金」の導入有無
- 「法定外労働災害補償」の加入有無
- 「営業年数」→ businessYears
- 「監査の受審状況」→ auditStatus (0=なし, 1=会計参与, 2=会計監査人)
- 「防災活動への貢献の状況」→ disasterAgreement
- 「法令遵守の状況」→ suspensionOrder / instructionOrder
- 「ISO 9001」「ISO 14001」「エコアクション21」の認証取得有無

PDFの全ページを読み取り、上記のJSONを返してください。`;

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
  }>;
  wItems: Partial<SocialItems>;
  businessYears: number;
}

/**
 * Gemini Vision API で経審提出書 PDF からデータを抽出する
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

    const result = await model.generateContent({
      contents: [
        {
          role: 'user',
          parts: [pdfPart, { text: KEISHIN_PROMPT }],
        },
      ],
    });

    const response = result.response;
    const text =
      response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    if (!text) {
      console.warn('Gemini returned empty response for keishin PDF');
      return null;
    }

    const parsed = parseJsonResponse<KeishinGeminiResult>(text);
    if (!parsed) return null;

    return { data: parsed, method: 'Gemini' };
  } catch (e) {
    console.error('Gemini keishin extraction failed:', e);
    return null;
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

  console.error('Failed to parse Gemini JSON response:', text.slice(0, 500));
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
