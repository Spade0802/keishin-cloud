/**
 * 共通 Gemini モデルファクトリ
 *
 * GoogleGenerativeAI (有料APIキー) → Vertex AI (無料) のフォールバックを
 * 一箇所に集約する。モデルインスタンスはキャッシュされる。
 */

import { getAIConfig } from './settings';

const PROJECT =
  process.env.GOOGLE_CLOUD_PROJECT ||
  process.env.GCLOUD_PROJECT ||
  'jww-dxf-converter';
const LOCATION = process.env.VERTEX_AI_LOCATION || 'asia-northeast1';
const DEFAULT_MODEL = 'gemini-2.5-flash';

// ── キャッシュ ──

type CachedModelEntry = {
  provider: string;
  apiKey: string | undefined;
  modelName: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
};

let cachedGeminiPaid: CachedModelEntry | null = null;
let cachedVertexAI: CachedModelEntry | null = null;

// ── ファクトリ関数（内部） ──

function getGeminiPaidModel(apiKey: string, modelName: string) {
  if (
    cachedGeminiPaid &&
    cachedGeminiPaid.apiKey === apiKey &&
    cachedGeminiPaid.modelName === modelName
  ) {
    return cachedGeminiPaid.model;
  }
  const { GoogleGenerativeAI } = require('@google/generative-ai');
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      responseMimeType: 'application/json' as const,
      temperature: 0.3,
      maxOutputTokens: 65536,
    },
  });
  cachedGeminiPaid = { provider: 'gemini-paid', apiKey, modelName, model };
  return model;
}

function getVertexAIModel(modelName: string) {
  if (cachedVertexAI && cachedVertexAI.modelName === modelName) {
    return cachedVertexAI.model;
  }
  const { VertexAI } = require('@google-cloud/vertexai');
  const vertexAI = new VertexAI({ project: PROJECT, location: LOCATION });
  const model = vertexAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 65536,
      responseMimeType: 'application/json',
    },
  });
  cachedVertexAI = { provider: 'vertex', apiKey: undefined, modelName, model };
  return model;
}

// ── 公開 API ──

export interface GeminiModelResult {
  provider: 'gemini-paid' | 'vertex';
  modelName: string;
  /** Gemini Paid のモデル。429 時は getVertexModel() でフォールバック可能 */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  model: any;
  /** Vertex AI のモデルを取得（フォールバック用） */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  getVertexModel: () => any;
}

/**
 * AI設定に基づいて Gemini モデルを取得する。
 * gemini-paid + apiKey があれば Google AI Studio を、なければ Vertex AI を返す。
 */
export async function getGeminiModel(): Promise<GeminiModelResult> {
  const aiConfig = await getAIConfig();
  const modelName =
    aiConfig.model && aiConfig.model.startsWith('gemini')
      ? aiConfig.model
      : DEFAULT_MODEL;

  if (aiConfig.provider === 'gemini-paid' && aiConfig.apiKey) {
    const model = getGeminiPaidModel(aiConfig.apiKey, modelName);
    return {
      provider: 'gemini-paid',
      modelName,
      model,
      getVertexModel: () => getVertexAIModel(modelName),
    };
  }

  const model = getVertexAIModel(modelName);
  return {
    provider: 'vertex',
    modelName,
    model,
    getVertexModel: () => model,
  };
}

/**
 * 429 / quota エラーかどうかを判定するヘルパー
 */
export function isRateLimitError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes('429') ||
    msg.includes('quota') ||
    msg.includes('Too Many Requests')
  );
}
