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
import { getAIConfig } from './settings';

// ─── 設定 ───

const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';

// ─── Vertex AI クライアント ───

async function getGenerativeModel() {
  const { VertexAI } = await import('@google-cloud/vertexai');
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    'jww-dxf-converter';

  // DB設定 > 環境変数 > デフォルト の優先順位でモデルを決定
  let modelName = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
  try {
    const aiConfig = await getAIConfig();
    if (aiConfig.model) modelName = aiConfig.model;
  } catch {
    // DB未接続時はフォールバック
  }

  const vertexAI = new VertexAI({
    project: projectId,
    location: VERTEX_LOCATION,
  });

  return vertexAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  });
}

// ─── 決算書抽出 ───

const FINANCIAL_PROMPT = `あなたは日本の建設業の決算書（貸借対照表・損益計算書・完成工事原価報告書）を読み取る専門家です。

このPDFは建設業の決算書です。以下の項目をすべて読み取り、JSON形式で返してください。

## ★最重要: 金額の単位
- **すべての金額を「千円」単位で返してください。**
- PDFの金額が「円」単位（例: 1,668,128,000円）の場合は、**必ず1000で割って**千円に変換してください（例: 1,668,128）。
- PDFの金額が「千円」単位（例: 1,668,128千円）の場合は、そのまま返してください。
- **判断基準**: PDFのヘッダーや欄外に「単位：円」「（円）」と書かれていれば円単位です。「単位：千円」「（千円）」なら千円単位です。
- **典型例**: 中小建設業の売上高は千円単位で数十万〜数百万程度です。1億以上の数値は円単位の可能性が高いです。

## その他ルール
- 数値が読み取れない場合は 0 としてください。
- マイナスの金額は負の数（例: -1234）で返してください。△表記もマイナスです。
- 勘定科目の表記揺れ（例:「売上高」と「完成工事高」）は以下のフィールド名に統一してください。
- totalsの合計値は、PDFに記載されている合計値をそのまま使ってください（自分で計算しないでください）。
- 貸借対照表の「資産合計」と「負債・純資産合計」が一致することを確認してください。

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

    // 単位補正: Geminiが円で返した場合に自動で千円に変換
    autoCorrectUnit(parsed);

    return { data: parsed, method: 'Gemini' };
  } catch (e) {
    console.error('Gemini financial extraction failed:', e);
    return null;
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
function autoCorrectUnit(data: Partial<RawFinancialData>): void {
  const totalAssets = data.bs?.totals?.totalAssets ?? 0;

  // 10,000,000千円 = 100億円を閾値とする
  if (totalAssets < 10_000_000) return;

  console.warn(
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
    for (const key of numKeys) {
      const val = pl[key];
      if (typeof val === 'number') {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (pl as any)[key] = divK(val);
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

// ─── 提出用資料抽出 ───

const KEISHIN_PROMPT = `あなたは日本の建設業の経営事項審査（経審）の提出書類を読み取る専門家です。

このPDFは経営事項審査の提出用資料です。以下の情報をすべて読み取り、JSON形式で返してください。

## ルール
- 金額の単位は「千円」で統一してください。
- 数値が読み取れない場合は 0 としてください。
- 「有」は true、「無」は false としてください。
- 業種コードは2桁の文字列（例: "01", "02"）で返してください。

## ★最重要: 業種別完成工事高の読み取り（別紙一）

別紙一（工事種類別完成工事高・工事種類別元請完成工事高）は表形式で、業種ごとに**異なる数値**が記載されています。

**必ず各業種の行を個別に読み取り、業種ごとに正しい値を返してください。**
- 各業種は独立した行です。全業種が同じ値になることは通常ありません。
- テーブルの列は左から: 業種コード, 業種名, 2年前完工高, 前期完工高, 当期完工高, 合計/平均
- 元請完工高も同様の列構造です。
- **前期（prevCompletion）と当期（currCompletion）は必ず別々の列から読み取ってください。**

### 別紙一の表構造の例:
| コード | 業種名 | 2年前 | 前期 | 当期 |
|--------|--------|-------|------|------|
| 08 | 電気工事 | 950,000 | 1,125,920 | 1,625,600 |
| 11 | 管工事 | 5,200 | 3,370 | 0 |
| 15 | 電気通信工事 | 0 | 27,752 | 0 |
| 24 | 消防施設工事 | 0 | 1,842 | 0 |

上記の例では4業種すべてが**異なる値**です。同じ値が複数業種で繰り返されている場合は、読み取りミスの可能性が高いので再確認してください。

### 業種コード対応表（主要）:
01=土木一式, 02=建築一式, 03=大工, 04=左官, 05=とび・土工・コンクリート,
06=石, 07=屋根, 08=電気, 09=管, 10=タイル・れんが・ブロック,
11=鋼構造物, 12=鉄筋, 13=舗装, 14=しゅんせつ, 15=板金,
16=ガラス, 17=塗装, 18=防水, 19=内装仕上, 20=機械器具設置,
21=熱絶縁, 22=電気通信, 23=造園, 24=さく井, 25=建具,
26=水道施設, 27=消防施設, 28=清掃施設, 29=解体

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
      "name": "業種名（例: 電気工事）",
      "code": "08",
      "prevCompletion": 1125920,
      "currCompletion": 1625600,
      "prevPrimeContract": 443950,
      "currPrimeContract": 933000
    },
    {
      "name": "管工事",
      "code": "09",
      "prevCompletion": 3370,
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
- **別紙一に業種ごとの完成工事高がある（各行の値は業種ごとに異なる）**
- 元請完工高も別紙一の別テーブルにある（完工高とは別の値）
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

PDFの全ページを注意深く読み取り、特に業種別データは各業種の行を個別に正確に読み取って、上記のJSONを返してください。`;

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

    // 業種データの品質チェック: 全業種が同じ値なら読み取りミスの可能性が高い
    if (parsed.industries && parsed.industries.length >= 2) {
      const vals = parsed.industries.map(
        (ind) => `${ind.prevCompletion}-${ind.currCompletion}-${ind.prevPrimeContract}-${ind.currPrimeContract}`
      );
      const allSame = vals.every((v) => v === vals[0]);
      if (allSame && vals[0] !== '0-0-0-0') {
        console.warn(
          'Gemini returned identical values for all industries — likely OCR error. Values:',
          vals[0],
          'Industries:',
          parsed.industries.map((i) => i.name).join(', ')
        );
        // 値をリセットしてユーザーに手入力を促す
        for (const ind of parsed.industries) {
          ind.prevCompletion = 0;
          ind.currCompletion = 0;
          ind.prevPrimeContract = 0;
          ind.currPrimeContract = 0;
        }
      }
    }

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
