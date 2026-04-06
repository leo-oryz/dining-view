# Lessons Learned

## Phase 1

### eat365 File Formats
- Sales Summary xlsx has header at row 4 (0-indexed = 3), not row 2. Rows 0-2 are metadata/sub-headers.
- Sales Summary date format is "2026-03-31 (Tue)" — must regex extract the date portion.
- Sales By Item xls has header at row 1. Row 0 is a period label.
- Sales By Item may have duplicate product names — must deduplicate before upsert or Postgres throws "ON CONFLICT DO UPDATE command cannot affect row a second time".
- Sales By Item xls contains header rows (SKU Name, Category) and total rows (Total, Grand Total) in the data range — parser must skip these.
- Product ranking API must aggregate by product_name across dates (SUM quantity/revenue/cost, recompute margin from totals) — returning raw rows causes duplicates when querying multi-day ranges.
- Transaction Report CSV mixes order-level rows with item-level rows. Must filter by Item Type.
- Hourly Sales has a "Total" row at the end and a "Time" header row that both must be excluded.

### Ocard File Formats
- 會員招募分析 and 顧客消費分析 are NOT tabular CSVs. They are key-value pair format with sections. Must parse by scanning for known key names.
- 儀表板 xlsx has 3 sheets. "明細" sheet has daily data with header at row 2.
- 商品銷售 CSV has phone numbers wrapped in `="..."` Excel quoting. Must strip the wrapper.

### Database
- PostgreSQL does not allow COALESCE() inside UNIQUE constraints. Use CREATE UNIQUE INDEX instead.
- Supabase JS client `.upsert()` onConflict does not support expressions like COALESCE. Use DEFAULT '' on nullable columns and a plain unique index instead.
- When batch upserting, deduplicate input data first — Postgres rejects a batch where two rows match the same conflict target.

### Architecture
- Always upsert (ON CONFLICT DO UPDATE) — users may re-upload the same file.
- Return structured error arrays from parsers, never throw exceptions.
- Keep SUPABASE_SERVICE_ROLE_KEY server-side only. Never prefix with NEXT_PUBLIC_.

### Deployment (Zeabur)
- Node 22 has npm compatibility issues on Zeabur. Use Node 18 Alpine in Dockerfile.
- Next.js needs `output: 'standalone'` in next.config.mjs for Docker deployment.
- Must have a `public/` directory (even if empty) or Dockerfile COPY fails.

## Phase 2

### Auth
- Supabase Auth `createServerClient` from `@supabase/ssr` requires async cookies() in Next.js 14. The `setAll` callback must be wrapped in try/catch because it can be called from Server Components where cookies are read-only.
- Middleware must refresh the session on every request by calling `supabase.auth.getUser()` — using `getSession()` alone won't refresh expired tokens.

### TypeScript / Build
- Next.js picks up ALL `.ts` files in the project tree for type checking, including agent scripts. Exclude standalone scripts directories (`agents/`, `scripts/`) in `tsconfig.json`.
- `googleapis` GA4 `runReport` expects `limit` as a string, not number.
- Lucide React icons should be typed as `LucideIcon`, not `React.ComponentType`.
- ESLint `no-explicit-any` disable comments must be on the exact line with `any`, not the line before the function declaration.

### Google APIs
- GSC `searchanalytics.query` dimensionFilterGroups with `groupType: 'or'` allows matching multiple brand keywords in one request.
- GA4 dates come as `YYYYMMDD` format from the API — must reformat to `YYYY-MM-DD` before storing.
- Always deduplicate API response rows before upserting — the same query+date or event+page can appear multiple times.

## Phase 3

### AI / Claude API
- Claude API responses may wrap JSON in markdown code fences (```json...```). Must strip fences before parsing.
- Use retry (up to 2 retries) for JSON parse failures — Claude may occasionally return malformed JSON on first attempt.
- Prompt assembly should use pipe-delimited tables for data context — structured enough for Claude to understand, compact enough to fit in context.
- Limit product sales to top 50 and margin matrix to top 40 in prompts to avoid exceeding token limits.
- Always defensively parse AI-generated JSON — never trust that Claude returns exact types matching the schema. Use runtime coercion (`Number()`) for numeric fields and ensure arrays are actually arrays before calling `.toFixed()` or `.slice()` in UI components.

### Recharts TypeScript
- Recharts v3 Tooltip `formatter` prop types are strict. Don't annotate callback parameter types (e.g. `(val: number)`) — use `(val)` and cast with `Number(val)` inside the callback.

### Map Iteration
- `Map.values()` iterator requires `--downlevelIteration` or ES2015+ target in tsconfig. Wrap with `Array.from()` to avoid build errors.

## Phase 4

### @react-pdf/renderer
- `renderToBuffer()` returns a Node `Buffer`. The Web `Response` constructor does not accept `Buffer` directly — wrap with `new Uint8Array(buffer)`.
- `renderToBuffer()` expects `ReactElement<DocumentProps>`. When the component returns a `Document`, TypeScript may reject due to prop mismatch. Use `as any` with inline ESLint disable on the same line.
- `@react-pdf/renderer` depends on `yoga-layout` (native module). In Next.js standalone mode, it causes React error #185 at runtime because the bundler can't properly trace native dependencies. Fix: add `@react-pdf/renderer`, `@react-pdf/layout`, `@react-pdf/pdfkit`, and `@react-pdf/font` to `experimental.serverComponentsExternalPackages` in `next.config.mjs`. This makes Next.js copy them into the standalone output without bundling.

### ESLint Reminder
- ESLint `no-explicit-any` disable comments must be on the exact same line as the `any` keyword, not on the line above. Confirmed again in Phase 4 (same lesson from Phase 2).

## Phase 5

### Multi-store Architecture
- Per-store credentials stored in JSONB column on `stores` table. Service role only — never exposed to client via RLS.
- Download agent fetches store configs from API on startup, falls back to env vars for backward compatibility.
- Uploader passes `store_id` in FormData so upload endpoints can route data to the correct store.

### TikTok Business API
- TikTok API v1.3 uses `Access-Token` header (not Bearer token like Meta).
- Campaign list and reporting are separate endpoints — must fetch campaign names first, then join with report data by campaign_id.
- Report endpoint uses `dimensions` and `metrics` as JSON-encoded query params.

### Anomaly Detection
- Use 7-day rolling average as baseline, require at least 3 days of data to avoid false positives on new stores.
- Detection runs on yesterday's data (not today) due to POS data ingestion delay.
- UNIQUE constraint on `(store_id, alert_type, created_at::date)` prevents duplicate alerts per day using a cast expression — requires parenthesized expression in the constraint.

### Cloudbeds API
- `hotel_guest_mappings` table needed a UNIQUE constraint on `(store_id, hotel_booking_id)` for upsert — was missing in Phase 1 schema, added in migration 006.
- Phone normalization critical: Taiwan mobile numbers may come as +886, 886, or 09xx — normalize to 09xx format for matching.

## Phase 6

### Excel Export
- Use `exceljs` (not `xlsx`) for server-side Excel generation — it has better streaming support and TypeScript types.
- `ExcelJS.Workbook.xlsx.writeBuffer()` returns an `ArrayBuffer` — wrap with `Buffer.from()` before passing to `Response`.
- Always validate date range server-side (max 366 days) to prevent memory issues with large exports.

### Mobile Layout
- Bottom tab bar needs `pb-20` (bottom padding) on main content to prevent overlap with fixed tab bar.
- `typeof window !== 'undefined'` check needed when accessing `window.innerWidth` in chart height defaults — SSR will fail otherwise.
- Touch target minimum 44×44px: use `min-w-[44px] min-h-[44px]` on all interactive elements.

### Dynamic Imports
- `next/dynamic` with `{ ssr: false }` is needed for Recharts components in dynamically imported expansion charts — prevents hydration mismatches from window-dependent height calculations.

### Weekly Digest
- Resend SDK `emails.send` accepts array of emails in `to` field — no need to loop per recipient.
- `date-fns` `startOfWeek` with `{ weekStartsOn: 1 }` gives Monday — default is Sunday.

### Playwright Download Agent
- eat365 (eats365pos.com) requires MFA on every new browser session. Must save session via `storageState` after manual MFA, then reuse the session JSON file for subsequent runs.
- eat365 login page uses `div.sign-in-btn` (not `button[type="submit"]`), username field is `#username`, password is `#password`.
- eat365 report URLs accept date params directly: `&startDate=YYYY-MM-DD+00:00&endDate=YYYY-MM-DD+23:59` — no need to interact with the readonly date picker UI.
- eat365 Transaction Report page is protected by Cloudflare Turnstile (bot protection). Cannot be automated — all API endpoints for this report return Turnstile redirect. Other 3 reports (Sales Summary, Hourly Sales, Sales by Item) work fine.
- eat365 date input fields are `readonly` — cannot use `page.fill()`. Use URL params instead.
- Ocard (crm.ocard.co) login uses `input[name="acc"]` and `input[name="pwd"]`, submit button is `button:has-text("登入")`.
- Ocard sidebar nav items are outside viewport in headless mode. Use direct page URLs (e.g. `https://crm.ocard.co/Dashboard`) instead of clicking sidebar links.
- Ocard date range picker uses jQuery `daterangepicker` plugin. Set dates via `$('input[name="range"]').data('daterangepicker').setStartDate()` in `page.evaluate()` rather than interacting with the picker UI.
- Ocard analysis pages (會員招募, 顧客消費, RFM) are on a different domain (`console.ocard.co`) but share the session cookie with `crm.ocard.co`.
- Ocard 儀表板 xlsx "明細" sheet has header at row 2 (0-indexed row 1), data from row 3 (0-indexed row 2). Parser must start loop at index 2, not 3.
- Upload API endpoints require middleware bypass — added `/api/upload` to `publicPaths` in middleware.ts so the agent can POST without Supabase Auth session.
- Use `waitUntil: 'domcontentloaded'` with optional `waitForLoadState('networkidle').catch(() => {})` instead of `waitUntil: 'networkidle'` alone — some pages never reach networkidle due to analytics/tracking scripts.
- `DEFAULT_STORE_ID` must match the actual `stores` table record. The placeholder UUID `00000000-...` was used in migrations to seed data but the real store got a random UUID (`36d016c4-...`). If API queries return empty, check store_id mismatch first — foreign key constraints on upload and empty dashboard queries are both symptoms of this.
- Download agent renames files to `{type}_{YYYY-MM-DD}.ext`, but upload routes extract dates from the original eat365 filename pattern (`\d{8}\d{4}-`). Renamed files don't match → fallback to `new Date()` → all data gets today's date. Fix: pass date explicitly via FormData `date` field from agent to upload API.

### Meta Ads API
- `idx_ad_campaigns_meta_dedup` unique index was on `(store_id, platform, campaign_id)` without `date` — caused duplicate key errors when syncing the same campaign across multiple days. Fix: include `date` in the index → `(store_id, date, platform, campaign_id)`.
- Meta API data has ~24h delay. Default sync target should be yesterday, not today.
- Batch sync (date range) should cap at 90 days to avoid excessive API calls and timeouts.

### Deployment (Zeabur) — Uncommitted Changes
- Zeabur deploys from git, not local files. If local changes aren't committed and pushed, the remote build uses stale code. Always verify uncommitted changes (`git status`) before troubleshooting Zeabur build failures — the fix may already exist locally but hasn't been pushed.

### Weather Integration
- CWA observation API (`O-A0001-001`) returns real-time temperature, not daily max/min — `temp_high` and `temp_low` will be the same value. To get true high/low, would need the daily climate report API (`C-B0024-001`).
- CWA API doesn't support historical queries — can only sync current/recent data. Historical backfill requires a different API endpoint or manual CSV import from CWA website.
- `weather_code` column is always null in current sync logic; weather classification (sunny/rainy/typhoon) is derived at runtime from `description` text via `weatherUtils.getWeatherType()`.
- When adding weather overlays to Recharts ComposedChart, dual Y-axes require explicit `yAxisId` on ALL chart elements (bars, lines, reference lines) — omitting it causes silent render failures.
- `CWA_API_KEY` in `.env.local` was commented out — weather sync returns null without it. Check env config before debugging empty weather_daily table.

### LINE Messaging API Broadcast
- LINE Messaging API broadcast endpoint (`/v2/bot/message/broadcast`) sends to ALL friends — no user ID needed. Different from push endpoint which requires individual `to` user ID.
- Broadcast API returns `200 {}` on success with empty body — don't try to parse response JSON for data.
- `LINE_CHANNEL_ACCESS_TOKEN` for broadcast bot is different from the one used for alert push notifications. Keep them separate in env config.

### Alert Notifications — LINE to Email Migration
- Replaced `lineNotifier.ts` (LINE push to single user) with `emailNotifier.ts` (Resend email to configurable recipients).
- Alert email recipients are stored in `alert_settings` table (per-store, `TEXT[]` column for email list) — not derived from `users` table roles.
- `Array.from(new Set(...))` instead of `[...new Set(...)]` to avoid TypeScript `downlevelIteration` errors when target < ES2015.

### Ocard CSV Parser — Key Name Mismatches
- Ocard CSV uses **sectioned format** (section headers like `期間新會員性別分析` followed by tables), not flat key-value pairs. Duplicate keys like `未知` appear in both gender and age sections — must use section-aware parsing.
- Gender keys: actual CSV uses `男性`/`女性`, not `男`/`女`.
- Age ranges differ from original spec: actual Ocard buckets are `0歲 - 18歲`, `19歲 - 22歲`, `23歲 - 29歲`, `30歲 - 39歲`, `40歲 - 49歲`, `50歲 - 59歲`, `60歲以上` — not the 19-25/26-30/31-35 ranges originally assumed.
- Channel keys: `Ocard App 招募` + `Ocard App 掃碼` (two entries), not just `Ocard App`.
- Period dates come from explicit `取樣開始日期`/`取樣結束日期` rows, not embedded in a combined string.
- **Lesson**: Always verify parser keys against actual exported CSV files before writing parsers. Don't assume format from documentation alone.
