# Changelog

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
