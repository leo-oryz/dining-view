// Weather sync — self-contained: Open-Meteo → Supabase via service role.
// Works locally (reads .env.local) and in GitHub Actions (env vars from secrets).
// Idempotent: upsert on (store_id, date) over a rolling 7-day window so any
// missed day in the window self-heals on the next run.
import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'
import { fetchHistoricalWeather } from '../lib/weather/openMeteoClient'

const envPath = resolve(__dirname, '../.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i)
    let v = t.slice(i + 1)
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

function daysAgo(n: number): string {
  const d = new Date()
  d.setUTCDate(d.getUTCDate() - n)
  return d.toISOString().slice(0, 10)
}

async function main() {
  const startDate = process.argv[2] || daysAgo(7)
  const endDate = process.argv[3] || daysAgo(0)

  console.log(`[weather-sync] window: ${startDate} → ${endDate}`)

  const { data: stores, error: storesErr } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)

  if (storesErr) throw storesErr
  if (!stores?.length) {
    console.log('[weather-sync] no active stores')
    return
  }

  const days = await fetchHistoricalWeather(startDate, endDate)
  if (!days.length) {
    console.error('[weather-sync] open-meteo returned 0 days')
    process.exit(1)
  }
  console.log(`[weather-sync] fetched ${days.length} days × ${stores.length} stores`)

  const rows = stores.flatMap((store) =>
    days.map((day) => ({
      store_id: store.id,
      date: day.date,
      temp_high: day.temp_high,
      temp_low: day.temp_low,
      humidity: day.humidity,
      precipitation: day.precipitation,
      weather_code: day.weather_code,
      description: day.description,
    }))
  )

  const batchSize = 500
  let upserted = 0
  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const { error } = await supabase
      .from('weather_daily')
      .upsert(batch, { onConflict: 'store_id,date' })
    if (error) throw error
    upserted += batch.length
  }

  console.log(`[weather-sync] upserted ${upserted} rows`)
}

main().catch((e) => {
  console.error('[weather-sync]', e)
  process.exit(1)
})
