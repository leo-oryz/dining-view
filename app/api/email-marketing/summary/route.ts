import { NextRequest } from 'next/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { createServerSupabase } from '@/lib/supabase/server'

function daysAgo(d: number): string {
  const dt = new Date(Date.now() - d * 86400000 + 7 * 3600000)
  return dt.toISOString()
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

  const totals = (campaigns ?? []).reduce(
    (acc, c) => {
      acc.sends += c.sends ?? 0
      acc.deliveries += c.deliveries ?? 0
      acc.opens += c.opens ?? 0
      acc.clicks += c.clicks ?? 0
      return acc
    },
    { sends: 0, deliveries: 0, opens: 0, clicks: 0 },
  )

  const avgOpenRate =
    totals.deliveries > 0 ? Math.round((totals.opens / totals.deliveries) * 10000) / 100 : null
  const avgCtr =
    totals.deliveries > 0 ? Math.round((totals.clicks / totals.deliveries) * 10000) / 100 : null

  return apiSuccess({
    days,
    kpis: {
      campaigns_sent: count ?? campaigns?.length ?? 0,
      avg_open_rate: avgOpenRate,
      avg_ctr: avgCtr,
      attributed_bookings: bookings?.length ?? 0,
    },
    campaigns: enrichedCampaigns,
    pagination: {
      total: count ?? 0,
      offset,
      limit,
    },
  })
}
