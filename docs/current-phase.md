# Current Phase: Phase 6 — System Polish + Mobile + Export + Expansion

## Status: COMPLETE

## Phase 6 Completed: 2026-04-03

## What Was Built

### 1. Mobile Optimization
- Bottom tab bar (5 core pages + "更多") for mobile (< 1024px)
- Desktop sidebar unchanged for >= 1024px
- All touch targets meet 44×44px minimum
- Charts accept `height` prop with mobile-responsive defaults
- Main content has bottom padding on mobile for tab bar clearance
- Loading skeletons (KPI cards + chart placeholders) on dashboard

### 2. Performance
- `lib/cache/queryCache.ts` — in-memory TTL cache (1-hour default)
- Migration `007_performance_indexes.sql` — additional indexes for expansion/export queries
- Dynamic imports (`next/dynamic`) for all expansion chart components
- `components/ui/Skeleton.tsx` — reusable skeleton components

### 3. Excel Export
- `/export` page with date range picker + 4 dataset cards
- `GET /api/export/daily-sales` — daily sales with weather
- `GET /api/export/products` — product sales by date
- `GET /api/export/orders` — order aggregation
- `GET /api/export/members` — member snapshots with VIP breakdown
- All exports use `exceljs` for server-side generation
- 366-day max range validation
- Filename format: `fnb-pulse-{type}-{from}-{to}.xlsx`

### 4. Expansion Analysis Dashboard
- `/expansion` page (owner only) with 5 visualization sections
- TimeSlotHeatmap — hourly avg revenue bar chart
- CategoryBreakdown — top 10 revenue categories (horizontal bar)
- DemographicProfile — gender + age pie charts from Ocard snapshots
- SeasonalHeatmap — monthly revenue trend
- Revenue per seat KPI card
- AI expansion readiness report via Claude
- `POST /api/ai/expansion` — triggers analysis, saves to `ai_analysis_reports`
- `GET /api/members/demographics` — latest demographic snapshot
- `expansion` report type added to `claudeAnalyzer.ts`

### 5. Weekly Digest Email
- `POST /api/digest/send` — manual trigger
- `lib/digest/weeklyDigest.ts` — compiles KPI data + sends via Resend
- Email includes: total revenue, week-over-week delta, new members, top 3 products, alert count
- Scheduler: Monday 08:00 Asia/Taipei
- Migration `008_weekly_digests.sql` — send history table

## Not In Scope (Future)
- White-label dashboard
- Mobile app
- Real-time POS integration
