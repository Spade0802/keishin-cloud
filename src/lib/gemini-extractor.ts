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
import { splitPdfPages, getPdfPageCount } from './pdf-page-splitter';
import { calculateTechStaffValues, type ExtractedStaffMember } from './engine/tech-staff-calculator';

// ─── 設定 ───

const VERTEX_LOCATION = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
const DEFAULT_MODEL = 'gemini-2.5-flash';

// ─── GenerativeModel の統一インターフェース ───
//
// Vertex AI SDK と Google AI SDK は微妙にAPIが違うため、
// 共通のインターフェースでラップする。

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
  const aiConfig = await getAIConfig().catch(() => ({
    provider: 'gemini',
    model: DEFAULT_MODEL,
    apiKey: undefined,
  }));

  const modelName =
    aiConfig.model && aiConfig.model.startsWith('gemini')
      ? aiConfig.model
      : DEFAULT_MODEL;

  // ── gemini-paid: Google AI Studio APIキー方式 ──
  if (aiConfig.provider === 'gemini-paid' && aiConfig.apiKey) {
    const { GoogleGenerativeAI } = await import('@google/generative-ai');
    const genAI = new GoogleGenerativeAI(aiConfig.apiKey);
    const model = genAI.getGenerativeModel({
      model: modelName,
      generationConfig: {
        responseMimeType: 'application/json' as const,
        temperature: 0,
      },
    });
    console.log(`Using Gemini Paid API (${modelName})`);
    // Google AI SDK のレスポンスを統一形式に変換
    // 429 (クォータ超過) 時は Vertex AI にフォールバック
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
          const errMsg = err instanceof Error ? err.message : String(err);
          if (errMsg.includes('429') || errMsg.includes('quota') || errMsg.includes('Too Many Requests')) {
            console.warn(`[gemini-paid] Rate limited (429), falling back to Vertex AI: ${errMsg.slice(0, 200)}`);
            // Vertex AI にフォールバック
            const { VertexAI } = await import('@google-cloud/vertexai');
            const projectId = process.env.GOOGLE_CLOUD_PROJECT || process.env.GCLOUD_PROJECT || 'jww-dxf-converter';
            const vertexAI = new VertexAI({ project: projectId, location: VERTEX_LOCATION });
            const vertexModel = vertexAI.getGenerativeModel({
              model: modelName,
              generationConfig: { responseMimeType: 'application/json', temperature: 0 },
            }) as unknown as UnifiedModel;
            console.log(`[gemini-paid→vertex-ai] Retrying with Vertex AI (${modelName})`);
            return vertexModel.generateContent(request);
          }
          throw err;
        }
      },
    };
  }

  // ── gemini (free): Vertex AI 方式 ──
  const { VertexAI } = await import('@google-cloud/vertexai');
  const projectId =
    process.env.GOOGLE_CLOUD_PROJECT ||
    process.env.GCLOUD_PROJECT ||
    'jww-dxf-converter';

  const vertexAI = new VertexAI({
    project: projectId,
    location: VERTEX_LOCATION,
  });

  console.log(`Using Vertex AI (${modelName})`);
  return vertexAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0,
    },
  }) as unknown as UnifiedModel;
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

// ─── ページ別専用プロンプト（決算書） ───

const BS_PAGE_PROMPT = `あなたは日本の建設業の決算書を読み取る専門家です。

このPDFの中から**貸借対照表（BS）のページだけ**に集中して読み取ってください。
損益計算書や原価報告書のページは無視してください。

## ★最重要: 金額の単位
- すべての金額を「千円」単位で返してください。
- PDFが「円」単位なら1000で割ってください。「百万円」単位なら1000を掛けてください。
- 判断基準: ヘッダーや欄外の「単位：円」「（千円）」「（百万円）」等の記載を確認。

## マイナス表記
- △、▲、()（カッコ囲み）、マイナス記号 → すべて負の数で返す。

## 出力JSON
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
      "currentAssets": 0, "tangibleFixed": 0, "intangibleFixed": 0,
      "investments": 0, "fixedAssets": 0, "totalAssets": 0,
      "currentLiabilities": 0, "fixedLiabilities": 0,
      "totalLiabilities": 0, "totalEquity": 0
    }
  }
}

## 各セクションの意味（位置ではなく意味で科目を分類してください）
- **currentAssets（流動資産）**: 「流動資産」の見出しの下にある科目群。現金預金、受取手形、完成工事未収入金（＝売掛金）、未成工事支出金（＝仕掛品）、短期貸付金、前払費用 等。
- **tangibleFixed（有形固定資産）**: 「有形固定資産」の見出しの下にある科目群。建物、構築物、機械装置、車両運搬具、工具器具備品、土地、建設仮勘定 等。
- **intangibleFixed（無形固定資産）**: 「無形固定資産」の見出しの下にある科目群。ソフトウェア、特許権、借地権、電話加入権 等。存在しない会社もある（その場合は空オブジェクト）。
- **investments（投資その他の資産）**: 「投資その他の資産」の見出しの下にある科目群。投資有価証券、長期貸付金、保険積立金、出資金 等。
- **currentLiabilities（流動負債）**: 「流動負債」の見出しの下にある科目群。支払手形、工事未払金（＝買掛金）、短期借入金、未成工事受入金（＝前受金）、未払法人税等 等。
- **fixedLiabilities（固定負債）**: 「固定負債」の見出しの下にある科目群。長期借入金、退職給付引当金、長期未払金 等。
- **equity（純資産）**: 「純資産の部」「株主資本」の見出しの下にある科目群。資本金、資本剰余金、利益剰余金（繰越利益剰余金）等。

## 表記揺れの対応（建設業 → 一般企業）
- 完成工事未収入金 ＝ 売掛金
- 工事未払金 ＝ 買掛金
- 未成工事支出金 ＝ 仕掛品
- 未成工事受入金 ＝ 前受金

## ★クロスバリデーション（必ず確認）
- **totalAssets == totalLiabilities + totalEquity** でなければ読み間違い。再読み取りすること。
- **fixedAssets == tangibleFixed + intangibleFixed + investments**
- totalsはPDFの記載値をそのまま使う（自分で計算しない）
- 数値が読み取れない場合は 0`;

const PL_PAGE_PROMPT = `あなたは日本の建設業の決算書を読み取る専門家です。

このPDFの中から**損益計算書（PL）のページだけ**に集中して読み取ってください。
貸借対照表や原価報告書のページは無視してください。

## ★最重要: 金額の単位
- すべての金額を「千円」単位で返してください。
- PDFが「円」単位なら1000で割ってください。「百万円」単位なら1000を掛けてください。
- 判断基準: ヘッダーや欄外の「単位：円」「（千円）」「（百万円）」等の記載を確認。

## マイナス表記
- △、▲、()（カッコ囲み）、マイナス記号 → すべて負の数で返す。

## 出力JSON
{
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
  }
}

## 勘定科目のセマンティック・マッピング（意味と位置で探してください）

### 売上セクション（PLの最上部）
- **completedConstruction**: 「完成工事高」または「売上高」。PLの一番最初に出てくる収益項目。
- **progressConstruction**: 「兼業事業売上高」「その他の売上高」「不動産事業売上高」。完成工事高の直後にある副次的な売上。存在しない会社もある（その場合は0）。
- **totalSales**: 上記2つの合計行。「売上高合計」と記載されることが多い。

### 原価・粗利セクション
- **costOfSales**: 「完成工事原価」または「売上原価」。売上高のすぐ下に記載される原価の合計。
- **grossProfit**: 「完成工事総利益」または「売上総利益」。totalSales - costOfSales の差額行。

### 販管費セクション
- **sgaItems**: 「販売費及び一般管理費」の見出しの下にある全明細科目。役員報酬、従業員給料、退職金、法定福利費、福利厚生費、修繕維持費、事務用品費、通信交通費、動力用水光熱費、調査研究費、広告宣伝費、貸倒引当金繰入額、交際費、寄付金、地代家賃、減価償却費、租税公課、保険料、雑費 等。
- **sgaTotal**: 販売費及び一般管理費の合計行。
- **operatingProfit**: 「営業利益」。grossProfit - sgaTotal。

### 営業外収益セクション（「営業外収益」の見出しの下）
- **interestIncome**: 「受取利息」。
- **dividendIncome**: 「受取配当金」。
- **miscIncome**: 上記以外の営業外収益（「雑収入」「その他」等）の合計。

### 営業外費用セクション（「営業外費用」の見出しの下）
- **interestExpense**: 「支払利息」「支払利息割引料」。
- **miscExpense**: 上記以外の営業外費用（「雑損失」「その他」等）の合計。

### 経常利益以下
- **ordinaryProfit**: 「経常利益」。営業利益 + 営業外収益 - 営業外費用。
- **specialGain**: 「特別利益」の合計行。
- **specialLoss**: 「特別損失」の合計行。
- **preTaxProfit**: 「税引前当期純利益」「税引前当期利益」。
- **corporateTax**: 「法人税、住民税及び事業税」と「法人税等調整額」を合算した値。
- **netIncome**: 「当期純利益」「当期利益」。PLの最終行の利益。

## 表記揺れの対応表
| 建設業の表記 | 一般企業の表記 |
|---|---|
| 完成工事高 | 売上高 |
| 完成工事原価 | 売上原価 |
| 完成工事総利益 | 売上総利益 |

## ★クロスバリデーション（必ず確認）
- **grossProfit == totalSales - costOfSales** でなければ読み間違い
- **operatingProfit == grossProfit - sgaTotal** でなければ読み間違い
- **totalSales == completedConstruction + progressConstruction**
- 不一致があればPDFを再度確認して正しい値を返すこと
- 数値が読み取れない場合は 0`;

const MFG_PAGE_PROMPT = `あなたは日本の建設業の決算書を読み取る専門家です。

このPDFの中から**完成工事原価報告書のページだけ**に集中して読み取ってください。
また**販売費及び一般管理費の明細**があればそこから減価償却費も読み取ってください。

## ★最重要: 金額の単位
- すべての金額を「千円」単位で返してください。
- PDFが「円」単位なら1000で割ってください。「百万円」単位なら1000を掛けてください。
- 判断基準: ヘッダーや欄外の「単位：円」「（千円）」「（百万円）」等の記載を確認。

## マイナス表記
- △、▲、()（カッコ囲み）、マイナス記号 → すべて負の数で返す。

## 出力JSON
{
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

### 完成工事原価報告書の科目（「完成工事原価報告書」という見出しのページ）
- **materials**: 「材料費」。原価報告書の最初の大項目。建設資材の購入費。
- **labor**: 「労務費」。原価報告書の2番目の大項目。現場作業員の人件費。
- **subcontract**: 「外注費」。原価報告書の3番目の大項目。下請業者・協力業者への支払い。建設業では最大の原価項目であることが多い。
- **expenses**: 「経費」。原価報告書の4番目の大項目。上記3つに含まれないその他の工事原価（動力費、運搬費、機械等経費、設計費、仮設費など）。
- **mfgDepreciation**: 「減価償却費」で、**完成工事原価報告書の「経費」の内訳（内書き）**として記載されるもの。「（うち人件費）」「（うち減価償却費）」のように括弧書きで表示されることが多い。経費の内訳なので、経費の金額には既に含まれている。
- **wipBeginning**: 「期首未成工事支出金」。材料費+労務費+外注費+経費の小計の後に加算される項目。前期からの繰越仕掛品。
- **wipEnding**: 「期末未成工事支出金」。wipBeginningの後に減算される項目。当期末の仕掛品残高。
- **totalCost**: 「完成工事原価」の合計行。= materials + labor + subcontract + expenses + wipBeginning - wipEnding。

### ★重要: 減価償却費の区別（混同しないでください）
- **mfgDepreciation**: 完成工事原価報告書の「経費」の内訳にある減価償却費。工事現場で使用する機械や設備の償却費。
- **sgaDepreciation**: **販売費及び一般管理費の明細**にある減価償却費。本社オフィスの設備等の償却費。損益計算書の販管費セクションに記載される。完成工事原価報告書には記載されない。
- この2つは完全に別の場所に記載されている別の数値です。混同しないでください。

## ★クロスバリデーション（必ず確認）
- **totalCost == materials + labor + subcontract + expenses + wipBeginning - wipEnding** でなければ読み間違い
- mfgDepreciationは経費（expenses）の内訳であり、expensesに既に含まれている金額。mfgDepreciation <= expenses であるべき。
- 不一致があればPDFを再度確認して正しい値を返すこと
- 数値が読み取れない場合は 0`;

/**
 * Gemini Vision API で決算書 PDF からデータを抽出する
 *
 * 改良版: BS / PL / 原価報告書を別々のGeminiインスタンスで並列抽出し、
 * 結果をマージ後にデータ補完を行う。
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

    // ── 3系統の並列抽出を同時実行 ──
    // 1) セクション別プロンプト（BS/PL/原価）: PDF全体にフォーカスプロンプト
    // 2) フルプロンプト: 従来方式（全セクション一括）
    // 3) ページ別抽出: 各ページを個別Geminiで読み取り
    const [bsResult, plResult, mfgResult, fullResult, perPageResult] = await Promise.allSettled([
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: BS_PAGE_PROMPT }] }] }),
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: PL_PAGE_PROMPT }] }] }),
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: MFG_PAGE_PROMPT }] }] }),
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: FINANCIAL_PROMPT }] }] }),
      extractPerPage(model, buffer),
    ]);

    console.log(
      `[Financial PDF] Parallel extraction: BS=${bsResult.status}, PL=${plResult.status}, MFG=${mfgResult.status}, Full=${fullResult.status}, PerPage=${perPageResult.status}`
    );

    // 各セクションの結果をパース
    const bsText = bsResult.status === 'fulfilled'
      ? bsResult.value.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '' : '';
    const plText = plResult.status === 'fulfilled'
      ? plResult.value.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '' : '';
    const mfgText = mfgResult.status === 'fulfilled'
      ? mfgResult.value.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '' : '';
    const fullText = fullResult.status === 'fulfilled'
      ? fullResult.value.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '' : '';
    const perPage = perPageResult.status === 'fulfilled' ? perPageResult.value : null;

    const parsedBs = parseJsonResponse<{ bs?: RawFinancialData['bs'] }>(bsText);
    const parsedPl = parseJsonResponse<{ pl?: RawFinancialData['pl'] }>(plText);
    const parsedMfg = parseJsonResponse<{ manufacturing?: RawFinancialData['manufacturing']; sga?: RawFinancialData['sga'] }>(mfgText);
    const parsedFull = parseJsonResponse<Partial<RawFinancialData>>(fullText);

    if (perPage) {
      console.log(`[Financial PDF] Per-page extraction provided: BS=${!!perPage.bs}, PL=${!!perPage.pl}, MFG=${!!perPage.manufacturing}`);
    }

    // ── 3段階マージ: ページ別 → セクション別 → フル ──
    // ページ別が最も正確（1ページに集中）、セクション別が次、フルが最後
    const merged: Partial<RawFinancialData> = {};

    // BS: ページ別 > セクション別 > フル
    merged.bs = perPage?.bs || parsedBs?.bs || parsedFull?.bs;

    // PL: ページ別 > セクション別 > フル
    merged.pl = perPage?.pl || parsedPl?.pl || parsedFull?.pl;

    // Manufacturing: ページ別 > セクション別 > フル
    merged.manufacturing = perPage?.manufacturing || parsedMfg?.manufacturing || parsedFull?.manufacturing;

    // SGA: ページ別 > セクション別 > フル
    merged.sga = perPage?.sga || parsedMfg?.sga || parsedFull?.sga;

    // フル結果からの補完（全て空の場合のみ）
    if (!merged.bs && parsedFull?.bs) merged.bs = parsedFull.bs;
    if (!merged.pl && parsedFull?.pl) merged.pl = parsedFull.pl;
    if (!merged.manufacturing && parsedFull?.manufacturing) merged.manufacturing = parsedFull.manufacturing;
    if (!merged.sga && parsedFull?.sga) merged.sga = parsedFull.sga;

    // ── コンセンサスクロスチェック ──
    // 複数の抽出結果がある場合、合計値を照合
    const bsSources = [perPage?.bs, parsedBs?.bs, parsedFull?.bs].filter(Boolean) as RawFinancialData['bs'][];
    if (bsSources.length >= 2 && merged.bs) {
      for (let i = 1; i < bsSources.length; i++) {
        crossCheckBsTotals(bsSources[0], bsSources[i], merged);
      }
    }

    const plSources = [perPage?.pl, parsedPl?.pl, parsedFull?.pl].filter(Boolean) as RawFinancialData['pl'][];
    if (plSources.length >= 2 && merged.pl) {
      for (let i = 1; i < plSources.length; i++) {
        crossCheckPlValues(plSources[0], plSources[i], merged);
      }
    }

    if (!merged.bs && !merged.pl && !merged.manufacturing) {
      console.warn('All parallel extractions returned empty');
      return null;
    }

    // 単位補正
    autoCorrectUnit(merged);

    // ── データ補完 ──
    const { enrichFinancialData } = await import('./data-enrichment');
    const enriched = enrichFinancialData(merged);

    if (enriched.warnings.length > 0) {
      console.warn('[Financial enrichment warnings]:', enriched.warnings);
    }

    return {
      data: enriched.data,
      method: 'Gemini (per-section parallel)',
      enrichedFields: enriched.enrichedFields,
    };
  } catch (e) {
    console.error('Gemini financial extraction failed:', e);
    return null;
  }
}

/** BSのtotalsクロスチェック。2つの抽出結果で一致する値を採用 */
function crossCheckBsTotals(
  sectionBs: RawFinancialData['bs'],
  fullBs: RawFinancialData['bs'],
  merged: Partial<RawFinancialData>,
): void {
  if (!sectionBs?.totals || !fullBs?.totals || !merged.bs?.totals) return;
  const keys = ['totalAssets', 'totalLiabilities', 'totalEquity'] as const;
  for (const key of keys) {
    const a = sectionBs.totals[key] ?? 0;
    const b = fullBs.totals[key] ?? 0;
    if (a > 0 && b > 0 && a !== b) {
      // ±5%以内なら平均、大きく異なる場合はセクション別を優先（フォーカスが正確）
      const diff = Math.abs(a - b) / Math.max(a, b);
      if (diff < 0.05) {
        merged.bs!.totals![key] = Math.round((a + b) / 2);
      }
      // else: sectionBs（merged.bs）の値をそのまま使う
      console.log(`[BS crosscheck] ${key}: section=${a}, full=${b}, diff=${(diff * 100).toFixed(1)}%`);
    }
  }
}

/**
 * ページ別並列抽出（決算書PDF）
 *
 * PDFをページごとに分割し、各ページを独立したGeminiインスタンスで
 * 並列読み取りする。ページ数が少ない場合（≤3ページ）は
 * セクション別プロンプトの方が効率的なのでそちらを使う。
 */
async function extractPerPage(
  model: UnifiedModel,
  buffer: Buffer,
): Promise<Partial<RawFinancialData> | null> {
  const pageCount = await getPdfPageCount(buffer);
  console.log(`[Per-page extraction] PDF has ${pageCount} pages`);

  // ページ数が少なすぎる場合はスキップ（セクション別で十分）
  if (pageCount <= 2) return null;

  // ページ数が多すぎる場合は最初の10ページに限定（決算書は通常3-8ページ）
  const maxPages = Math.min(pageCount, 10);

  try {
    const pages = await splitPdfPages(buffer);

    const PER_PAGE_PROMPT = `あなたは日本の建設業の決算書を読み取る専門家です。

このPDFは1ページだけです。このページに含まれる財務情報をすべて読み取ってください。

## ★最重要: 金額の単位
- すべての金額を「千円」単位で返してください。円単位なら1000で割ってください。

## このページが何の書類か判定し、該当するセクションだけ返してください:

### 貸借対照表の場合:
{
  "type": "bs",
  "bs": {
    "currentAssets": { "勘定科目名": 金額, ... },
    "tangibleFixed": { "勘定科目名": 金額, ... },
    "intangibleFixed": { "勘定科目名": 金額, ... },
    "investments": { "勘定科目名": 金額, ... },
    "currentLiabilities": { "勘定科目名": 金額, ... },
    "fixedLiabilities": { "勘定科目名": 金額, ... },
    "equity": { "勘定科目名": 金額, ... },
    "totals": { "currentAssets": 0, "tangibleFixed": 0, "intangibleFixed": 0, "investments": 0, "fixedAssets": 0, "totalAssets": 0, "currentLiabilities": 0, "fixedLiabilities": 0, "totalLiabilities": 0, "totalEquity": 0 }
  }
}

### 損益計算書の場合:
{
  "type": "pl",
  "pl": {
    "completedConstruction": 0, "progressConstruction": 0, "totalSales": 0,
    "costOfSales": 0, "grossProfit": 0,
    "sgaItems": { "勘定科目名": 金額, ... }, "sgaTotal": 0,
    "operatingProfit": 0, "interestIncome": 0, "dividendIncome": 0, "miscIncome": 0,
    "interestExpense": 0, "miscExpense": 0, "ordinaryProfit": 0,
    "specialGain": 0, "specialLoss": 0, "preTaxProfit": 0,
    "corporateTax": 0, "netIncome": 0
  }
}

### 完成工事原価報告書の場合:
{
  "type": "manufacturing",
  "manufacturing": { "materials": 0, "labor": 0, "expenses": 0, "subcontract": 0, "mfgDepreciation": 0, "wipBeginning": 0, "wipEnding": 0, "totalCost": 0 },
  "sga": { "sgaDepreciation": 0 }
}

### 販売費及び一般管理費の明細の場合:
{
  "type": "sga",
  "sgaItems": { "勘定科目名": 金額, ... },
  "sga": { "sgaDepreciation": 0 }
}

### 上記のどれにも該当しない場合:
{ "type": "other" }

注意: マイナスは負の数。△もマイナス。数値が読み取れなければ0。`;

    // 各ページを並列でGeminiに送信
    const pagePromises = pages.slice(0, maxPages).map((pageBuf, idx) =>
      model.generateContent({
        contents: [{
          role: 'user',
          parts: [
            { inlineData: { mimeType: 'application/pdf', data: pageBuf.toString('base64') } },
            { text: PER_PAGE_PROMPT },
          ],
        }],
      }).then(res => {
        const text = res.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
        console.log(`[Per-page] Page ${idx + 1}: ${text.slice(0, 100)}...`);
        return parseJsonResponse<Record<string, unknown>>(text);
      }).catch(err => {
        console.warn(`[Per-page] Page ${idx + 1} failed:`, err);
        return null;
      })
    );

    const pageResults = await Promise.all(pagePromises);

    // ── ページ結果をマージ ──
    const merged: Partial<RawFinancialData> = {};

    for (const result of pageResults) {
      if (!result) continue;
      const type = result.type as string;

      if (type === 'bs' && result.bs) {
        if (!merged.bs) {
          merged.bs = result.bs as RawFinancialData['bs'];
        } else {
          // BSが複数ページにまたがる場合: セクションごとにマージ
          mergeBsSections(merged.bs, result.bs as Partial<RawFinancialData['bs']>);
        }
      }

      if (type === 'pl' && result.pl) {
        if (!merged.pl) {
          merged.pl = result.pl as RawFinancialData['pl'];
        }
      }

      if (type === 'manufacturing' && result.manufacturing) {
        if (!merged.manufacturing) {
          merged.manufacturing = result.manufacturing as RawFinancialData['manufacturing'];
        }
      }

      if ((type === 'manufacturing' || type === 'sga') && result.sga) {
        if (!merged.sga) {
          merged.sga = result.sga as RawFinancialData['sga'];
        }
      }

      // PLページにsgaItemsが含まれている場合
      if (type === 'sga' && result.sgaItems) {
        if (merged.pl && !merged.pl.sgaItems) {
          merged.pl.sgaItems = result.sgaItems as Record<string, number>;
        }
      }
    }

    const hasData = merged.bs || merged.pl || merged.manufacturing;
    return hasData ? merged : null;
  } catch (e) {
    console.warn('[Per-page extraction] Failed:', e);
    return null;
  }
}

/** BSセクションをマージ（複数ページにまたがるBS対応） */
function mergeBsSections(
  target: RawFinancialData['bs'],
  source: Partial<RawFinancialData['bs']>,
): void {
  const sections = [
    'currentAssets', 'tangibleFixed', 'intangibleFixed',
    'investments', 'currentLiabilities', 'fixedLiabilities', 'equity',
  ] as const;

  for (const section of sections) {
    const srcSection = source[section];
    if (!srcSection || typeof srcSection !== 'object') continue;

    if (!target[section] || Object.keys(target[section]).length === 0) {
      (target as Record<string, unknown>)[section] = srcSection;
    } else {
      // 既存セクションにない勘定科目を追加
      const existing = target[section] as Record<string, number>;
      for (const [key, val] of Object.entries(srcSection)) {
        if (!(key in existing) && typeof val === 'number') {
          existing[key] = val;
        }
      }
    }
  }

  // totals: 値がある方を採用
  if (source.totals) {
    if (!target.totals) {
      target.totals = source.totals;
    } else {
      for (const key of Object.keys(source.totals)) {
        const srcVal = (source.totals as Record<string, number>)[key] ?? 0;
        const tgtVal = (target.totals as Record<string, number>)[key] ?? 0;
        if (srcVal > 0 && tgtVal === 0) {
          (target.totals as Record<string, number>)[key] = srcVal;
        }
      }
    }
  }
}

/** PLのクロスチェック */
function crossCheckPlValues(
  sectionPl: RawFinancialData['pl'],
  fullPl: RawFinancialData['pl'],
  merged: Partial<RawFinancialData>,
): void {
  if (!sectionPl || !fullPl || !merged.pl) return;
  const keys = ['totalSales', 'costOfSales', 'operatingProfit', 'ordinaryProfit', 'netIncome'] as const;
  for (const key of keys) {
    const a = (sectionPl[key] as number) ?? 0;
    const b = (fullPl[key] as number) ?? 0;
    if (a > 0 && b > 0 && a !== b) {
      const diff = Math.abs(a - b) / Math.max(a, b);
      if (diff < 0.05) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (merged.pl as any)[key] = Math.round((a + b) / 2);
      }
      console.log(`[PL crosscheck] ${key}: section=${a}, full=${b}, diff=${(diff * 100).toFixed(1)}%`);
    }
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
            console.log(`[Excel Gemini] Enriched ${enriched.enrichedFields.length} fields`);
          }

          return { data: enriched.data, method: 'Gemini (Excel)', warnings };
        }
      }

      warnings.push('Gemini AIでの解析に失敗しました。キーワードマッチにフォールバックします。');
    } catch (e) {
      console.error('Gemini Excel extraction failed:', e);
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
 * 2回並列実行し、合意する値を採用する（コンセンサス方式）。
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

    // 2回並列でコンセンサス抽出
    const [res1, res2] = await Promise.allSettled([
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: RESULT_PDF_PROMPT }] }] }),
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: RESULT_PDF_PROMPT }] }] }),
    ]);

    const text1 = res1.status === 'fulfilled'
      ? res1.value.response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      : '';
    const text2 = res2.status === 'fulfilled'
      ? res2.value.response.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
      : '';

    const parsed1 = parseJsonResponse<ResultPdfScores>(text1);
    const parsed2 = parseJsonResponse<ResultPdfScores>(text2);

    // どちらか1つでも成功すれば使う、両方あればコンセンサス
    const scores = consensusResultScores(parsed1, parsed2);
    if (!scores) {
      console.warn('Gemini result PDF extraction: both parses failed');
      return null;
    }

    console.log('Result PDF Gemini extraction:', JSON.stringify(scores).slice(0, 300));
    return { scores, method: 'Gemini' };
  } catch (e) {
    console.error('Gemini result PDF extraction failed:', e);
    return null;
  }
}

/** 2つのResultPdfScoresからコンセンサスを取る */
function consensusResultScores(
  a: ResultPdfScores | null,
  b: ResultPdfScores | null,
): ResultPdfScores | null {
  if (!a && !b) return null;
  if (!a) return b;
  if (!b) return a;

  // 数値フィールド: 一致すればそちら、不一致ならaを優先
  const pickStr = (v1: string, v2: string) => {
    if (v1 === v2) return v1;
    // 片方が空ならもう片方を採用
    if (!v1) return v2;
    if (!v2) return v1;
    return v1; // 不一致時はa優先
  };

  // 業種: より多く取得できた方をベースに
  const industries = a.industries.length >= b.industries.length ? a.industries : b.industries;

  return {
    label: pickStr(a.label, b.label),
    Y: pickStr(a.Y, b.Y),
    X2: pickStr(a.X2, b.X2),
    X21: pickStr(a.X21, b.X21),
    X22: pickStr(a.X22, b.X22),
    W: pickStr(a.W, b.W),
    industries,
  };
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

## 値の妥当性チェック（読み取り精度向上のためのヒント）
- **自己資本額（equity）**: 通常、数千万〜数十億円（千円単位で数十〜数百万）の範囲です。千円単位で1,000,000,000（=1兆円）を超える場合は、円単位で読んでいる可能性が高いので1000で割ってください。
- **営業年数（businessYears）**: 通常1〜100の範囲の2桁以内の数字です。100を超える場合は読み取りミスの可能性があります。
- **EBITDA（ebitda）**: 利払前税引前償却前利益＝営業利益＋減価償却実施額です。「利払前税引前償却前利益」「EBITDA」等のラベルを探してください。マイナスの値もあり得ます。
- **技術職員数（techStaffCount）**: 通常1〜数百の範囲です。

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
  1. 「工事種類別完成工事高」（上部の表）→ 完工高（全体）
  2. 「工事種類別元請完成工事高」（下部の表）→ 元請完工高
- **各行の数値は業種ごとに異なります。** 全業種が同じ値になることは通常ありません。
- **各業種の値が全て同一の場合、列の読み取りミス（同じ列を繰り返し読んでいる等）の可能性が極めて高いです。その場合はテーブルの列構造を再確認してください。**
- 金額は「千円」単位で返してください。

## ★テーブル列構造の読み取り方（非常に重要）
完成工事高テーブルは通常、業種名 → 2年前 → 前期 → 当期 → 計/平均 の順で並んでいますが、**フォーマットにより列順が異なる場合があります**。以下の手順で正確に判断してください:

1. **まずテーブルのヘッダー行を確認する**: 列見出し（年度表記や「審査対象」「前審査対象」等のラベル）を読み取ってください。
2. **前期と当期を見分けるには、ヘッダーの年度表記**（例: 令和5年、令和6年）を確認してください。新しい年度が「当期」、1年前が「前期」です。
3. **「審査対象事業年度」と書かれた列が当期**、「前審査対象事業年度」が前期です。

### 典型的な完成工事高テーブル列構造:
| 列1 | 列2 | 列3 | 列4 | 列5 | 列6 |
|-----|-----|-----|-----|-----|-----|
| 業種コード | 業種名 | 2年前の完工高 | **前期の完工高** | **当期の完工高** | 計又は平均 |

- prevCompletion = 前期の列（通常は列4）
- currCompletion = 当期の列（通常は列5）
- **2年前の列をprevCompletionと間違えないでください！**

### 元請完成工事高テーブル（同じ列構造）:
- prevPrimeContract = 前期の列
- currPrimeContract = 当期の列

## ★数値の読み取り注意
- **当期の完工高は前期より大きいとは限りません。** 工事量が減少すれば当期 < 前期は普通にあり得ます。数値の大小で前期・当期を推測せず、ヘッダーの年度表記から判断してください。
- 数値をそのまま正確に読み取ってください。四捨五入や推測は不要です。

## ★漏れなく読み取る（ただしPDFに実際に存在する業種のみ）
- **別紙一のテーブルに実際にデータ行として記載されている業種だけを返してください。**
- PDFに行が存在しない業種を追加・創作しないでください。通常、会社が許可を持つ業種は数種類（2～10程度）です。
- ただし、PDFに行があるが値が全て0の業種は含めてください（行が存在する＝許可業種）。
- 完工高テーブルと元請完工高テーブルの両方をチェックし、片方にしか記載がない業種も含めてください。
- 表のヘッダー行や合計行は除外してください。

## 業種コード対応表
01=土木一式, 02=建築一式, 03=大工, 04=左官, 05=とび・土工・コンクリート,
06=石, 07=屋根, 08=電気, 09=管, 10=タイル・れんが・ブロック,
11=鋼構造物, 12=鉄筋, 13=舗装, 14=しゅんせつ, 15=板金,
16=ガラス, 17=塗装, 18=防水, 19=内装仕上, 20=機械器具設置,
21=熱絶縁, 22=電気通信, 23=造園, 24=さく井, 25=建具,
26=水道施設, 27=消防施設, 28=清掃施設, 29=解体

## ★技術職員数値の読み取り
- PDFの**総括表**や**別紙二（技術職員名簿）の業種別集計欄**に、各業種の「技術職員数値」（Z1計算に使う点数）が記載されています。
- 総括表では業種ごとに「技術職員数値」欄があります。
- 別紙二では技術職員名簿の業種別の合計点数として記載されています。
- この値は各業種ごとに異なります。見つかった場合は techStaffValue に設定してください。
- 見つからない場合は 0 としてください。

## 出力JSON
{
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
  ]
}

**PDFの別紙一テーブルに実際にデータ行がある業種だけを返してください。PDFに存在しない業種は絶対に追加しないでください。**
各業種の4つの値（前期完工高、当期完工高、前期元請、当期元請）と技術職員数値を正確に読み取ってください。`;

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

#### ★★★ 営業年数の読み取り（最重要） ★★★
- 営業年数は通常2桁（10〜60年程度）です。1桁（1〜9年）は極めて稀です。
- 固定帳票では各桁が別のマス目に入っています。
- 必ず全てのマス目を左から右へ読んで連結してください。
- 例: [5][7] → 57年、[3][5] → 35年
- 1桁に見える場合は、隣のマスが空でないか再確認してください。
- 初回許可年月日から審査基準日までの年数と大きくずれていないか確認してください。

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
- チェックボックス・選択肢の読み取りルール:
  - true として扱う: ✓、○、レ、1、有、チェック済み
  - false として扱う: 空欄、×、0、無、チェックなし
  - 判断に迷う場合はfalseとしてください
- 数値が手書きの場合、0と6、1と7の見間違いに注意してください。文脈（他の数値との整合性）も考慮して判断してください。
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
 * 技術職員名簿をページ分割で高精度抽出する
 *
 * 戦略:
 * 1. まずPDF全体で「別紙二はどのページか」を特定するGeminiコールを実行
 * 2. 該当ページだけを分割してGeminiに送信
 * 3. フォールバック: PDF全体にPROMPT_TECH_STAFFを適用
 */
async function extractTechStaffWithPageSplit(
  model: UnifiedModel,
  buffer: Buffer,
  fullPdfPart: { inlineData: { mimeType: string; data: string } },
): Promise<PassTechStaffResult | null> {
  try {
    const pageCount = await getPdfPageCount(buffer);

    // ページ数が少ない場合（≤3ページ）はPDF全体で十分
    if (pageCount <= 3) {
      return await callTechStaffGemini(model, fullPdfPart);
    }

    // ── ページ特定 + 全体フォールバックを並列 ──
    // 全ページを分割して各ページに「技術職員名簿か？」を聞く（軽量プロンプト）
    const pages = await splitPdfPages(buffer);

    const PAGE_DETECT_PROMPT = `このPDFページは「技術職員名簿」（別紙二）ですか？
技術職員名簿は、氏名・生年月日・有資格区分・業種コードなどが表形式で並んでいる名簿です。
回答は "yes" か "no" の1単語だけ返してください。`;

    // 各ページを並列判定（最大10ページ）
    const detectPromises = pages.slice(0, Math.min(pageCount, 10)).map(async (pageBuf, idx) => {
      try {
        const res = await model.generateContent({
          contents: [{
            role: 'user',
            parts: [
              { inlineData: { mimeType: 'application/pdf', data: pageBuf.toString('base64') } },
              { text: PAGE_DETECT_PROMPT },
            ],
          }],
        });
        const text = res.response.candidates?.[0]?.content?.parts?.[0]?.text?.toLowerCase() ?? '';
        const isStaffPage = text.includes('yes');
        if (isStaffPage) console.log(`[Tech Staff] Page ${idx + 1} detected as 別紙二`);
        return { idx, isStaffPage, buffer: pageBuf };
      } catch {
        return { idx, isStaffPage: false, buffer: pageBuf };
      }
    });

    // 全体フォールバックも並列で
    const [pageDetections, fullFallback] = await Promise.all([
      Promise.all(detectPromises),
      callTechStaffGemini(model, fullPdfPart),
    ]);

    // 別紙二ページが見つかった場合、そのページだけでGeminiを呼ぶ
    const staffPages = pageDetections.filter(p => p.isStaffPage);

    if (staffPages.length > 0) {
      console.log(`[Tech Staff] Found ${staffPages.length} 別紙二 pages: ${staffPages.map(p => p.idx + 1).join(', ')}`);

      // 別紙二ページだけを結合したPDFを作成
      const { PDFDocument } = await import('pdf-lib');
      const srcDoc = await PDFDocument.load(buffer);
      const staffDoc = await PDFDocument.create();
      const indices = staffPages.map(p => p.idx);
      const copiedPages = await staffDoc.copyPages(srcDoc, indices);
      for (const page of copiedPages) staffDoc.addPage(page);
      const staffBuf = Buffer.from(await staffDoc.save());

      const staffPart = {
        inlineData: { mimeType: 'application/pdf', data: staffBuf.toString('base64') },
      };

      const perPageResult = await callTechStaffGemini(model, staffPart);

      // ページ分割結果が良ければそちらを使う、なければフォールバック
      if (perPageResult && perPageResult.staffList?.length > 0) {
        console.log(`[Tech Staff] Per-page extraction: ${perPageResult.staffList.length} staff, ${Object.keys(perPageResult.industryTotals || {}).length} industries`);
        return perPageResult;
      }
    }

    // フォールバック: PDF全体の結果を使う
    if (fullFallback && fullFallback.staffList?.length > 0) {
      console.log(`[Tech Staff] Using full-PDF fallback: ${fullFallback.staffList.length} staff`);
    }
    return fullFallback;
  } catch (e) {
    console.warn('[Tech Staff] extractTechStaffWithPageSplit failed:', e);
    // 最終フォールバック: PDF全体で直接実行
    try {
      return await callTechStaffGemini(model, fullPdfPart);
    } catch {
      return null;
    }
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
      console.warn('[Tech Staff] No staff list extracted from PDF');
      return null;
    }

    console.log(`[Tech Staff] Extracted ${rawData.staffList.length} raw staff entries from PDF`);

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

    console.log(`[Tech Staff] Calculated industryTotals:`, JSON.stringify(calcResult.industryTotals));

    // バリデーション: techStaffValueが異常に大きくないか
    for (const [code, val] of Object.entries(calcResult.industryTotals)) {
      if (val > 500) {
        console.warn(`[Tech Staff] Suspicious value for industry ${code}: ${val}, capping at 500`);
        calcResult.industryTotals[code] = Math.min(val, 500);
      }
    }

    return {
      staffList: extractedStaff,
      industryTotals: calcResult.industryTotals,
      totalStaffCount: calcResult.totalStaffCount,
    };
  } catch (e) {
    console.warn('[Tech Staff] callTechStaffGemini failed:', e);
    return null;
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

// ── ヘルパー: Gemini 呼び出し結果からテキスト取得 ──
function extractText(
  result: PromiseSettledResult<{ response: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> } }>,
): string {
  if (result.status !== 'fulfilled') return '';
  return result.value.response.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

// ── ヘルパー: 2つの業種抽出結果から合意値を選択 ──
function consensusIndustries(
  a: PassIndustriesResult | null,
  b: PassIndustriesResult | null,
): PassIndustriesResult['industries'] {
  if (!a?.industries?.length && !b?.industries?.length) return [];
  if (!a?.industries?.length) return b!.industries;
  if (!b?.industries?.length) return a.industries;

  // 両方ある場合: 業種数が大幅に異なる場合（例: 4 vs 29）は少ない方が正確
  // （多い方はGeminiが全29業種を創作した可能性が高い）
  // 差が小さい場合（±3以内）は多い方をベースにする
  const diff = Math.abs(a.industries.length - b.industries.length);
  let base: PassIndustriesResult['industries'];
  let other: PassIndustriesResult['industries'];
  if (diff > 3) {
    // 大幅差 → 少ない方が信頼できる
    base = a.industries.length <= b.industries.length ? a.industries : b.industries;
    other = a.industries.length <= b.industries.length ? b.industries : a.industries;
    console.log(`[consensusIndustries] Large count diff (${a.industries.length} vs ${b.industries.length}), using shorter list as base`);
  } else {
    base = a.industries.length >= b.industries.length ? a.industries : b.industries;
    other = a.industries.length >= b.industries.length ? b.industries : a.industries;
  }

  // codeでマッチング
  const otherMap = new Map(other.map((i) => [i.code, i]));

  return base.map((ind) => {
    const match = otherMap.get(ind.code);
    if (!match) return ind;

    // 両方の値が一致（±10%以内）なら信頼度高 → そのまま
    // 不一致なら大きい方を採用（列ずれの場合小さい方は2年前の値の可能性）
    return {
      name: ind.name,
      code: ind.code,
      prevCompletion: pickConsensus(ind.prevCompletion, match.prevCompletion),
      currCompletion: pickConsensus(ind.currCompletion, match.currCompletion),
      prevPrimeContract: pickConsensus(ind.prevPrimeContract, match.prevPrimeContract),
      currPrimeContract: pickConsensus(ind.currPrimeContract, match.currPrimeContract),
      techStaffValue: pickConsensus(ind.techStaffValue ?? 0, match.techStaffValue ?? 0),
    };
  });
}

/** 2つの値から合意値を選ぶ。一致なら確定、不一致なら両方ログして大きい方 */
function pickConsensus(a: number, b: number): number {
  if (a === b) return a;
  // ±10%以内なら平均
  if (a > 0 && b > 0 && Math.abs(a - b) / Math.max(a, b) < 0.1) {
    return Math.round((a + b) / 2);
  }
  // 片方が0なら非0を採用
  if (a === 0) return b;
  if (b === 0) return a;
  // 大幅に異なる場合は大きい方（列ずれで2年前の小さい値を拾っている可能性）
  return Math.max(a, b);
}

/** 2つの基本情報結果から合意値を選ぶ */
function consensusBasic(
  a: PassBasicResult | null,
  b: PassBasicResult | null,
): PassBasicResult | null {
  if (!a) return b;
  if (!b) return a;
  return {
    companyName: a.companyName || b.companyName,
    permitNumber: a.permitNumber || b.permitNumber,
    reviewBaseDate: a.reviewBaseDate || b.reviewBaseDate,
    periodNumber: a.periodNumber || b.periodNumber,
    equity: pickConsensus(a.equity, b.equity),
    ebitda: pickConsensus(a.ebitda, b.ebitda),
    techStaffCount: pickConsensus(a.techStaffCount, b.techStaffCount),
    businessYears: pickConsensus(a.businessYears, b.businessYears),
  };
}

/**
 * Gemini Vision API で経審提出書 PDF からデータを抽出する（多数決方式）
 *
 * 基本情報と業種を2回ずつ並列抽出し、合意する値を採用。
 * W項目は1回で十分（boolean主体で安定している）。
 * 最後に検証パスで照合。
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

    // ── 6パス並列実行（基本×2, 業種×2, W項目×1, 技術職員×1）──
    // 技術職員パスにはページ分割した別紙二を送る（精度向上）
    const techStaffPromise = extractTechStaffWithPageSplit(model, buffer, pdfPart);

    const [basic1, basic2, ind1, ind2, wResult, techStaffResult] = await Promise.allSettled([
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: PROMPT_BASIC }] }] }),
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: PROMPT_BASIC }] }] }),
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: PROMPT_INDUSTRIES }] }] }),
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: PROMPT_INDUSTRIES }] }] }),
      model.generateContent({ contents: [{ role: 'user', parts: [pdfPart, { text: PROMPT_WITEMS }] }] }),
      techStaffPromise,
    ]);

    console.log(
      'Keishin consensus extraction:',
      `basic1=${basic1.status}, basic2=${basic2.status}, ind1=${ind1.status}, ind2=${ind2.status}, wItems=${wResult.status}, techStaff=${techStaffResult.status}`
    );

    // ── 基本情報: 2回の合意 ──
    const parsedBasic1 = parseJsonResponse<PassBasicResult>(extractText(basic1));
    const parsedBasic2 = parseJsonResponse<PassBasicResult>(extractText(basic2));
    const basicConsensus = consensusBasic(parsedBasic1, parsedBasic2);

    console.log('Basic A:', JSON.stringify(parsedBasic1).slice(0, 200));
    console.log('Basic B:', JSON.stringify(parsedBasic2).slice(0, 200));

    // ── 業種: 2回の合意 ──
    const parsedInd1 = parseJsonResponse<PassIndustriesResult>(extractText(ind1));
    const parsedInd2 = parseJsonResponse<PassIndustriesResult>(extractText(ind2));
    const industriesConsensus = consensusIndustries(parsedInd1, parsedInd2);

    console.log(
      'Industries A:',
      parsedInd1?.industries?.map((i) => `${i.name}(${i.code}):p=${i.prevCompletion},c=${i.currCompletion}`).join(', ') || 'null'
    );
    console.log(
      'Industries B:',
      parsedInd2?.industries?.map((i) => `${i.name}(${i.code}):p=${i.prevCompletion},c=${i.currCompletion}`).join(', ') || 'null'
    );
    console.log(
      'Industries consensus:',
      industriesConsensus.map((i) => `${i.name}(${i.code}):p=${i.prevCompletion},c=${i.currCompletion}`).join(', ')
    );

    // ── マージ ──
    const merged: KeishinGeminiResult = {
      basicInfo: { companyName: '', permitNumber: '', reviewBaseDate: '', periodNumber: '' },
      equity: 0,
      ebitda: 0,
      techStaffCount: 0,
      industries: industriesConsensus,
      wItems: {},
      businessYears: 0,
    };

    if (basicConsensus) {
      merged.basicInfo.companyName = basicConsensus.companyName || '';
      merged.basicInfo.permitNumber = basicConsensus.permitNumber || '';
      merged.basicInfo.reviewBaseDate = basicConsensus.reviewBaseDate || '';
      merged.basicInfo.periodNumber = basicConsensus.periodNumber || '';
      merged.equity = basicConsensus.equity || 0;
      merged.ebitda = basicConsensus.ebitda || 0;
      merged.techStaffCount = basicConsensus.techStaffCount || 0;
      merged.businessYears = basicConsensus.businessYears || 0;
    }

    // W項目
    const parsedW = parseJsonResponse<Partial<SocialItems>>(extractText(wResult));
    if (parsedW) {
      merged.wItems = parsedW;
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
      console.log('[Tech Staff] industryTotals:', JSON.stringify(parsedTechStaff.industryTotals));
      console.log('[Tech Staff] staffList:', parsedTechStaff.staffList?.length, 'entries');

      // 各業種のtechStaffValueを設定
      for (const ind of merged.industries) {
        const code = ind.code.padStart(2, '0');
        const techVal = parsedTechStaff.industryTotals[code] || parsedTechStaff.industryTotals[ind.code];
        if (techVal && techVal > 0) {
          if (!ind.techStaffValue || ind.techStaffValue === 0) {
            ind.techStaffValue = techVal;
            console.log(`[Tech Staff] Set ${ind.name}(${ind.code}) techStaffValue = ${techVal}`);
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
        console.log(`[Tech Staff] Preserved ${parsedTechStaff.staffList.length} staff entries for TechStaffPanel`);
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
        console.log('Verification:', JSON.stringify(verified).slice(0, 500));

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
      console.warn('Verification pass failed, using consensus data:', e);
    }

    // 業種品質チェック
    if (merged.industries.length >= 2) {
      const vals = merged.industries.map(
        (ind) => `${ind.prevCompletion}-${ind.currCompletion}-${ind.prevPrimeContract}-${ind.currPrimeContract}`
      );
      const allSame = vals.every((v) => v === vals[0]);
      if (allSame && vals[0] !== '0-0-0-0') {
        console.warn('Industries identical after consensus. Resetting.');
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
      console.warn('Consensus extraction returned no meaningful data');
      return null;
    }

    // ── データ補完 ──
    const { enrichKeishinData } = await import('./data-enrichment');
    const enrichResult = enrichKeishinData(merged);
    if (enrichResult.warnings.length > 0) {
      console.warn('[Keishin enrichment warnings]:', enrichResult.warnings);
    }

    return { data: merged, method: 'Gemini (consensus)' };
  } catch (e) {
    console.error('Gemini keishin consensus extraction failed:', e);
    return null;
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
    console.warn(`Keishin equity=${data.equity} looks like yen, dividing by 1000`);
    data.equity = Math.floor(data.equity / 1000);
  }
  // ebitda も同様
  if (Math.abs(data.ebitda) > 1_000_000_000) {
    console.warn(`Keishin ebitda=${data.ebitda} looks like yen, dividing by 1000`);
    data.ebitda = Math.floor(data.ebitda / 1000);
  }

  // 業種の完工高も: 1億千円（= 1000億円）超は円の可能性
  for (const ind of data.industries) {
    if (ind.prevCompletion > 100_000_000 || ind.currCompletion > 100_000_000) {
      console.warn(`Industry ${ind.name}: values look like yen, dividing by 1000`);
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
      console.warn(
        `[validateAndCorrectKeishin] businessYears=${data.businessYears} seems too low for a company with significant revenue. Possible OCR digit-dropping.`,
      );
    }
  }

  // 業種コード正規化: "33" → 有効コード外なら除外
  const validCodes = new Set(Array.from({ length: 29 }, (_, i) => String(i + 1).padStart(2, '0')));
  data.industries = data.industries.filter((ind) => {
    const code = ind.code.padStart(2, '0');
    if (!validCodes.has(code)) {
      console.warn(`Removing invalid industry code: ${ind.code} (${ind.name})`);
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
      console.warn(`Removing all-zero industry: ${ind.code} ${ind.name}`);
    }
    return !allZero;
  });
  if (beforeCount !== data.industries.length) {
    console.log(`[validateAndCorrectKeishin] Filtered ${beforeCount - data.industries.length} all-zero industries (${beforeCount} → ${data.industries.length})`);
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
