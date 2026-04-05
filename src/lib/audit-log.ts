/**
 * 監査ログユーティリティ
 *
 * fire-and-forget でメインフローをブロックしない
 */
import { db } from '@/lib/db';
import { auditLogs } from '@/lib/db/schema';

// ---------------------------------------------------------------------------
// アクション定数
// ---------------------------------------------------------------------------

export const AUDIT_ACTIONS = {
  // シミュレーション
  SIMULATION_CREATE: 'simulation.create',
  SIMULATION_UPDATE: 'simulation.update',
  SIMULATION_DELETE: 'simulation.delete',
  // シナリオ
  SCENARIO_CREATE: 'scenario.create',
  SCENARIO_DELETE: 'scenario.delete',
  // 法人
  ORGANIZATION_CREATE: 'organization.create',
  ORGANIZATION_UPDATE: 'organization.update',
  ORGANIZATION_DELETE: 'organization.delete',
  // プラン
  PLAN_CHANGE: 'plan.change',
  PLAN_ACTIVATE: 'plan.activate',
  // ユーザー
  USER_LOGIN: 'user.login',
  USER_LOGOUT: 'user.logout',
  USER_CREATE: 'user.create',
  USER_UPDATE: 'user.update',
  USER_DELETE: 'user.delete',
  // 管理者
  ADMIN_SETTINGS_UPDATE: 'admin.settings.update',
  ADMIN_BILLING_UPDATE: 'admin.billing.update',
  // Stripe Webhook
  STRIPE_WEBHOOK_RECEIVED: 'stripe.webhook.received',
  STRIPE_WEBHOOK_FAILED: 'stripe.webhook.failed',
  STRIPE_CHECKOUT_COMPLETED: 'stripe.checkout.completed',
  STRIPE_SUBSCRIPTION_UPDATED: 'stripe.subscription.updated',
  STRIPE_SUBSCRIPTION_DELETED: 'stripe.subscription.deleted',
  STRIPE_PAYMENT_FAILED: 'stripe.payment.failed',
  // 企業・決算期
  COMPANY_CREATE: 'company.create',
  COMPANY_UPDATE: 'company.update',
  COMPANY_DELETE: 'company.delete',
  FISCAL_PERIOD_CREATE: 'fiscal_period.create',
  FISCAL_PERIOD_UPDATE: 'fiscal_period.update',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];

// ---------------------------------------------------------------------------
// logAudit
// ---------------------------------------------------------------------------

interface LogAuditParams {
  userId?: string | null;
  organizationId?: string | null;
  action: AuditAction | string;
  resource?: string | null;
  resourceId?: string | null;
  details?: Record<string, unknown> | null;
  ipAddress?: string | null;
}

/**
 * 監査ログを記録する (fire-and-forget)
 *
 * メインフローをブロックしないよう `.catch()` で非同期処理する。
 */
export function logAudit(params: LogAuditParams): void {
  db.insert(auditLogs)
    .values({
      userId: params.userId ?? null,
      organizationId: params.organizationId ?? null,
      action: params.action,
      resource: params.resource ?? null,
      resourceId: params.resourceId ?? null,
      details: params.details ?? null,
      ipAddress: params.ipAddress ?? null,
    })
    .catch((err) => {
      console.error('[AuditLog] Failed to write audit log:', err);
    });
}
