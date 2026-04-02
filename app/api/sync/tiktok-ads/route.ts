import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchTikTokCampaigns } from '@/lib/ads/tiktokClient'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'
import { format, subDays } from 'date-fns'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))
    const storeId = body.store_id || DEFAULT_STORE_ID

    // Default: fetch previous day (data delay)
    const targetDate = body.date || format(subDays(new Date(), 1), 'yyyy-MM-dd')

    const campaigns = await fetchTikTokCampaigns(targetDate)

    if (campaigns.length === 0) {
      return apiSuccess({ synced: 0, date: targetDate, message: 'No campaign data for this date' })
    }

    const supabase = createServiceClient()

    const rows = campaigns.map(c => ({
      store_id: storeId,
      ...c,
      cpc: c.clicks > 0 ? c.spend / c.clicks : 0,
    }))

    const { error: dbError } = await supabase
      .from('ad_campaigns')
      .upsert(rows, { onConflict: 'store_id,date,platform,campaign_name' })

    if (dbError) return apiError(dbError.message, 500)

    return apiSuccess({ synced: campaigns.length, date: targetDate })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    if (msg.includes('auth error')) {
      return apiError(msg, 401)
    }
    return apiError(msg, 500)
  }
}
