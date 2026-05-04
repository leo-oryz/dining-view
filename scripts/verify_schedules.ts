import { readFileSync } from 'fs'
import { resolve } from 'path'
import { Client } from 'pg'
import { computeNextRunAt } from '../lib/digest/scheduling'

const envPath = resolve(__dirname, '../.env.local')
for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
  const t = line.trim(); if (!t || t.startsWith('#')) continue
  const i = t.indexOf('='); if (i === -1) continue
  const k = t.slice(0, i); let v = t.slice(i + 1)
  if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
  if (!process.env[k]) process.env[k] = v
}

;(async () => {
  const c = new Client({ connectionString: process.env.SUPABASE_DB_URL!, ssl: { rejectUnauthorized: false } })
  await c.connect()
  const { rows } = await c.query('SELECT * FROM report_schedules ORDER BY created_at')
  for (const r of rows) {
    if (!r.next_run_at) {
      const next = computeNextRunAt({
        frequency: r.frequency,
        day_of_week: r.day_of_week,
        day_of_month: r.day_of_month,
        send_hour: r.send_hour,
        send_minute: r.send_minute,
        timezone: r.timezone,
      })
      await c.query('UPDATE report_schedules SET next_run_at=$1 WHERE id=$2', [next.toISOString(), r.id])
      r.next_run_at = next.toISOString()
      console.log(`Backfilled next_run_at for "${r.name}":`, r.next_run_at)
    }
  }
  console.log('\nAll schedules:')
  for (const r of rows) {
    console.log(`- ${r.name} | ${r.frequency} dow=${r.day_of_week} dom=${r.day_of_month} ${r.send_hour}:${String(r.send_minute).padStart(2,'0')} ${r.timezone} | next=${r.next_run_at} | active=${r.is_active}`)
  }
  await c.end()
})()
