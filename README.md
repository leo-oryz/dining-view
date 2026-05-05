# DiningView

Restaurant intelligence dashboard for **NOM Dining**, a fine dining group in Ho Chi Minh City, Vietnam.

Forked from FNB Pulse (Taiwan-based), localized for Vietnam: VND currency, `Asia/Ho_Chi_Minh` timezone, VAT 10% + 5% service charge tax structure.

## Stack
- Next.js 14 (App Router) + TypeScript
- Supabase (PostgreSQL, RLS)
- Tailwind CSS + Recharts
- Resend (email), Anthropic (AI analysis)

## Getting started

```bash
npm install
cp .env.example .env.local   # fill in secrets
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Common commands

```bash
npm run dev           # Start dev server
npm run build         # Production build
npx supabase db push  # Push migrations to Supabase
```

## Deployment

Pushing to `main` triggers Zeabur auto-deploy via the Dockerfiles in this repo:
- `Dockerfile` — Next.js web app
- `Dockerfile.scheduler` — cron jobs for data sync

## Project layout

- `app/(dashboard)/` — dashboard pages (KPI, trends, products, members, etc.)
- `app/api/` — API routes (read endpoints + cron jobs)
- `components/` — UI building blocks
- `lib/constants/` — `APP_TIMEZONE`, `APP_CURRENCY`, tax constants
- `lib/i18n/translations/` — `vi` (default) / `en` / `zh-TW`
- `supabase/migrations/` — SQL migrations (run with `npx supabase db push`)
