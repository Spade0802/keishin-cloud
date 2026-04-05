/**
 * Stripe SDK 初期化 & ユーティリティ
 *
 * テストモード: STRIPE_SECRET_KEY が sk_test_ で始まる場合、
 * または BYPASS_BILLING=true の場合は課金チェックをスキップする。
 */
import Stripe from 'stripe';
import { logger } from '@/lib/logger';

if (!process.env.STRIPE_SECRET_KEY) {
  logger.warn('[Stripe] STRIPE_SECRET_KEY is not set. Billing features will be bypassed.');
}

export const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: '2025-03-31.basil' })
  : null;

/** テスト/開発環境では課金チェックをバイパスする（明示的な BYPASS_BILLING=true のみ） */
export function isBillingBypassed(): boolean {
  if (process.env.BYPASS_BILLING === 'true') return true;
  if (!process.env.STRIPE_SECRET_KEY) {
    logger.error('[Stripe] STRIPE_SECRET_KEY is not set and BYPASS_BILLING is not true. Billing will NOT be bypassed.');
    return false;
  }
  return false;
}

/** Stripe テストモードかどうか */
export function isStripeTestMode(): boolean {
  return process.env.STRIPE_SECRET_KEY?.startsWith('sk_test_') ?? true;
}

// ─── プラン定義 ───

export interface PlanConfig {
  id: string;
  name: string;
  nameJa: string;
  description: string;
  priceMonthly: number; // 円
  priceYearly: number;  // 円
  features: string[];
  limits: {
    companies: number;
    simulationsPerMonth: number;
    aiAnalysisPerMonth: number;
    excelExport: boolean;
    pdfExport: boolean;
    comparison: boolean;
    reclassification: boolean;
  };
}

export const PLANS: Record<string, PlanConfig> = {
  free: {
    id: 'free',
    name: 'Free',
    nameJa: '無料プラン',
    description: '基本機能をお試しいただけます',
    priceMonthly: 0,
    priceYearly: 0,
    features: [
      'P点シミュレーション（月3回）',
      '企業1社登録',
      '基本的なスコア計算',
    ],
    limits: {
      companies: 1,
      simulationsPerMonth: 3,
      aiAnalysisPerMonth: 0,
      excelExport: false,
      pdfExport: false,
      comparison: false,
      reclassification: false,
    },
  },
  standard: {
    id: 'standard',
    name: 'Standard',
    nameJa: 'スタンダード',
    description: '行政書士・中小建設業向け',
    priceMonthly: 9800,
    priceYearly: 100000, // 年額10万円（2ヶ月分お得）
    features: [
      'P点シミュレーション無制限',
      '企業10社まで登録',
      'AI分析（月10回）',
      'Excel/PDFエクスポート',
      '期間比較',
      '再分類シミュレーション',
      'メールサポート',
    ],
    limits: {
      companies: 10,
      simulationsPerMonth: -1, // unlimited
      aiAnalysisPerMonth: 10,
      excelExport: true,
      pdfExport: true,
      comparison: true,
      reclassification: true,
    },
  },
  premium: {
    id: 'premium',
    name: 'Premium',
    nameJa: 'プレミアム',
    description: '大規模事務所・コンサルタント向け',
    priceMonthly: 29800,
    priceYearly: 300000,
    features: [
      'スタンダードの全機能',
      '企業数無制限',
      'AI分析無制限',
      'API連携',
      '優先サポート',
      '専任担当者',
    ],
    limits: {
      companies: -1,
      simulationsPerMonth: -1,
      aiAnalysisPerMonth: -1,
      excelExport: true,
      pdfExport: true,
      comparison: true,
      reclassification: true,
    },
  },
};

/**
 * Stripe Price IDのマッピング
 * Stripe Dashboard で作成した Price ID を環境変数で管理する。
 * テスト用: ¥0 の Price を作成して設定すればOK。
 */
export function getStripePriceId(plan: string, interval: 'month' | 'year'): string | null {
  const envKey = `STRIPE_PRICE_${plan.toUpperCase()}_${interval.toUpperCase()}LY`;
  return process.env[envKey] || null;
}

/**
 * サブスクリプションがアクティブ（利用可能）かどうか判定
 */
export function isSubscriptionActive(
  status: string | null | undefined,
  currentPeriodEnd: Date | null | undefined,
): boolean {
  if (isBillingBypassed()) return true;
  if (!status) return false;

  const activeStatuses = ['active', 'trialing'];
  if (!activeStatuses.includes(status)) return false;

  // 期間切れチェック
  if (currentPeriodEnd && new Date(currentPeriodEnd) < new Date()) return false;

  return true;
}

/**
 * プランの機能制限をチェック
 */
export function checkFeatureAccess(
  plan: string | null | undefined,
  feature: keyof PlanConfig['limits'],
): boolean {
  if (isBillingBypassed()) return true;

  const planConfig = PLANS[plan || 'free'];
  if (!planConfig) return false;

  const limit = planConfig.limits[feature];
  if (typeof limit === 'boolean') return limit;
  if (typeof limit === 'number') return limit !== 0;
  return false;
}
