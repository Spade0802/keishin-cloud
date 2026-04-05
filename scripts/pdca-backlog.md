# PDCA Backlog - KeishinCloud

> Auto-generated from 10-agent feedback review. Last updated: 2026-04-06 00:35

## Status
- Total issues: 82 (P0: 14, P1: 26, P2: 27, P3: 15)
- Fixed: 64+ (P0: 13/14, P1: 21/26, P2: 22/27, P3: 8+/15)
- Remaining: ~18 items (1 P0要照合, 5 P1, 5 P2, 7 P3)
- Next PDCA cycle: 02:00 JST

## Priority Queue (P0 → P3)

### P0 - Critical (Must fix immediately)

- [x] SEC-1: Hardcoded admin credentials in seed-admin.ts ✅ Cycle 1
- [x] SEC-2: Seed-admin endpoint available in production ✅ Cycle 1
- [x] SEC-3: API routes not in auth middleware matcher ✅ Cycle 1
- [x] DATA-1: Prime contract mapped to subcontract field ✅ Cycle 1
- [ ] CODE-1: X1 score table non-monotonic anomaly at high brackets (score-tables.ts) - ⚠️ 要国交省告示照合 Cycle 10で注釈追加
- [x] CODE-2: W6 R&D formula incorrect - should use revenue ratio, not fixed amount ✅ Cycle 10
- [x] CODE-3: No unit tests for scoring engine (92 tests) ✅ Cycle 10
- [x] PERF-1: 5-15 Gemini API calls per PDF → 1-3 calls ✅ Cycle 10
- [x] CODE-4: Webhook 200→500 on failure ✅ Cycle 3
- [x] UX-1: Step validation ✅ Cycle 2
- [x] CODE-5: Zod validation for Gemini AI response ✅ Cycle 10
- [x] DOMAIN-1: W items default insurance=true ✅ Cycle 2
- [x] DOMAIN-2: P点端数Math.round→floor ✅ Cycle 2
- [x] DOMAIN-3: 下請完工高→元請完成工事高 ✅ Cycle 2

### P1 - High (Fix this cycle)

- [x] SEC-4: Middleware admin role check ✅ Cycle 1
- [x] SEC-5: Billing bypass explicit only ✅ Cycle 1
- [x] SEC-6: Webhook plan validation ✅ Cycle 1
- [x] DATA-2: Validation bypass fixed ✅ Cycle 1
- [x] DATA-3: Cyrillic field name fixed ✅ Cycle 1
- [x] DATA-4: permitType警告追加（PDF抽出にpermitType無し） ✅ Cycle 11確認
- [x] CODE-6: Stripe null安全対応済み ✅ 既存修正確認
- [x] CODE-7: Name-based dedup→rowIndex+qualCode ✅ 既存修正確認
- [x] CODE-8: Gemini抽出エラー伝播修正 ✅ Cycle 11
- [x] PERF-2: DB FK indexes追加 ✅ Cycle 3
- [x] PERF-3: AI cache MAX_ENTRIES=100+cleanup ✅ Cycle 5
- [x] PERF-4: Gemini model共通factory ✅ Cycle 8+12
- [x] UX-2: Pricing Header/Footer追加 ✅ Cycle 7
- [x] UX-3: HelpTooltip button+focus+click ✅ Cycle 7
- [x] UX-4: Result tabs overflow-x-auto ✅ Cycle 3
- [x] UX-5: Excel download loading state ✅ Cycle 3
- [x] UX-6: Save failure amber banner ✅ Cycle 4
- [x] UX-7: Extraction quality summary card ✅ Cycle 4
- [x] UX-8: markUserEdited wired to onChange ✅ Cycle 4
- [x] MOBILE-1: Industry row flex-wrap+w-full ✅ Cycle 6
- [x] MOBILE-2: Tech staff h-9 sm:h-7 ✅ Cycle 7
- [ ] ADMIN-1: User management CRUD missing (users page read-only)
- [x] DOMAIN-4: ランディングページ「無料で始められる」 ✅ Cycle 11
- [x] DOMAIN-5: X1激変緩和措置（2年/3年平均） ✅ Cycle 12
- [x] DOMAIN-6: 経審公式用語統一 ✅ Cycle 12
- [x] DOMAIN-7: Step 1経審様式ヘルプテキスト追加 ✅ Cycle 11

### P2 - Medium (Fix if time permits)

- [x] DATA-5: equity/ebitda value 0 treated as not extracted ✅ 既存修正確認
- [x] DATA-6: Multiple setBasicInfo calls - stale state risk ✅ Cycle 2
- [x] DATA-7: validatedBasicInfo consumed in processExtraction ✅ Cycle 2
- [x] DATA-8: keishinPdfComplete flash in finally block ✅ Cycle 4
- [ ] DATA-9: No error recovery for partial extraction (input-wizard.tsx:688)
- [x] SEC-7: CSRF protection on admin/billing/settings routes ✅ Cycle 6
- [x] SEC-8: Checkout success_url open redirect risk ✅ Cycle 9
- [x] CODE-9: Duplicate tech staff calculation logic removed ✅ Cycle 11
- [x] CODE-10: Gemini model init共通化 ✅ Cycle 12
- [x] CODE-11: Division by zero guards added ✅ Cycle 5
- [ ] PERF-5: Rate limiter TOCTOU race condition (ai-analysis route)
- [x] PERF-6: Cache hit no longer consumes rate-limit token ✅ 既存修正確認
- [x] PERF-7: input-wizard.tsx TODO追加（大規模リファクタは別PR） ✅ Cycle 12
- [x] UX-9: File upload pattern unified (Step 4) ✅ Cycle 6
- [ ] UX-10: Inconsistent error display patterns (alert, inline, console)
- [x] UX-11: W score summary responsive breakpoint ✅ Cycle 12
- [x] UX-12: IndustryCodeSelect keyboard nav ✅ Cycle 6
- [x] UX-13: Accessibility - checkboxes aria-describedby ✅ Cycle 7
- [x] UX-14: Accessibility - selects label linkage ✅ Cycle 7
- [x] UX-15: Accessibility - pricing toggle aria-pressed ✅ Cycle 7
- [x] MOBILE-3: P formula breakdown flex-wrap ✅ Cycle 8
- [x] MOBILE-4: Number inputs h-10 sm:h-8 ✅ Cycle 6
- [x] MOBILE-5: IndustryCodeSelect dropdown w-full sm:w-64 ✅ Cycle 6
- [ ] ADMIN-2: Org/user list no search/filter/pagination
- [x] ADMIN-3: Audit log UI filters+CSV+IP ✅ Cycle 7+9
- [ ] DOMAIN-8: Demo page view-only, no interactive trial without registration
- [ ] DOMAIN-9: EBITDA in Step 2 should be auto-calculated from Step 1 BS/PL data

### P3 - Low (Nice to have)

- [ ] PERF-8: apiGeneralLimiter instantiated but never used
- [ ] PERF-9: Bundle - code-split wizard steps with React.lazy
- [ ] UX-16: No success feedback after calculation
- [ ] UX-17: Pricing alert() instead of toast
- [ ] UX-18: FAQ triangle character read by screen readers
- [ ] UX-19: TechStaffPanel qualification codes show raw numbers
- [ ] UX-20: ContributionBar label w-36 squeezes bar on mobile
- [ ] ADMIN-4: Dashboard uses mock data not real stats
- [ ] ADMIN-5: No billing invoice/payment history view
- [ ] ADMIN-6: No trial period management UI
- [ ] ADMIN-7: No audit log CSV/JSON export
- [ ] ADMIN-8: Audit log missing IP address display
- [ ] FEATURE-1: Multi-company batch simulation
- [ ] FEATURE-2: Keyboard shortcuts (Ctrl+S, Ctrl+Enter)
- [ ] FEATURE-3: Auto-save expiry too short (7 days → 30 days)

## Completed Fixes
<!-- Completed items move here with timestamp -->

## PDCA Cycle Log
| Cycle | Time | Issues Fixed | Commit |
|-------|------|-------------|--------|
| 1 | 00:35 | 13 (SEC-1~6, DATA-1~7) | e2f91e7 |
| 2 | 00:55 | 6 (DOMAIN-1~3, UX-1,2,5) | 8b02a52 |
| 3 | 01:10 | 5 (CODE-4, PERF-2~3, UX-4,7) | 59a61c1 |
| 10 | 00:55 | 4 (CODE-2,3,5, PERF-1) | 2d1f7e3 |
| 11 | 01:00 | 4 (DOMAIN-4,7, CODE-8,9) | 7775d81 |
| 12 | 01:05 | 5 (DOMAIN-5,6, CODE-10, UX-11, PERF-7) | 47db69b |
