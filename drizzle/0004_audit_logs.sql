CREATE TABLE IF NOT EXISTS "audit_logs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid REFERENCES "users"("id") ON DELETE SET NULL,
  "organization_id" uuid REFERENCES "organizations"("id") ON DELETE SET NULL,
  "action" text NOT NULL,
  "resource" text,
  "resource_id" text,
  "details" jsonb,
  "ip_address" text,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- パフォーマンス用インデックス
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_organization_id_idx" ON "audit_logs" ("organization_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at" DESC);
