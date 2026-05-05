/**
 * Manual Google sync script — runs GSC + GA4 sync directly
 * bypassing the Next.js API route.
 *
 * Usage: npx tsx scripts/manual-google-sync.ts
 */
import { resolve } from 'path'
import { readFileSync } from 'fs'
import { google } from 'googleapis'
import { createClient } from '@supabase/supabase-js'

// Load .env.local
const envPath = resolve(__dirname, '../.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const idx = trimmed.indexOf('=')
  if (idx === -1) continue
  const key = trimmed.slice(0, idx)
  let val = trimmed.slice(idx + 1)
  if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
    val = val.slice(1, -1)
  }
  if (!process.env[key]) process.env[key] = val
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

function getGscAuth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/webmasters.readonly'],
  })
}

function getGa4Auth() {
  return new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    scopes: ['https://www.googleapis.com/auth/analytics.readonly'],
  })
}

function toDateStr(d: Date) { return d.toISOString().slice(0, 10) }

async function main() {
  console.log('=== Manual Google Sync ===')
  console.log(`Time: ${new Date().toISOString()}`)

  // Get store
  const { data: stores } = await supabase
    .from('stores')
    .select('id')
    .eq('is_active', true)

  if (!stores?.length) {
    console.error('No active stores found')
    process.exit(1)
  }
  const storeId = stores[0].id
  console.log(`Store: ${storeId}`)

  const today = new Date()

  // --- GSC Sync ---
  console.log('\n--- GSC Sync ---')
  const gscEnd = new Date(today)
  gscEnd.setDate(gscEnd.getDate() - 3)
  const gscStart = new Date(gscEnd)
  gscStart.setDate(gscStart.getDate() - 30) // Last 30 days

  const gscSd = toDateStr(gscStart)
  const gscEd = toDateStr(gscEnd)
  console.log(`Fetching GSC: ${gscSd} to ${gscEd}`)

  try {
    const searchconsole = google.searchconsole({ version: 'v1', auth: getGscAuth() })
    const res = await searchconsole.searchanalytics.query({
      siteUrl: process.env.GSC_SITE_URL!,
      requestBody: {
        startDate: gscSd,
        endDate: gscEd,
        dimensions: ['query', 'date'],
        rowLimit: 25000,
      },
    })

    const apiRows = res.data.rows || []
    console.log(`API returned ${apiRows.length} rows`)

    if (apiRows.length > 0) {
      const gscData = apiRows.map((row) => ({
        store_id: storeId,
        date: row.keys![1] || row.keys![0],
        query: row.keys![1] ? row.keys![0] : row.keys![0],
        clicks: row.clicks || 0,
        impressions: row.impressions || 0,
        ctr: row.ctr || 0,
        position: row.position || 0,
      }))

      // Deduplicate
      const seen = new Set<string>()
      const deduped = gscData.filter((r) => {
        const key = `${r.store_id}|${r.date}|${r.query}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      const { error } = await supabase
        .from('gsc_brand_search')
        .upsert(deduped, { onConflict: 'store_id,date,query' })

      if (error) {
        console.error('GSC upsert error:', error.message)
      } else {
        const dates = Array.from(new Set(deduped.map(r => r.date))).sort()
        console.log(`GSC synced ${deduped.length} rows, dates: ${dates[0]} to ${dates[dates.length - 1]}`)
      }
    }
  } catch (err: any) {
    console.error('GSC Error:', err.message)
  }

  // --- GA4 Sync ---
  console.log('\n--- GA4 Sync ---')
  const ga4End = new Date(today)
  ga4End.setDate(ga4End.getDate() - 1)
  const ga4Start = new Date(ga4End)
  ga4Start.setDate(ga4Start.getDate() - 14) // Last 14 days

  const ga4Sd = toDateStr(ga4Start)
  const ga4Ed = toDateStr(ga4End)
  console.log(`Fetching GA4: ${ga4Sd} to ${ga4Ed}`)

  try {
    const analyticsData = google.analyticsdata({ version: 'v1beta', auth: getGa4Auth() })
    const res = await analyticsData.properties.runReport({
      property: `properties/${process.env.GA4_PROPERTY_ID}`,
      requestBody: {
        dateRanges: [{ startDate: ga4Sd, endDate: ga4Ed }],
        dimensions: [
          { name: 'date' },
          { name: 'eventName' },
          { name: 'pagePath' },
          { name: 'sessionSource' },
          { name: 'sessionMedium' },
        ],
        metrics: [
          { name: 'eventCount' },
          { name: 'totalUsers' },
          { name: 'newUsers' },
          { name: 'sessions' },
        ],
        limit: '100000',
      },
    })

    const apiRows = res.data.rows || []
    console.log(`API returned ${apiRows.length} rows`)

    if (apiRows.length > 0) {
      const ga4Data = apiRows.map((row) => {
        const dims = row.dimensionValues || []
        const mets = row.metricValues || []
        const dateRaw = dims[0]?.value || ''
        const formattedDate = dateRaw.length === 8
          ? `${dateRaw.slice(0, 4)}-${dateRaw.slice(4, 6)}-${dateRaw.slice(6, 8)}`
          : dateRaw
        return {
          store_id: storeId,
          date: formattedDate,
          event_name: dims[1]?.value || '',
          page_path: dims[2]?.value || '',
          source: dims[3]?.value || null,
          medium: dims[4]?.value || null,
          event_count: parseInt(mets[0]?.value || '0'),
          user_count: parseInt(mets[1]?.value || '0'),
          new_users: parseInt(mets[2]?.value || '0'),
          sessions: parseInt(mets[3]?.value || '0'),
        }
      })

      // Deduplicate
      const seen = new Set<string>()
      const deduped = ga4Data.filter((r) => {
        const key = `${r.store_id}|${r.date}|${r.event_name}|${r.page_path}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      // Delete existing + insert fresh
      const dates = Array.from(new Set(deduped.map(r => r.date))).sort()
      const { error: delErr } = await supabase
        .from('ga4_events')
        .delete()
        .eq('store_id', storeId)
        .gte('date', dates[0])
        .lte('date', dates[dates.length - 1])

      if (delErr) {
        console.error('GA4 delete error:', delErr.message)
      } else {
        const { error: insErr } = await supabase
          .from('ga4_events')
          .insert(deduped)
        if (insErr) {
          console.error('GA4 insert error:', insErr.message)
        } else {
          console.log(`GA4 synced ${deduped.length} rows, dates: ${dates[0]} to ${dates[dates.length - 1]}`)
        }
      }
    }
  } catch (err: any) {
    console.error('GA4 Error:', err.message)
  }

  // --- Conversion Recalculation ---
  console.log('\n--- Conversion Recalculation ---')
  const eventName = process.env.GA4_JOIN_MEMBER_EVENT_NAME || 'join_member_click'

  // Get all GA4 dates we just synced
  const { data: ga4Dates } = await supabase
    .from('ga4_events')
    .select('date')
    .eq('store_id', storeId)
    .eq('event_name', eventName)
    .gte('date', toDateStr(new Date(today.getTime() - 30 * 86400000)))

  const uniqueDates = Array.from(new Set((ga4Dates || []).map(r => r.date))).sort()
  console.log(`Recalculating conversion for ${uniqueDates.length} dates`)

  for (const date of uniqueDates) {
    const { data: ga4Data } = await supabase
      .from('ga4_events')
      .select('event_count')
      .eq('store_id', storeId)
      .eq('date', date)
      .eq('event_name', eventName)

    const ga4Clicks = ga4Data?.reduce((sum, row) => sum + (row.event_count || 0), 0) || 0

    const { data: salesData } = await supabase
      .from('daily_sales')
      .select('new_members')
      .eq('store_id', storeId)
      .eq('date', date)
      .single()

    const newMembers = salesData?.new_members || 0
    const conversionRate = ga4Clicks > 0 ? newMembers / ga4Clicks : 0

    await supabase
      .from('member_conversion_daily')
      .upsert({
        store_id: storeId,
        date,
        ga4_clicks: ga4Clicks,
        new_members: newMembers,
        conversion_rate: conversionRate,
      }, { onConflict: 'store_id,date' })
  }

  console.log(`Conversion recalculated for dates: ${uniqueDates[0]} to ${uniqueDates[uniqueDates.length - 1]}`)

  console.log('\n=== Sync Complete ===')
}

main()
