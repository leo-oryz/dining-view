import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchBrandSearch } from '@/lib/google/gscClient'
import { fetchEvents } from '@/lib/google/ga4Client'
import { recalculateConversion } from '@/lib/google/conversionCalc'
import { tryGetStoreCredentials } from '@/lib/integrations/credentials'

export const maxDuration = 300

type StoreResult = Record<string, string>
type CronResults = {
  stores: Record<string, StoreResult>
  weather: string
}

export async function GET(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', timestamp: new Date().toISOString() },
      { status: 401 }
    )
  }

  const supabase = createServiceClient()
  const today = new Date()
  const baseUrl = getBaseUrl(request)

  const { data: stores } = await supabase
    .from('stores')
    .select('id, name')
    .eq('is_active', true)

  if (!stores || stores.length === 0) {
    return NextResponse.json({
      success: false, data: null, error: 'No active stores',
      timestamp: new Date().toISOString(),
    }, { status: 400 })
  }

  // Date windows shared across stores
  const gscEnd = new Date(today)
  gscEnd.setDate(gscEnd.getDate() - 3)
  const gscStart = new Date(gscEnd)
  gscStart.setDate(gscStart.getDate() - 14)
  const ga4End = new Date(today)
  ga4End.setDate(ga4End.getDate() - 1)
  const ga4Start = new Date(ga4End)
  ga4Start.setDate(ga4Start.getDate() - 7)
  const targetDate = ga4End.toISOString().slice(0, 10)

  const results: CronResults = { stores: {}, weather: '' }

  for (const store of stores) {
    const storeId = store.id
    const r: StoreResult = {}
    results.stores[store.name] = r

    // GSC (per-store)
    const gscCreds = await tryGetStoreCredentials(supabase, storeId, 'gsc')
    if (!gscCreds) {
      r.gsc = 'skipped: no creds'
    } else try {
      const gscRows = await fetchBrandSearch(
        gscCreds,
        gscStart.toISOString().slice(0, 10),
        gscEnd.toISOString().slice(0, 10)
      )
      if (gscRows.length > 0) {
        const seen = new Set<string>()
        const gscData = gscRows
          .map((row) => ({
            store_id: storeId, date: row.date, query: row.query,
            clicks: row.clicks, impressions: row.impressions,
            ctr: row.ctr, position: row.position,
          }))
          .filter((row) => {
            const key = `${row.store_id}|${row.date}|${row.query}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })
        const { error } = await supabase
          .from('gsc_brand_search')
          .upsert(gscData, { onConflict: 'store_id,date,query' })
        r.gsc = error ? `Error: ${error.message}` : `${gscData.length} rows`
      } else {
        r.gsc = '0 rows'
      }
    } catch (err) {
      r.gsc = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
    }

    // GA4 (per-store)
    const affectedDates: string[] = []
    const ga4Creds = await tryGetStoreCredentials(supabase, storeId, 'ga4')
    if (!ga4Creds) {
      r.ga4 = 'skipped: no creds'
    } else try {
      const ga4Rows = await fetchEvents(
        ga4Creds,
        ga4Start.toISOString().slice(0, 10),
        ga4End.toISOString().slice(0, 10)
      )
      if (ga4Rows.length > 0) {
        const seen = new Set<string>()
        const ga4Data = ga4Rows
          .map((row) => ({
            store_id: storeId, date: row.date,
            event_name: row.event_name, event_count: row.event_count,
            user_count: row.user_count, new_users: row.new_users,
            sessions: row.sessions, page_path: row.page_path || '',
            source: row.source, medium: row.medium,
          }))
          .filter((row) => {
            const key = `${row.store_id}|${row.date}|${row.event_name}|${row.page_path}`
            if (seen.has(key)) return false
            seen.add(key)
            return true
          })

        const dates = Array.from(new Set(ga4Data.map((d) => d.date))).sort()
        await supabase
          .from('ga4_events')
          .delete()
          .eq('store_id', storeId)
          .gte('date', dates[0])
          .lte('date', dates[dates.length - 1])

        const { error } = await supabase.from('ga4_events').insert(ga4Data)
        r.ga4 = error ? `Error: ${error.message}` : `${ga4Data.length} rows`
        ga4Data.forEach((d) => { if (!affectedDates.includes(d.date)) affectedDates.push(d.date) })
      } else {
        r.ga4 = '0 rows'
      }
    } catch (err) {
      r.ga4 = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
    }

    // Conversion recalculation (per-store)
    try {
      if (affectedDates.length > 0) {
        await recalculateConversion(supabase, storeId, affectedDates)
        r.conversion = `${affectedDates.length} dates`
      } else {
        r.conversion = 'skipped'
      }
    } catch (err) {
      r.conversion = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
    }

    // Meta Ads sync (per-store, body param)
    try {
      const metaRes = await fetch(`${baseUrl}/api/sync/meta-ads`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          store_id: storeId,
          start_date: targetDate,
          end_date: targetDate,
        }),
      })
      const metaJson = await metaRes.json()
      r.meta_ads = metaJson.success ? `${metaJson.data.synced} rows` : `Error: ${metaJson.error}`
    } catch (err) {
      r.meta_ads = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
    }

    // LINE OA stats sync (per-store, query param)
    try {
      const lineRes = await fetch(`${baseUrl}/api/line/sync?store_id=${storeId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const lineJson = await lineRes.json()
      r.line = lineJson.success
        ? `friends: ${lineJson.data.friendCountUpdated}, broadcasts: ${lineJson.data.broadcastsUpdated}`
        : `Error: ${lineJson.error}`
    } catch (err) {
      r.line = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
    }

    // Google Reviews sync (per-store, query param)
    try {
      const reviewsRes = await fetch(`${baseUrl}/api/reviews/sync?store_id=${storeId}`, { method: 'POST' })
      const reviewsJson = await reviewsRes.json()
      r.reviews = reviewsJson.success
        ? `${reviewsJson.data?.new_reviews ?? 0} new`
        : `Error: ${reviewsJson.error}`
    } catch (err) {
      r.reviews = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
    }
  }

  // Weather sync (once — endpoint already iterates all stores internally)
  try {
    const weatherRes = await fetch(`${baseUrl}/api/weather/sync`, { method: 'POST' })
    const weatherJson = await weatherRes.json()
    results.weather = weatherJson.success ? 'ok' : `Error: ${weatherJson.error}`
  } catch (err) {
    results.weather = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }

  console.log(`[cron/daily] ${new Date().toISOString()}`, JSON.stringify(results))

  return NextResponse.json({
    success: true,
    data: results,
    error: null,
    timestamp: new Date().toISOString(),
  })
}

function getBaseUrl(request: NextRequest) {
  const host = request.headers.get('host') || 'localhost:3000'
  const proto = host.includes('localhost') ? 'http' : 'https'
  return `${proto}://${host}`
}
