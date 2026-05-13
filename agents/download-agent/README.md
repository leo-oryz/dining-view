# DiningView Download Agent

Playwright-driven scraper that logs into [fabi.ipos.vn](https://fabi.ipos.vn) per store, exports the 4 daily reports (`sale_summary`, `payment_methods`, `items`, `source`), parses them with the shared `lib/parsers/ipos` pipeline, and upserts to Supabase.

Lives outside the Next.js build so chromium (~300MB) doesn't bloat the production bundle.

## Setup

```bash
cd agents/download-agent
npm install
npx playwright install --with-deps chromium
```

Copy env from the parent project:

```bash
cp ../../.env.local .env
```

Required env vars:

| Name | Purpose |
|------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key — reads `stores.credentials`, writes data tables |
| `IPOS_DAYS` *(optional)* | Date window, default `30` |
| `IPOS_STORE_ID` *(optional)* | Scrape only this store; default = every store with iPOS creds |
| `PLAYWRIGHT_HEADED` *(optional)* | Set to `1` for headed mode (debugging) |
| `IPOS_DISCOVERY` *(optional)* | Set to `1` to pause before each step and dump screenshots |

## Usage

```bash
# headless, every iPOS-configured store, last 30 days
npm run scrape

# headed mode (watch what's happening)
npm run scrape:headed

# discovery mode (pauses + dumps debug_*.png at every step)
npm run scrape:discovery
```

## How it works

1. Read `stores.credentials.ipos.{email,password}` from Supabase for each store.
2. Launch chromium, log into fabi.ipos.vn.
3. Navigate to the 4 report pages, pick the date range, click export, await download.
4. Feed the 4 buffers into `parseIposUpload()` from `lib/parsers/ipos`.
5. Upsert into `daily_sales` / `hourly_sales` / `product_sales` via Supabase service role.
6. Log a row into `upload_history` with status + record count.

Idempotent — re-running the same window just upserts. Safe to schedule daily via GitHub Actions.
