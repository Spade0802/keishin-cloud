# PDCA Backlog - KeishinCloud

> Auto-generated from 10-agent feedback review. Last updated: 2026-04-06 00:35

## Status
- Total issues: 82 (P0: 14, P1: 26, P2: 27, P3: 15)
- Fixed: 28 (Cycle 1: 13, Cycle 2: 6, Cycle 3: 5, Cycle 10: 4)
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
- [ ] DATA-4: permitType always hardcoded to '一般' (use-extracted-data.ts:157)
- [ ] CODE-6: Stripe null as unknown as Stripe unsafe cast (stripe.ts:15)
- [ ] CODE-7: Name-based dedup fails for same-name employees (tech-staff-calculator.ts:136)
- [ ] CODE-8: Gemini extractor swallows all errors returns null (gemini-extractor.ts:592)
- [ ] PERF-2: No DB indexes on FK columns (schema.ts)
- [ ] PERF-3: In-memory AI cache grows unbounded (ai-cache.ts)
- [ ] PERF-4: Gemini model re-instantiated on every call (ai-analysis.ts:33)
- [ ] UX-2: Pricing page missing Header/Footer navigation (pricing/page.tsx)
- [ ] UX-3: HelpTooltip hover-only, no keyboard/mobile access (w-items-checklist.tsx:69)
- [ ] UX-4: Result tab bar 5 tabs overflows on mobile (result-view.tsx:347)
- [ ] UX-5: Excel download no loading state or error feedback (result-view.tsx:198)
- [ ] UX-6: Simulation save failure silently swallowed (input-wizard.tsx:869)
- [ ] UX-7: No extraction quality summary shown to user
- [ ] UX-8: markUserEdited never called - tracking infrastructure dead (input-wizard.tsx)
- [ ] MOBILE-1: Industry data row fixed-width breaks mobile (input-wizard.tsx:1210)
- [ ] MOBILE-2: Tech staff panel dense, touch targets too small (tech-staff-panel.tsx:305)
- [ ] ADMIN-1: User management CRUD missing (users page read-only)
- [ ] DOMAIN-4: Landing page "完全無料" contradicts paid pricing plans
- [ ] DOMAIN-5: No 3-year average (激変緩和措置) support for X1
- [ ] DOMAIN-6: Field names don't match 経審 official form terms (multiple fields)
- [ ] DOMAIN-7: Step 1 input fields missing help text for 経審様式 reference

### P2 - Medium (Fix if time permits)

- [ ] DATA-5: equity/ebitda value 0 treated as not extracted (use-extracted-data.ts:143)
- [ ] DATA-6: Multiple setBasicInfo calls - stale state risk (input-wizard.tsx:713)
- [ ] DATA-7: validatedBasicInfo computed but never consumed (use-extracted-data.ts:128)
- [ ] DATA-8: keishinPdfComplete flash in finally block (input-wizard.tsx:750)
- [ ] DATA-9: No error recovery for partial extraction (input-wizard.tsx:688)
- [ ] SEC-7: No CSRF protection on state-changing API routes
- [ ] SEC-8: Checkout success_url open redirect risk (create-checkout-session:108)
- [ ] CODE-9: Duplicate tech staff calculation logic (score-tables.ts vs tech-staff-calculator.ts)
- [ ] CODE-10: Duplicate Gemini model init and 429-fallback logic across 3 files
- [ ] CODE-11: Division by zero risk in W calculation (p-calculator.ts:45)
- [ ] PERF-5: Rate limiter TOCTOU race condition (ai-analysis route)
- [ ] PERF-6: Cache hit still consumes rate-limit token
- [ ] PERF-7: input-wizard.tsx 30+ useState - extract step components
- [ ] UX-9: Inconsistent file upload patterns (3 different in wizard)
- [ ] UX-10: Inconsistent error display patterns (alert, inline, console)
- [ ] UX-11: W score summary grid-cols-4 no responsive breakpoint
- [ ] UX-12: IndustryCodeSelect not keyboard-navigable
- [ ] UX-13: Accessibility - checkboxes lack aria-describedby
- [ ] UX-14: Accessibility - selects lack label linkage (tech-staff-panel)
- [ ] UX-15: Accessibility - pricing toggle no aria-pressed
- [ ] MOBILE-3: P formula breakdown overflows small screens
- [ ] MOBILE-4: Number inputs h-8 too small for touch (44px min)
- [ ] MOBILE-5: IndustryCodeSelect dropdown cut off on mobile
- [ ] ADMIN-2: Org/user list no search/filter/pagination
- [ ] ADMIN-3: Audit log UI missing userId/orgId/date filters
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
| 10 | 00:55 | 4 (CODE-2,3,5, PERF-1) | pending |
