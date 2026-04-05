-- Add indexes on foreign key columns for query performance
CREATE INDEX IF NOT EXISTS "simulations_organization_id_idx" ON "simulations" ("organization_id");
CREATE INDEX IF NOT EXISTS "simulations_user_id_idx" ON "simulations" ("user_id");
CREATE INDEX IF NOT EXISTS "companies_organization_id_idx" ON "companies" ("organization_id");
CREATE INDEX IF NOT EXISTS "fiscal_periods_company_id_idx" ON "fiscal_periods" ("company_id");
CREATE INDEX IF NOT EXISTS "users_organization_id_idx" ON "users" ("organization_id");
CREATE INDEX IF NOT EXISTS "audit_logs_organization_id_idx" ON "audit_logs" ("organization_id");
CREATE INDEX IF NOT EXISTS "audit_logs_user_id_idx" ON "audit_logs" ("user_id");
CREATE INDEX IF NOT EXISTS "audit_logs_action_idx" ON "audit_logs" ("action");
CREATE INDEX IF NOT EXISTS "audit_logs_created_at_idx" ON "audit_logs" ("created_at");
