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
export function autoCorrectUnit(data: Partial<RawFinancialData>): void {
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

// ─── 提出用資料抽出（マルチパス方式） ───
//
// 20ページの経審PDFを1回で全部読むと情報量が多すぎて読み漏れが発生する。
// セクション別に3つの専用プロンプトで並列抽出し、結果をマージする。

// ── Pass 1: 基本情報 + X2数値 ──
const PROMPT_BASIC = `あなたは日本の建設業の経営事項審査（経審）の提出書類を読み取る専門家です。

このPDFから**基本情報**と**経営状況分析（X2）の数値**だけを読み取ってください。
他のセクション（業種別完成工事高、社会性等W項目）は無視してかまいません。

## 読み取り対象
1. **表紙・総括表** から:
   - 会社名（商号又は名称）
   - 許可番号（例: 大阪府知事 第12345号、国土交通大臣 第12345号）
   - 審査基準日（例: 2024-03-31）
   - 審査対象事業年度（第N期）

2. **続紙・経営状況分析** から:
   - 自己資本額（千円）→ equity
   - 利払前税引前償却前利益（千円）→ ebitda
   - 技術職員数の合計 → techStaffCount
   - 営業年数 → businessYears

## 注意
- 金額は「千円」単位で返してください。PDFに「円」単位で記載されていたら1000で割ってください。
- 数値が見つからない場合は 0 としてください。

## 出力JSON
{
  "companyName": "",
  "permitNumber": "",
  "reviewBaseDate": "",
  "periodNumber": "",
  "equity": 0,
  "ebitda": 0,
  "techStaffCount": 0,
  "businessYears": 0
}`;

// ── Pass 2: 業種別完成工事高（別紙一） ──
const PROMPT_INDUSTRIES = `あなたは日本の建設業の経営事項審査（経審）の提出書類を読み取る専門家です。

このPDFから**別紙一（工事種類別完成工事高・工事種類別元請完成工事高）**だけを読み取ってください。
他のセクション（基本情報、W項目等）は無視してかまいません。

## ★最重要ルール
- 別紙一には2つの表があります:
  1. 「工事種類別完成工事高」 → 完工高（全体）
  2. 「工事種類別元請完成工事高」 → 元請完工高
- **各行の数値は業種ごとに異なります。** 全業種が同じ値になることはありえません。
- テーブルの列構造: 業種コード | 業種名 | 2年前 | 前期 | 当期 | 計/平均
- **前期と当期は必ず別の列から読んでください。**
- 金額は「千円」単位で返してください。

## 業種コード対応表
01=土木一式, 02=建築一式, 03=大工, 04=左官, 05=とび・土工・コンクリート,
06=石, 07=屋根, 08=電気, 09=管, 10=タイル・れんが・ブロック,
11=鋼構造物, 12=鉄筋, 13=舗装, 14=しゅんせつ, 15=板金,
16=ガラス, 17=塗装, 18=防水, 19=内装仕上, 20=機械器具設置,
21=熱絶縁, 22=電気通信, 23=造園, 24=さく井, 25=建具,
26=水道施設, 27=消防施設, 28=清掃施設, 29=解体

## 出力JSON
{
  "industries": [
    {
      "name": "業種名",
      "code": "08",
      "prevCompletion": 0,
      "currCompletion": 0,
      "prevPrimeContract": 0,
      "currPrimeContract": 0
    }
  ]
}

データのある業種だけ返してください（完工高がすべて0の業種は除外してOK）。
各業種の4つの値（前期完工高、当期完工高、前期元請、当期元請）を正確に読み取ってください。`;

// ── Pass 3: W項目（別紙三） ──
const PROMPT_WITEMS = `あなたは日本の建設業の経営事項審査（経審）の提出書類を読み取る専門家です。

このPDFから**別紙三（社会性等 W項目）**だけを読み取ってください。
他のセクション（基本情報、業種別完成工事高等）は無視してかまいません。

## 読み取り対象
別紙三は「その他の審査項目（社会性等）」として以下を記載しています:

### 保険加入状況（有=true / 無=false）
- 雇用保険 → employmentInsurance
- 健康保険 → healthInsurance
- 厚生年金保険 → pensionInsurance

### 労働福祉
- 建設業退職金共済制度 加入 → constructionRetirementMutualAid (true/false)
- 退職一時金制度 or 企業年金制度 導入 → retirementSystem (true/false)
- 法定外労働災害補償制度 加入 → nonStatutoryAccidentInsurance (true/false)

### 技術者・技能者
- 技術職員数合計 → techStaffCount (数値)
- 若年技術職員の継続的な育成及び確保 → youngTechContinuous (true/false)
- 新規若年技術職員の育成及び確保 → youngTechNew (true/false)
- 若年技術職員数 → youngTechCount (数値)
- 新規若年技術職員数 → newYoungTechCount (数値)
- CPD単位合計 → cpdTotalUnits (数値)
- 技能レベル向上者数 → skillLevelUpCount (数値)
- 技能者数（控除対象者含む） → skilledWorkerCount (数値)
- 控除対象者数 → deductionTargetCount (数値)

### ワークライフバランス
- えるぼし認定 → wlbEruboши (0=なし, 1=1段階, 2=2段階, 3=3段階, 4=プラチナ)
- くるみん認定 → wlbKurumin (0=なし, 1=くるみん, 2=トライくるみん, 3=プラチナ)
- ユースエール認定 → wlbYouth (0=なし, 1=あり)

### CCUS
- CCUS活用 → ccusImplementation (0=なし, 1=民間工事, 2=全工事)

### 営業年数・法令遵守
- 営業年数 → businessYears (数値)
- 民事再生法又は会社更生法 → civilRehabilitation (true=適用あり / false=適用なし)
- 防災活動への貢献 → disasterAgreement (true=防災協定あり / false=なし)
- 営業停止処分 → suspensionOrder (true=あり / false=なし)
- 指示処分 → instructionOrder (true=あり / false=なし)

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

## 注意
- 「有」「○」「1」 → true、「無」「×」「0」「空欄」 → false
- チェックボックスの有無を正確に読み取ってください
- 数値が見つからない場合は 0 としてください
- 金額は「千円」単位で返してください

## 出力JSON
{
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
}`;

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
  }>;
}

/**
 * Gemini Vision API で経審提出書 PDF からデータを抽出する（マルチパス方式）
 *
 * 3つの専用プロンプトで並列にGeminiを呼び出し、結果をマージする。
 * 1回で全部読むよりセクションごとに焦点を絞った方が精度が高い。
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

    // 3パス並列実行
    const [basicResult, industriesResult, wItemsResult] = await Promise.allSettled([
      // Pass 1: 基本情報 + X2数値
      model.generateContent({
        contents: [{ role: 'user', parts: [pdfPart, { text: PROMPT_BASIC }] }],
      }),
      // Pass 2: 業種別完成工事高
      model.generateContent({
        contents: [{ role: 'user', parts: [pdfPart, { text: PROMPT_INDUSTRIES }] }],
      }),
      // Pass 3: W項目
      model.generateContent({
        contents: [{ role: 'user', parts: [pdfPart, { text: PROMPT_WITEMS }] }],
      }),
    ]);

    console.log(
      'Keishin multi-pass results:',
      `basic=${basicResult.status}, industries=${industriesResult.status}, wItems=${wItemsResult.status}`
    );

    // 結果をマージ
    const merged: KeishinGeminiResult = {
      basicInfo: { companyName: '', permitNumber: '', reviewBaseDate: '', periodNumber: '' },
      equity: 0,
      ebitda: 0,
      techStaffCount: 0,
      industries: [],
      wItems: {},
      businessYears: 0,
    };

    // Pass 1: 基本情報
    if (basicResult.status === 'fulfilled') {
      const text = basicResult.value.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = parseJsonResponse<PassBasicResult>(text);
      if (parsed) {
        merged.basicInfo.companyName = parsed.companyName || '';
        merged.basicInfo.permitNumber = parsed.permitNumber || '';
        merged.basicInfo.reviewBaseDate = parsed.reviewBaseDate || '';
        merged.basicInfo.periodNumber = parsed.periodNumber || '';
        merged.equity = parsed.equity || 0;
        merged.ebitda = parsed.ebitda || 0;
        merged.techStaffCount = parsed.techStaffCount || 0;
        merged.businessYears = parsed.businessYears || 0;
        console.log('Pass 1 (basic):', JSON.stringify(parsed).slice(0, 300));
      }
    } else {
      console.error('Pass 1 (basic) failed:', basicResult.reason);
    }

    // Pass 2: 業種別完成工事高
    if (industriesResult.status === 'fulfilled') {
      const text = industriesResult.value.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = parseJsonResponse<PassIndustriesResult>(text);
      if (parsed?.industries) {
        merged.industries = parsed.industries;
        console.log(
          'Pass 2 (industries):',
          parsed.industries.map((i) => `${i.name}(${i.code}): prev=${i.prevCompletion} curr=${i.currCompletion}`).join(', ')
        );
      }
    } else {
      console.error('Pass 2 (industries) failed:', industriesResult.reason);
    }

    // Pass 3: W項目
    if (wItemsResult.status === 'fulfilled') {
      const text = wItemsResult.value.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
      const parsed = parseJsonResponse<Partial<SocialItems>>(text);
      if (parsed) {
        merged.wItems = parsed;
        // W項目のtechStaffCountとbusinessYearsがあれば上書き（より正確な可能性）
        if (parsed.techStaffCount && parsed.techStaffCount > 0) {
          merged.techStaffCount = parsed.techStaffCount;
        }
        if (parsed.businessYears && parsed.businessYears > 0) {
          merged.businessYears = parsed.businessYears;
        }
        console.log('Pass 3 (wItems):', JSON.stringify(parsed).slice(0, 500));
      }
    } else {
      console.error('Pass 3 (wItems) failed:', wItemsResult.reason);
    }

    // 業種データの品質チェック: 全業種が同じ値なら読み取りミスの可能性が高い
    if (merged.industries.length >= 2) {
      const vals = merged.industries.map(
        (ind) => `${ind.prevCompletion}-${ind.currCompletion}-${ind.prevPrimeContract}-${ind.currPrimeContract}`
      );
      const allSame = vals.every((v) => v === vals[0]);
      if (allSame && vals[0] !== '0-0-0-0') {
        console.warn(
          'Multi-pass: industries still have identical values — likely OCR error. Resetting.',
          vals[0]
        );
        for (const ind of merged.industries) {
          ind.prevCompletion = 0;
          ind.currCompletion = 0;
          ind.prevPrimeContract = 0;
          ind.currPrimeContract = 0;
        }
      }
    }

    // 最低限のデータが取れたか確認
    const hasAnyData =
      merged.basicInfo.companyName ||
      merged.equity > 0 ||
      merged.industries.length > 0 ||
      Object.keys(merged.wItems).length > 0;

    if (!hasAnyData) {
      console.warn('Multi-pass extraction returned no meaningful data');
      return null;
    }

    return { data: merged, method: 'Gemini (multi-pass)' };
  } catch (e) {
    console.error('Gemini keishin multi-pass extraction failed:', e);
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
