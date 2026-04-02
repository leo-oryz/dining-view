# Changelog

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
