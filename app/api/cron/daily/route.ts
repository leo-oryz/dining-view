import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchBrandSearch } from '@/lib/google/gscClient'
import { fetchEvents } from '@/lib/google/ga4Client'
import { recalculateConversion } from '@/lib/google/conversionCalc'

export const maxDuration = 300

export async function GET(request: NextRequest) {
  // Verify cron secret
  const secret = request.headers.get('x-cron-secret') || request.nextUrl.searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json(
      { success: false, error: 'Unauthorized', timestamp: new Date().toISOString() },
      { status: 401 }
    )
  }

  const results: Record<string, string> = {}
  const supabase = createServiceClient()
  const today = new Date()

  // Get default store
  const { data: stores } = await supabase
    .from('stores')
    .select('id')
    .eq('is_active', true)

  if (!stores || stores.length === 0) {
    return NextResponse.json({
      success: false, data: null, error: 'No active stores',
      timestamp: new Date().toISOString(),
    }, { status: 400 })
  }

  const storeId = stores[0].id

  // 1. Google Sync (GSC + GA4 + Conversion)
  // GSC: last 14 days (overlap for updates)
  const gscEnd = new Date(today)
  gscEnd.setDate(gscEnd.getDate() - 3)
  const gscStart = new Date(gscEnd)
  gscStart.setDate(gscStart.getDate() - 14)

  try {
    const gscRows = await fetchBrandSearch(
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
      results.gsc = error ? `Error: ${error.message}` : `${gscData.length} rows`
    } else {
      results.gsc = '0 rows'
    }
  } catch (err) {
    results.gsc = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }

  // GA4: last 7 days
  const ga4End = new Date(today)
  ga4End.setDate(ga4End.getDate() - 1)
  const ga4Start = new Date(ga4End)
  ga4Start.setDate(ga4Start.getDate() - 7)
  const affectedDates: string[] = []

  try {
    const ga4Rows = await fetchEvents(
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

      const dates = Array.from(new Set(ga4Data.map((r) => r.date))).sort()
      await supabase
        .from('ga4_events')
        .delete()
        .eq('store_id', storeId)
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1])

      const { error } = await supabase.from('ga4_events').insert(ga4Data)
      results.ga4 = error ? `Error: ${error.message}` : `${ga4Data.length} rows`
      ga4Data.forEach((r) => { if (!affectedDates.includes(r.date)) affectedDates.push(r.date) })
    } else {
      results.ga4 = '0 rows'
    }
  } catch (err) {
    results.ga4 = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }

  // Conversion recalculation
  try {
    if (affectedDates.length > 0) {
      await recalculateConversion(supabase, storeId, affectedDates)
      results.conversion = `${affectedDates.length} dates`
    } else {
      results.conversion = 'skipped'
    }
  } catch (err) {
    results.conversion = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }

  // 2. Meta Ads sync (yesterday — Meta data has ~24h delay)
  try {
    const metaRes = await fetch(`${getBaseUrl(request)}/api/sync/meta-ads`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        start_date: ga4End.toISOString().slice(0, 10),
        end_date: ga4End.toISOString().slice(0, 10),
      }),
    })
    const metaJson = await metaRes.json()
    results.meta_ads = metaJson.success ? `${metaJson.data.synced} rows` : `Error: ${metaJson.error}`
  } catch (err) {
    results.meta_ads = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }

  // 4. Weather sync
  try {
    const weatherRes = await fetch(`${getBaseUrl(request)}/api/weather/sync`, { method: 'POST' })
    const weatherJson = await weatherRes.json()
    results.weather = weatherJson.success ? 'ok' : `Error: ${weatherJson.error}`
  } catch (err) {
    results.weather = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }

  // 5. LINE OA stats sync (follower count + broadcast dispatch)
  try {
    const lineRes = await fetch(`${getBaseUrl(request)}/api/line/sync`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
    const lineJson = await lineRes.json()
    results.line = lineJson.success
      ? `friends: ${lineJson.data.friendCountUpdated}, broadcasts: ${lineJson.data.broadcastsUpdated}`
      : `Error: ${lineJson.error}`
  } catch (err) {
    results.line = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }

  // 6. Google Reviews sync (daily)
  try {
    const reviewsRes = await fetch(`${getBaseUrl(request)}/api/reviews/sync`, { method: 'POST' })
    const reviewsJson = await reviewsRes.json()
    results.reviews = reviewsJson.success
      ? `${reviewsJson.data?.new_reviews ?? 0} new`
      : `Error: ${reviewsJson.error}`
  } catch (err) {
    results.reviews = `Error: ${err instanceof Error ? err.message : 'Unknown'}`
  }

  console.log(`[cron/daily] ${new Date().toISOString()}`, results)

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
