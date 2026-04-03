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
