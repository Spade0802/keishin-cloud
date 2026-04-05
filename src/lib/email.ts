/**
 * メール通知サービス (スタブ)
 *
 * 現在はログ出力のみ。本番運用時は SendGrid / Resend 等と統合する。
 *
 * TODO: 本番環境向けに SendGrid / Resend / AWS SES 等のプロバイダーを統合する
 * TODO: メールテンプレート (HTML) を用意する
 * TODO: 送信失敗時のリトライキューを実装する
 */
import { logger } from '@/lib/logger';

// ---------------------------------------------------------------------------
// 共通型
// ---------------------------------------------------------------------------

interface EmailRecipient {
  to: string;
  name: string;
}

interface WelcomeEmailData extends EmailRecipient {
  organizationName?: string;
}

interface TrialExpiringEmailData extends EmailRecipient {
  trialEndsAt: Date;
  daysRemaining: number;
  upgradeUrl: string;
}

interface SubscriptionConfirmEmailData extends EmailRecipient {
  plan: string;
  amount?: number;
  nextBillingDate?: Date;
}

// ---------------------------------------------------------------------------
// メール送信関数
// ---------------------------------------------------------------------------

/**
 * ウェルカムメールを送信する (スタブ)
 */
export async function sendWelcomeEmail(data: WelcomeEmailData): Promise<void> {
  logger.info('[Email] sendWelcomeEmail (stub)', {
    to: data.to,
    name: data.name,
    organizationName: data.organizationName,
  });
  // TODO: 実際のメール送信処理を実装する
}

/**
 * トライアル期限間近の通知メールを送信する (スタブ)
 */
export async function sendTrialExpiringEmail(data: TrialExpiringEmailData): Promise<void> {
  logger.info('[Email] sendTrialExpiringEmail (stub)', {
    to: data.to,
    name: data.name,
    daysRemaining: data.daysRemaining,
    trialEndsAt: data.trialEndsAt.toISOString(),
  });
  // TODO: 実際のメール送信処理を実装する
}

/**
 * サブスクリプション確認メールを送信する (スタブ)
 */
export async function sendSubscriptionConfirmEmail(data: SubscriptionConfirmEmailData): Promise<void> {
  logger.info('[Email] sendSubscriptionConfirmEmail (stub)', {
    to: data.to,
    name: data.name,
    plan: data.plan,
    amount: data.amount,
    nextBillingDate: data.nextBillingDate?.toISOString(),
  });
  // TODO: 実際のメール送信処理を実装する
}
