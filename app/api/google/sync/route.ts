import { NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchBrandSearch } from '@/lib/google/gscClient'
import { fetchEvents } from '@/lib/google/ga4Client'
import { recalculateConversion } from '@/lib/google/conversionCalc'
import { tryGetStoreCredentials } from '@/lib/integrations/credentials'

type StoreResult = { gsc?: string; ga4?: string; conversion?: string }

export async function POST() {
  try {
    const supabase = createServiceClient()
    const today = new Date()

    const { data: stores } = await supabase
      .from('stores')
      .select('id, name')
      .eq('is_active', true)

    if (!stores || stores.length === 0) {
      return NextResponse.json({
        success: false,
        data: null,
        error: 'No active stores',
        timestamp: new Date().toISOString(),
      }, { status: 400 })
    }

    // Date windows shared across stores
    const gscEnd = new Date(today)
    gscEnd.setDate(gscEnd.getDate() - 3)
    const gscStart = new Date(gscEnd)
    gscStart.setDate(gscStart.getDate() - 180)
    const ga4End = new Date(today)
    ga4End.setDate(ga4End.getDate() - 1)
    const ga4Start = new Date(ga4End)
    ga4Start.setDate(ga4Start.getDate() - 180)

    const results: Record<string, StoreResult> = {}

    for (const store of stores) {
      const storeId = store.id
      const r: StoreResult = {}
      results[store.name] = r

      // GSC
      const gscCreds = await tryGetStoreCredentials(supabase, storeId, 'gsc')
      if (!gscCreds) {
        r.gsc = 'skipped: no GSC credentials for this store'
      } else try {
        const gscRows = await fetchBrandSearch(
          gscCreds,
          gscStart.toISOString().slice(0, 10),
          gscEnd.toISOString().slice(0, 10)
        )

        if (gscRows.length > 0) {
          const gscData = gscRows.map((row) => ({
            store_id: storeId,
            date: row.date,
            query: row.query,
            clicks: row.clicks,
            impressions: row.impressions,
            ctr: row.ctr,
            position: row.position,
          }))

          const seen = new Set<string>()
          const deduped = gscData.filter((row) => {
            const key = `${row.store_id}|${row.date}|${row.query}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })

          const { error } = await supabase
            .from('gsc_brand_search')
            .upsert(deduped, { onConflict: 'store_id,date,query' })

          r.gsc = error ? `Error: ${error.message}` : `${deduped.length} rows synced`
        } else {
          r.gsc = '0 rows'
        }
      } catch (err) {
        r.gsc = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
      }

      // GA4
      const affectedDates: string[] = []
      const ga4Creds = await tryGetStoreCredentials(supabase, storeId, 'ga4')
      if (!ga4Creds) {
        r.ga4 = 'skipped: no GA4 credentials for this store'
      } else try {
        const ga4Rows = await fetchEvents(
          ga4Creds,
          ga4Start.toISOString().slice(0, 10),
          ga4End.toISOString().slice(0, 10)
        )

        if (ga4Rows.length > 0) {
          const ga4Data = ga4Rows.map((row) => ({
            store_id: storeId,
            date: row.date,
            event_name: row.event_name,
            event_count: row.event_count,
            user_count: row.user_count,
            new_users: row.new_users,
            sessions: row.sessions,
            page_path: row.page_path || '',
            source: row.source,
            medium: row.medium,
          }))

          const seen = new Set<string>()
          const deduped = ga4Data.filter((row) => {
            const key = `${row.store_id}|${row.date}|${row.event_name}|${row.page_path}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })

          const dates = Array.from(new Set(deduped.map((d) => d.date))).sort()
          const { error: delErr } = await supabase
            .from('ga4_events')
            .delete()
            .eq('store_id', storeId)
            .gte('date', dates[0])
            .lte('date', dates[dates.length - 1])

          if (delErr) {
            r.ga4 = `Error: ${delErr.message}`
          } else {
            const { error: insErr } = await supabase
              .from('ga4_events')
              .insert(deduped)
            r.ga4 = insErr ? `Error: ${insErr.message}` : `${deduped.length} rows synced`
          }

          deduped.forEach((row) => {
            if (!affectedDates.includes(row.date)) affectedDates.push(row.date)
          })
        } else {
          r.ga4 = '0 rows'
        }
      } catch (err) {
        r.ga4 = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
      }

      // Conversion recalculation
      try {
        if (affectedDates.length > 0) {
          await recalculateConversion(supabase, storeId, affectedDates)
          r.conversion = `${affectedDates.length} dates recalculated`
        } else {
          r.conversion = 'No dates to recalculate'
        }
      } catch (err) {
        r.conversion = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
      }
    }

    return NextResponse.json({
      success: true,
      data: results,
      error: null,
      timestamp: new Date().toISOString(),
    })
  } catch (err) {
    console.error('[Google Sync]', err)
    return NextResponse.json({
      success: false,
      data: null,
      error: 'Internal server error',
      timestamp: new Date().toISOString(),
    }, { status: 500 })
  }
}
