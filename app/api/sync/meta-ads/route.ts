import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchMetaCampaigns } from '@/lib/ads/metaClient'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'
import { format, subDays, eachDayOfInterval, parseISO } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const storeId = body.store_id || DEFAULT_STORE_ID

    // Support date range: start_date / end_date, or single date, or default yesterday
    const startDate = body.start_date || body.date || format(subDays(new Date(), 1), 'yyyy-MM-dd')
    const endDate = body.end_date || body.date || format(subDays(new Date(), 1), 'yyyy-MM-dd')

    const days = eachDayOfInterval({
      start: parseISO(startDate),
      end: parseISO(endDate),
    }).map(d => format(d, 'yyyy-MM-dd'))

    // Cap at 90 days to avoid excessive API calls
    if (days.length > 90) {
      return apiError('Date range too large (max 90 days)', 400)
    }

    const supabase = createServiceClient()
    let totalSynced = 0

    for (const day of days) {
      const campaigns = await fetchMetaCampaigns(day)
      if (campaigns.length === 0) continue

      const rows = campaigns.map(c => ({
        store_id: storeId,
        ...c,
        cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
      }))

      const { error: dbError } = await supabase
        .from('ad_campaigns')
        .upsert(rows, { onConflict: 'store_id,date,platform,campaign_name' })

      if (dbError) return apiError(dbError.message, 500)

      totalSynced += campaigns.length
    }

    return apiSuccess({
      synced: totalSynced,
      start_date: startDate,
      end_date: endDate,
      days: days.length,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    if (msg.includes('auth error')) {
      return apiError(msg, 401)
    }
    return apiError(msg, 500)
  }
}
