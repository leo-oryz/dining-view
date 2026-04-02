# Changelog

## [5.0.0] — 2026-04-02 — Phase 5 Complete

### Added
- **Second Store Support**: Settings page with owner-only Store Management (add store with name, location, credentials)
- **GET/POST /api/stores**: List and create stores with per-store credentials (JSONB)
- **Multi-store Download Agent**: Agent loops through all active stores, using per-store eat365/Ocard credentials from DB
- **TikTok Ads**: `lib/ads/tiktokClient.ts` wrapper for TikTok Business API v1.3 with exponential backoff retry
- **POST /api/sync/tiktok-ads**: Manual trigger for TikTok Ads campaign sync
- **Anomaly Alerts**: Automated detection of revenue drops, cost spikes, member churn, delivery drops
- **lib/alerts/anomalyDetector.ts**: Checks 4 conditions against 7-day rolling averages across all stores
- **lib/alerts/lineNotifier.ts**: LINE Messaging API push message sender for alert notifications
- **GET /api/alerts**: List recent alerts (last 30 days, paginated)
- **POST /api/alerts/test**: Send test LINE push notification
- **POST /api/alerts/detect**: Trigger anomaly detection (called by scheduler)
- **Alerts Page**: `/alerts` with alert summary cards, history list, severity badges, and test notification button
- **Cloudbeds Hotel**: `lib/hotel/cloudbedsClient.ts` API wrapper (conditional on CLOUDBEDS_API_KEY)
- **lib/hotel/guestMatcher.ts**: Phone-based matching of hotel guests to Ocard members
- **POST /api/hotel/sync**: Trigger Cloudbeds sync + guest matching
- **GET /api/hotel/conversion**: Hotel guest conversion rate, avg spend, recent mappings
- **Members Hotel Tab**: Conditional "住客轉換" tab with KPIs and guest matching table
- **Migration**: `005_anomaly_alerts.sql` — anomaly_alerts table with RLS policies
- **Migration**: `006_store_credentials.sql` — credentials JSONB on stores, hotel_guest_mappings unique constraint

### Changed
- Ads page: added platform filter tabs (All / Meta / TikTok), separate sync buttons for Meta and TikTok
- Members page: added conditional Hotel Guests tab (visible only if Cloudbeds configured)
- Download agent: refactored to loop all active stores from DB with per-store credentials
- eat365.ts / ocard.ts: accept optional `{ storeId, credentials }` parameter
- uploader.ts: passes `store_id` in form data for multi-store upload
- Scheduler: added TikTok sync at 02:45, anomaly detection at 03:00
- Sidebar: added Alerts and Settings (owner-only) navigation items
- `.env.example`: added TikTok Ads, LINE Alerts, Cloudbeds env vars

## [4.0.0] — 2026-04-02 — Phase 4 Complete

### Added
- **Uber Eats Delivery**: CSV parser (`lib/parsers/uberEats.ts`), upload API, delivery summary API with dine-in comparison
- **POST /api/upload/uber-eats**: Upload and parse Uber Eats CSV export
- **GET /api/delivery/summary**: Delivery KPIs + dine-in vs delivery comparison data
- **Delivery Page**: Full dashboard with gross/net revenue trend, order count, cancellation rate, platform rating, dine-in vs delivery stacked bar chart
- **Meta Ads API**: `lib/ads/metaClient.ts` wrapper for Meta Marketing API v18.0 with exponential backoff retry
- **POST /api/sync/meta-ads**: Manual trigger for Meta Ads campaign sync
- **Ads Page**: "Sync from Meta" button with last synced timestamp
- **RFM Dashboard**: New RFM tab on members page with trend chart, R/F/M distribution bar charts, dormant alert banner
- **GET /api/members/rfm**: Fetch all RFM snapshots for a store ordered by date
- **RFM Components**: `RFMTrendChart`, `RFMDistributionChart`, `DormantAlert`
- **Cross-store Compare**: Owner-only `/compare` page with side-by-side KPI table and vs-last-period deltas
- **GET /api/sales/compare**: Multi-store KPI aggregation with previous period comparison
- **Investor Report**: Owner-only `/reports` page with one-click PDF generation
- **POST /api/reports/investor**: Server-side PDF generation via `@react-pdf/renderer`
- **PDF sections**: Monthly revenue trend, member growth, top 10 products, gross margin, key KPIs
- **Migration**: `004_phase4_columns.sql` — adds gross_revenue, commission_rate, cancellation_rate, platform_rating, data_source to delivery_sales; campaign_id, reach, cpa, data_source to ad_campaigns
- **Dependency**: `@react-pdf/renderer` for server-side PDF

### Changed
- Delivery page: replaced setup instructions with real charts and CSV upload
- Ads page: added Meta sync button + last synced indicator
- Members page: added RFM analysis tab alongside existing overview
- Sidebar: added Compare and Reports links (owner only)
- `.env.example`: added Meta Ads API env vars

## [3.0.0] — 2026-04-02 — Phase 3 Complete

### Added
- **AI Analysis**: Claude API integration with 3 report types: attribution, star products, retire candidates
- **lib/ai/**: 5 modules — `dataPrep.ts`, `basketAnalysis.ts`, `marginMatrix.ts`, `claudeAnalyzer.ts`, `reportRenderer.ts`
- **POST /api/ai/analyze**: Trigger AI analysis, saves to `ai_analysis_reports` table
- **GET /api/ai/reports**: List past reports with optional `report_type` filter
- **GET /api/ai/reports/[id]**: Fetch single report with full content
- **GET /api/ai/attribution**: Latest attribution report shortcut
- **GET /api/ai/star-products**: Latest star products report shortcut
- **GET /api/ai/retire-candidates**: Latest retire candidates report shortcut
- **AI Page**: Full UI with report type selector, generate button, history sidebar, and rendered report viewer
- **AI Components**: `AttributionReport`, `StarProductsReport`, `RetireCandidatesReport`, `ReportHistory`
- **LINE OA**: Broadcast CRUD with friend trend chart and D+1~D+3 impact visualization
- **GET/POST /api/line/broadcasts**: List + create broadcasts
- **PUT/DELETE /api/line/broadcasts/[id]**: Update + delete broadcasts
- **GET /api/line/friend-trend**: Friend count over time from broadcast records
- **GET /api/line/broadcast-impact**: Revenue delta D+1~D+3 vs 7-day rolling average
- **LINE Components**: `BroadcastForm`, `FriendTrendChart`, `BroadcastImpactChart`
- **Meta Ads**: Ad campaign CRUD with spend vs revenue correlation chart
- **GET/POST /api/ads/campaigns**: List + create ad campaign records
- **PUT/DELETE /api/ads/campaigns/[id]**: Update + delete ad campaigns
- **GET /api/ads/performance**: Spend/clicks/impressions summary with daily revenue correlation
- **Ads Components**: `AdCampaignForm`, `AdPerformanceChart`
- **Delivery Page**: Setup instructions for Uber Eats and foodpanda manual CSV upload
- **Migration**: `003_line_broadcasts.sql` with RLS policies and indexes
- **Dependency**: `@anthropic-ai/sdk` for Claude API calls

### Changed
- AI page: replaced placeholder with full analysis UI
- Sidebar: added LINE 推播, 廣告管理, 外送平台 navigation items
- `.env.example`: added `ANTHROPIC_API_KEY`

## [2.0.0] — 2026-04-01 — Phase 2 Complete

### Added
- **Auth**: Supabase Auth email/password login, replacing Phase 1 simple password
- **Middleware**: Next.js middleware protecting all dashboard routes, redirecting to /login
- **RLS**: Row Level Security policies on all data tables (owner sees all, manager sees own store)
- **Users**: `auth_id` column linking `users` table to `auth.users`
- **Store Switcher**: Owner role sees dropdown to switch between stores in sidebar
- **Logout**: Logout button in sidebar with session cleanup
- **GET /api/auth/me**: Returns current user role + store_id
- **POST /api/auth/callback**: Supabase auth code exchange
- **Google Search Console**: `lib/google/gscClient.ts` fetches brand search data via service account
- **Google Analytics 4**: `lib/google/ga4Client.ts` fetches event data via service account
- **Member Conversion**: `lib/google/conversionCalc.ts` calculates GA4 clicks → Ocard new members
- **POST /api/google/sync**: Manual trigger for GSC + GA4 + conversion sync
- **GET /api/google/gsc/brand-search**: Query GSC data with store filtering
- **GET /api/google/ga4/events**: Query GA4 data with store filtering
- **GET /api/google/conversion**: Query conversion data with store filtering
- **Digital Page**: Real UI with KPI cards, GSC trend chart, GA4 sessions chart, conversion chart, top queries table
- **Weather**: `lib/weather/cwaClient.ts` fetches from Taiwan CWA API
- **POST /api/weather/sync**: Manual trigger for weather data sync
- **Playwright Agent**: `agents/download-agent/` with eat365 + Ocard download scripts and file uploader
- **Scheduler**: `scripts/scheduler.ts` with node-cron (00:30 agent, 01:00 weather, 02:00 Google)
- **Migration**: `002_auth_rls.sql` with RLS policies and helper functions

### Changed
- Login page: email + password fields (was password-only)
- Dashboard layout: session check, store switcher, logout button, user email display
- Root page redirects to /login (was /dashboard)
- `lib/supabase/server.ts`: cookie-based `createServerSupabase()` alongside `createServiceClient()`
- `tsconfig.json`: excludes `agents/` and `scripts/` directories
- `.env.example`: all Phase 2 env vars documented

## [1.0.0] — 2026-04-01 — Phase 1 Complete

### Added
- **Database**: 20 tables with full schema, indexes, and seed data for BE& 西門
- **Upload Endpoints**: 9 upload APIs for eat365 (summary, hourly, items, transactions) and Ocard (dashboard, members, recruit, consumption, RFM)
- **Parsers**: 10 parser modules handling xlsx, xls, and csv formats with structured error reporting
- **Dashboard**: KPI cards (net sales, guests, orders, avg spending) with day-over-day change
- **Charts**: 30-day sales trend line chart, hourly sales bar chart
- **Products**: Product ranking table with quantity, revenue, and margin columns
- **Members**: Member visit/new member KPI cards and trend chart
- **Campaigns**: CRUD form with campaign list and status badges
- **Upload Page**: Drag-drop dropzone with report type selector and upload history table
- **Placeholder Pages**: Digital marketing and AI analysis pages with Phase 2 message
- **Layout**: Responsive sidebar navigation with mobile hamburger menu
- **Auth**: Simple password-based login (Phase 1 only)
- **Health Check**: GET /api/health returns { success: true, timestamp }
- **Docs**: Architecture doc, API spec, data model spec, CSV format spec, lessons learned
- **Rules**: API conventions, database rules, CSV parsing rules, Google API rules
