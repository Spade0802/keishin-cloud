/**
 * Drizzle ORM スキーマ定義
 *
 * NextAuth.js のアカウント管理 + 法人別経審シミュレーション保存
 */
import {
  pgTable,
  text,
  timestamp,
  integer,
  jsonb,
  uuid,
  primaryKey,
  boolean,
  pgEnum,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';
import type { AdapterAccountType } from 'next-auth/adapters';

// ─── Enums ───

export const userRoleEnum = pgEnum('user_role', ['admin', 'member']);

// ─── 法人テーブル ───

export const organizations = pgTable('organizations', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name').notNull(),
  permitNumber: text('permit_number'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ─── NextAuth.js テーブル ───

export const users = pgTable('users', {
  id: uuid('id').defaultRandom().primaryKey(),
  name: text('name'),
  email: text('email').unique(),
  emailVerified: timestamp('email_verified', { mode: 'date' }),
  password: text('password'),
  image: text('image'),
  organizationId: uuid('organization_id').references(() => organizations.id, {
    onDelete: 'set null',
  }),
  role: userRoleEnum('role').default('member').notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

export const accounts = pgTable(
  'accounts',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').$type<AdapterAccountType>().notNull(),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refresh_token: text('refresh_token'),
    access_token: text('access_token'),
    expires_at: integer('expires_at'),
    token_type: text('token_type'),
    scope: text('scope'),
    id_token: text('id_token'),
    session_state: text('session_state'),
  },
  (account) => [
    primaryKey({ columns: [account.provider, account.providerAccountId] }),
  ]
);

export const sessions = pgTable('sessions', {
  sessionToken: text('session_token').primaryKey(),
  userId: uuid('user_id')
    .notNull()
    .references(() => users.id, { onDelete: 'cascade' }),
  expires: timestamp('expires', { mode: 'date' }).notNull(),
});

export const verificationTokens = pgTable(
  'verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { mode: 'date' }).notNull(),
  },
  (vt) => [primaryKey({ columns: [vt.identifier, vt.token] })]
);

// ─── アプリケーション テーブル ───

export const simulations = pgTable('simulations', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  name: text('name').notNull().default('無題のシミュレーション'),
  period: text('period'),
  inputData: jsonb('input_data').notNull(),
  resultData: jsonb('result_data'),
  isPublic: boolean('is_public').default(false).notNull(),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow().notNull(),
});

// ─── システム設定テーブル ───

export const systemSettings = pgTable('system_settings', {
  key: text('key').primaryKey(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at', { mode: 'date' }).defaultNow(),
  updatedBy: text('updated_by').references(() => users.id),
});

export const scenarios = pgTable('scenarios', {
  id: uuid('id').defaultRandom().primaryKey(),
  simulationId: uuid('simulation_id')
    .notNull()
    .references(() => simulations.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  changes: jsonb('changes').notNull(),
  resultData: jsonb('result_data'),
  createdAt: timestamp('created_at', { mode: 'date' }).defaultNow().notNull(),
});

// ─── 企業テーブル ───

export const companies = pgTable('companies', {
  id: uuid('id').defaultRandom().primaryKey(),
  organizationId: uuid('organization_id').references(() => organizations.id, {
    onDelete: 'cascade',
  }),
  name: text('name').notNull(),
  permitNumber: text('permit_number'),
  prefectureCode: text('prefecture_code'),
  targetIndustries: jsonb('target_industries').$type<string[]>().default([]),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── 決算期テーブル ───

export const fiscalPeriods = pgTable('fiscal_periods', {
  id: uuid('id').defaultRandom().primaryKey(),
  companyId: uuid('company_id')
    .references(() => companies.id, { onDelete: 'cascade' })
    .notNull(),
  periodNumber: integer('period_number').notNull(),
  startDate: text('start_date'),
  endDate: text('end_date'),
  status: text('status').default('draft'),
  rawFinancialData: jsonb('raw_financial_data'),
  keishinBs: jsonb('keishin_bs'),
  keishinPl: jsonb('keishin_pl'),
  yInput: jsonb('y_input'),
  socialItems: jsonb('social_items'),
  techStaff: jsonb('tech_staff'),
  industries: jsonb('industries'),
  calculationResult: jsonb('calculation_result'),
  prevPeriodSnapshot: jsonb('prev_period_snapshot'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// ─── リレーション ───

export const companiesRelations = relations(companies, ({ one, many }) => ({
  organization: one(organizations, {
    fields: [companies.organizationId],
    references: [organizations.id],
  }),
  fiscalPeriods: many(fiscalPeriods),
}));

export const fiscalPeriodsRelations = relations(fiscalPeriods, ({ one }) => ({
  company: one(companies, {
    fields: [fiscalPeriods.companyId],
    references: [companies.id],
  }),
}));
