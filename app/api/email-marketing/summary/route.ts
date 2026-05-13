import { NextRequest } from 'next/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { createServerSupabase } from '@/lib/supabase/server'

function daysAgo(d: number): string {
  const dt = new Date(Date.now() - d * 86400000 + 7 * 3600000)
  return dt.toISOString()
}

function isoDate(input: string | null | undefined): string | null {
  if (!input) return null
  const d = new Date(input)
  if (!Number.isFinite(d.getTime())) return null
  // Shift to HCMC (UTC+7) before slicing the date — keeps daily buckets aligned to local day
  return new Date(d.getTime() + 7 * 3600000).toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const storeId = getStoreId(searchParams)
  const days = Math.max(7, Math.min(365, Number(searchParams.get('days') ?? 90)))
  const limit = Math.max(1, Math.min(200, Number(searchParams.get('limit') ?? 20)))
  const offset = Math.max(0, Number(searchParams.get('offset') ?? 0))

  const supabase = await createServerSupabase()
  const since = daysAgo(days)

  const { data: campaigns, error: campErr, count } = await supabase
    .from('email_campaigns')
    .select(
      'id, ghl_campaign_id, name, sent_at, sends, deliveries, opens, clicks, unsubscribes, bounces, open_rate, ctr',
      { count: 'exact' },
    )
    .eq('store_id', storeId)
    .gte('sent_at', since)
    .order('sent_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + limit - 1)
  if (campErr) return apiError(campErr.message, 500)

  // Pull all campaigns in window (no limit) for chart/funnel aggregates so charts don't change with pagination
  const { data: allInWindow, error: allErr } = await supabase
    .from('email_campaigns')
    .select('id, name, sent_at, sends, deliveries, opens, clicks, unsubscribes, bounces')
    .eq('store_id', storeId)
    .gte('sent_at', since)
    .order('sent_at', { ascending: false, nullsFirst: false })
  if (allErr) return apiError(allErr.message, 500)

  const { data: bookings, error: bookErr } = await supabase
    .from('email_bookings')
    .select('campaign_id', { count: 'exact' })
    .eq('store_id', storeId)
  if (bookErr) return apiError(bookErr.message, 500)

  const bookingsByCampaign = new Map<string, number>()
  for (const row of bookings ?? []) {
    const cid = row.campaign_id as string
    bookingsByCampaign.set(cid, (bookingsByCampaign.get(cid) ?? 0) + 1)
  }

  const enrichedCampaigns = (campaigns ?? []).map((c) => ({
    ...c,
    attributed_bookings: bookingsByCampaign.get(c.id as string) ?? 0,
  }))

  const funnel = (allInWindow ?? []).reduce(
    (acc, c) => {
      acc.sends += c.sends ?? 0
      acc.deliveries += c.deliveries ?? 0
      acc.opens += c.opens ?? 0
      acc.clicks += c.clicks ?? 0
      acc.unsubscribes += c.unsubscribes ?? 0
      acc.bounces += c.bounces ?? 0
      return acc
    },
    { sends: 0, deliveries: 0, opens: 0, clicks: 0, unsubscribes: 0, bounces: 0 },
  )

  const avgOpenRate =
    funnel.deliveries > 0 ? Math.round((funnel.opens / funnel.deliveries) * 10000) / 100 : null
  const avgCtr =
    funnel.deliveries > 0 ? Math.round((funnel.clicks / funnel.deliveries) * 10000) / 100 : null

  // Group by send-date (HCMC local day) for the time-series chart
  const dailyMap = new Map<string, { date: string; sends: number; opens: number; clicks: number }>()
  for (const c of allInWindow ?? []) {
    const date = isoDate(c.sent_at as string | null)
    if (!date) continue
    const cur = dailyMap.get(date) ?? { date, sends: 0, opens: 0, clicks: 0 }
    cur.sends += c.sends ?? 0
    cur.opens += c.opens ?? 0
    cur.clicks += c.clicks ?? 0
    dailyMap.set(date, cur)
  }
  const timeseries = Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date))

  const topCampaigns = (allInWindow ?? [])
    .filter((c) => (c.deliveries ?? 0) > 0)
    .map((c) => ({
      id: c.id as string,
      name: c.name as string,
      sent_at: c.sent_at as string | null,
      sends: c.sends ?? 0,
      opens: c.opens ?? 0,
      clicks: c.clicks ?? 0,
      open_rate:
        (c.deliveries ?? 0) > 0
          ? Math.round(((c.opens ?? 0) / (c.deliveries as number)) * 10000) / 100
          : null,
    }))
    .sort((a, b) => (b.open_rate ?? 0) - (a.open_rate ?? 0))
    .slice(0, 5)

  return apiSuccess({
    days,
    kpis: {
      campaigns_sent: count ?? campaigns?.length ?? 0,
      avg_open_rate: avgOpenRate,
      avg_ctr: avgCtr,
      attributed_bookings: bookings?.length ?? 0,
    },
    funnel,
    timeseries,
    top_campaigns: topCampaigns,
    campaigns: enrichedCampaigns,
    pagination: {
      total: count ?? 0,
      offset,
      limit,
    },
  })
}
