// Pre-flight data completeness check for the weekly AI report pipeline.
// Scope: the POS / member sources required by the 3 weekly reports
// (attribution, star_products, retire_candidates). Labor data is
// intentionally out of scope — it is uploaded manually and used in a
// separate, on-demand labor_cost report.
//
// Output:
//   - stdout: human-readable summary
//   - file at $GITHUB_OUTPUT (or argv[2]): `missing_dates=YYYY-MM-DD,YYYY-MM-DD`
//
// Exit code:
//   0 — all dates complete OR caller should run backfill (we never fail here;
//       backfill is the next workflow step that decides what to do).

import { resolve } from 'path'
import { readFileSync, existsSync, appendFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve(__dirname, '../.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim(); if (!t || t.startsWith('#')) continue
    const i = t.indexOf('='); if (i === -1) continue
    const k = t.slice(0, i); let v = t.slice(i + 1)
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required')
  process.exit(2)
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

// Tables we require to be populated for every day in the analysis window.
// Each entry: table name + the date column.
const REQUIRED_SOURCES: { table: string; dateCol: string; label: string }[] = [
  { table: 'daily_sales',   dateCol: 'date', label: '日銷售總表' },
  { table: 'hourly_sales',  dateCol: 'date', label: '時段銷售' },
  { table: 'product_sales', dateCol: 'date', label: '商品銷售' },
  { table: 'order_items',   dateCol: 'date', label: '訂單明細' },
]

function lastWeekRange(today: Date): { start: string; end: string; days: string[] } {
  // Mon-Sun of the previous full week (matches lib/digest/weeklyAiReport.ts).
  const d = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()))
  const dow = d.getUTCDay() || 7  // Sun=0 → 7
  // This week's Monday:
  const thisMon = new Date(d); thisMon.setUTCDate(d.getUTCDate() - (dow - 1))
  const lastMon = new Date(thisMon); lastMon.setUTCDate(thisMon.getUTCDate() - 7)
  const lastSun = new Date(thisMon); lastSun.setUTCDate(thisMon.getUTCDate() - 1)

  const days: string[] = []
  for (let cur = new Date(lastMon); cur <= lastSun; cur.setUTCDate(cur.getUTCDate() + 1)) {
    days.push(cur.toISOString().slice(0, 10))
  }
  return {
    start: lastMon.toISOString().slice(0, 10),
    end: lastSun.toISOString().slice(0, 10),
    days,
  }
}

async function getActiveStores(): Promise<{ id: string; name: string }[]> {
  const { data, error } = await supabase.from('stores').select('id, name').eq('is_active', true)
  if (error) throw new Error(`stores fetch: ${error.message}`)
  return data || []
}

// A store counts as "operational" only if it has some daily_sales data in the
// 90 days before the window — otherwise it's a new store that hasn't been
// onboarded yet (no agent credentials, no manual upload). Reporting "missing"
// for such stores would force backfill to run for a store the agent can't even
// log in to, so we skip them.
async function isOperational(storeId: string, windowStart: string): Promise<boolean> {
  const lookbackStart = new Date(windowStart)
  lookbackStart.setDate(lookbackStart.getDate() - 90)
  const { count } = await supabase
    .from('daily_sales')
    .select('*', { count: 'exact', head: true })
    .eq('store_id', storeId)
    .gte('date', lookbackStart.toISOString().slice(0, 10))
    .lt('date', windowStart)
  return (count || 0) > 0
}

async function findMissing(storeId: string, days: string[]): Promise<{ source: string; missing: string[] }[]> {
  // One head-count query per (source, date). That's 4 sources × 7 days = 28
  // lightweight requests, but it sidesteps Supabase JS's 1000-row default cap
  // that broke an earlier "fetch all rows then dedupe by date" approach.
  const result: { source: string; missing: string[] }[] = []
  for (const src of REQUIRED_SOURCES) {
    const missing: string[] = []
    for (const d of days) {
      const { count, error } = await supabase
        .from(src.table)
        .select('*', { count: 'exact', head: true })
        .eq('store_id', storeId)
        .eq(src.dateCol, d)
      if (error) {
        console.error(`  ! ${src.table} ${d}: ${error.message}`)
        continue
      }
      if ((count || 0) === 0) missing.push(d)
    }
    if (missing.length > 0) result.push({ source: src.table, missing })
  }
  return result
}

async function main() {
  const today = new Date()
  const { start, end, days } = lastWeekRange(today)
  console.log(`[check] Window: ${start} → ${end} (${days.length} days)`)

  const stores = await getActiveStores()
  if (stores.length === 0) { console.error('No active stores'); process.exit(2) }

  const allMissing = new Set<string>()
  const skippedStores: string[] = []
  for (const store of stores) {
    console.log(`\n[check] === ${store.name} (${store.id}) ===`)
    if (!(await isOperational(store.id, start))) {
      console.log(`  ⊘ skipped — no data in the 90 days before window (treated as not yet onboarded)`)
      skippedStores.push(store.name)
      continue
    }
    const gaps = await findMissing(store.id, days)
    if (gaps.length === 0) {
      console.log(`  ✓ all sources complete for ${days.length} days`)
      continue
    }
    for (const g of gaps) {
      console.log(`  ✗ ${g.source.padEnd(16)} missing: ${g.missing.join(', ')}`)
      g.missing.forEach((d) => allMissing.add(d))
    }
  }

  const missingDates = Array.from(allMissing).sort()
  console.log(`\n[check] Distinct missing dates across all stores: ${missingDates.length}`)
  if (missingDates.length > 0) console.log(`[check] → ${missingDates.join(', ')}`)

  // Emit GHA outputs
  const outFile = process.env.GITHUB_OUTPUT || process.argv[2]
  if (outFile) {
    appendFileSync(outFile, `missing_dates=${missingDates.join(',')}\n`)
    appendFileSync(outFile, `missing_count=${missingDates.length}\n`)
    appendFileSync(outFile, `window_start=${start}\n`)
    appendFileSync(outFile, `window_end=${end}\n`)
    console.log(`[check] wrote outputs to ${outFile}`)
  }
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
