import { resolve } from 'path'
import { readFileSync, existsSync } from 'fs'

// Local dev: load .env.local. CI: env vars come from the workflow, no file needed.
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

import { createClient } from '@supabase/supabase-js'
import { fetchBrandSearch } from '../lib/google/gscClient'
import { fetchEvents } from '../lib/google/ga4Client'
import { recalculateConversion } from '../lib/google/conversionCalc'
import { tryGetStoreCredentials } from '../lib/integrations/credentials'

async function main() {
  const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const today = new Date()

  const { data: stores } = await supabase.from('stores').select('id, name').eq('is_active', true)
  if (!stores || stores.length === 0) throw new Error('no active stores')

  // GSC: end = today - 3, 180 days back
  const gscEnd = new Date(today); gscEnd.setDate(gscEnd.getDate() - 3)
  const gscStart = new Date(gscEnd); gscStart.setDate(gscStart.getDate() - 180)
  const gscS = gscStart.toISOString().slice(0, 10)
  const gscE = gscEnd.toISOString().slice(0, 10)

  // GA4: end = today - 1, 180 days back
  const ga4End = new Date(today); ga4End.setDate(ga4End.getDate() - 1)
  const ga4Start = new Date(ga4End); ga4Start.setDate(ga4Start.getDate() - 180)
  const ga4S = ga4Start.toISOString().slice(0, 10)
  const ga4E = ga4End.toISOString().slice(0, 10)

  for (const store of stores) {
    const storeId = store.id
    console.log(`\n=== ${store.name} (${storeId}) ===`)

    // GSC
    console.log(`[GSC] ${gscS} → ${gscE}`)
    const gscCreds = await tryGetStoreCredentials(supabase, storeId, 'gsc')
    if (!gscCreds) {
      console.log('[GSC] skipped: no creds for this store')
    } else {
      try {
        const rows = await fetchBrandSearch(gscCreds, gscS, gscE)
        console.log(`[GSC] fetched ${rows.length} rows`)
        if (rows.length) {
          const data = rows.map((r) => ({
            store_id: storeId, date: r.date, query: r.query,
            clicks: r.clicks, impressions: r.impressions, ctr: r.ctr, position: r.position,
          }))
          const seen = new Set<string>()
          const dedup = data.filter((r) => { const k = `${r.store_id}|${r.date}|${r.query}`; if (seen.has(k)) return false; seen.add(k); return true })
          const { error } = await supabase.from('gsc_brand_search').upsert(dedup, { onConflict: 'store_id,date,query' })
          console.log('[GSC]', error ? 'ERROR ' + error.message : `upserted ${dedup.length} rows`)
        }
      } catch (e: any) {
        console.error('[GSC] FAILED:', e.message)
      }
    }

    // GA4
    console.log(`[GA4] ${ga4S} → ${ga4E}`)
    const affectedDates: string[] = []
    const ga4Creds = await tryGetStoreCredentials(supabase, storeId, 'ga4')
    if (!ga4Creds) {
      console.log('[GA4] skipped: no creds for this store')
    } else {
      try {
        const rows = await fetchEvents(ga4Creds, ga4S, ga4E)
        console.log(`[GA4] fetched ${rows.length} rows`)
        if (rows.length) {
          const data = rows.map((r) => ({
            store_id: storeId, date: r.date, event_name: r.event_name,
            event_count: r.event_count, user_count: r.user_count, new_users: r.new_users,
            sessions: r.sessions, page_path: r.page_path || '',
            source: r.source, medium: r.medium,
          }))
          const seen = new Set<string>()
          const dedup = data.filter((r) => { const k = `${r.store_id}|${r.date}|${r.event_name}|${r.page_path}`; if (seen.has(k)) return false; seen.add(k); return true })
          const dates = Array.from(new Set(dedup.map((r) => r.date))).sort()
          const { error: delErr } = await supabase.from('ga4_events').delete().eq('store_id', storeId).gte('date', dates[0]).lte('date', dates[dates.length - 1])
          if (delErr) console.error('[GA4] delete error:', delErr.message)
          const { error: insErr } = await supabase.from('ga4_events').insert(dedup)
          console.log('[GA4]', insErr ? 'INSERT ERROR ' + insErr.message : `inserted ${dedup.length} rows`)
          dedup.forEach((r) => { if (!affectedDates.includes(r.date)) affectedDates.push(r.date) })
        }
      } catch (e: any) {
        console.error('[GA4] FAILED:', e.message)
      }
    }

    // conversion
    if (affectedDates.length > 0) {
      console.log(`[CONV] recalculating ${affectedDates.length} dates`)
      try { await recalculateConversion(supabase, storeId, affectedDates); console.log('[CONV] done') }
      catch (e: any) { console.error('[CONV] failed:', e.message) }
    }
  }
}
main().catch((e) => { console.error('FATAL:', e); process.exit(1) })
