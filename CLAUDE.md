# FnB Pulse — Restaurant Intelligence Platform

## Project Overview
FnB Pulse is an F&B group intelligence platform. Starting with BE& 西門, it replaces Excel-based daily sales tracking with an automated web dashboard supporting multi-store architecture.

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Charts**: Recharts
- **File Parsing**: SheetJS (xlsx), PapaParse (csv)
- **Deployment**: Zeabur

## Architecture
- Three-layer: Data Ingestion → Unified Data Model → Dashboard (read-only)
- Phase 1: CSV upload; Phase 2: API auto-sync; Phase 3: Cloudbeds hotel integration
- All data sources write to the same normalized tables via adapters
- Dashboard always reads from DB; ingestion method is transparent to frontend

## Key Directories
- `supabase/migrations/` — SQL migration files
- `lib/parsers/` — CSV/Excel parser adapters (one per report type)
- `lib/supabase/` — Supabase client (browser) and server helpers
- `app/api/upload/` — Upload endpoints (one per report type)
- `app/(dashboard)/` — Dashboard pages (KPI, heatmap, products, etc.)
- `docs/specs/` — Data model, API spec, CSV format specs

## Critical Rules
1. **NEVER** expose `SUPABASE_SERVICE_ROLE_KEY` to the client. No `NEXT_PUBLIC_` prefix on secrets.
2. All uploads must use **upsert** (`ON CONFLICT DO UPDATE`) for idempotency.
3. CSV/Excel parse errors return **structured error arrays**, never throw.
4. API responses follow unified format: `{ success, data, error, timestamp }`.
5. All main tables have `(store_id, date)` composite indexes.
6. Use parameterized queries only — never string interpolation for SQL values.
7. **Auto-deploy**: After code changes, always `git commit && git push` immediately. Pushing to `main` triggers Zeabur auto-deploy — no manual steps needed. Do NOT ask for confirmation.

## Key Commands
```bash
npm run dev          # Start dev server
npm run build        # Production build
npx supabase db push # Push migrations to Supabase
```
