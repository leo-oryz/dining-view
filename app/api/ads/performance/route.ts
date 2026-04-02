import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const supabase = createServiceClient()

    let adsQuery = supabase
      .from('ad_campaigns')
      .select('date, platform, campaign_name, impressions, clicks, spend, conversions, ctr, cpc, roas')
      .eq('store_id', storeId)
      .order('date', { ascending: false })

    if (startDate) adsQuery = adsQuery.gte('date', startDate)
    if (endDate) adsQuery = adsQuery.lte('date', endDate)

    let salesQuery = supabase
      .from('daily_sales')
      .select('date, net_sales')
      .eq('store_id', storeId)
      .order('date', { ascending: false })

    if (startDate) salesQuery = salesQuery.gte('date', startDate)
    if (endDate) salesQuery = salesQuery.lte('date', endDate)

    const [adsRes, salesRes] = await Promise.all([adsQuery, salesQuery])

    if (adsRes.error) return apiError(adsRes.error.message, 500)

    // Aggregate by date for correlation
    const dailyAds = new Map<string, { spend: number; clicks: number; impressions: number }>()
    for (const a of adsRes.data || []) {
      const existing = dailyAds.get(a.date) || { spend: 0, clicks: 0, impressions: 0 }
      existing.spend += a.spend || 0
      existing.clicks += a.clicks || 0
      existing.impressions += a.impressions || 0
      dailyAds.set(a.date, existing)
    }

    const correlation = Array.from(dailyAds.entries()).map(([date, agg]) => {
      const sale = (salesRes.data || []).find((s) => s.date === date)
      return {
        date,
        ad_spend: agg.spend,
        ad_clicks: agg.clicks,
        ad_impressions: agg.impressions,
        revenue: sale?.net_sales ?? null,
      }
    })

    return apiSuccess({
      campaigns: adsRes.data,
      correlation,
    })
  } catch {
    return apiError('Internal server error', 500)
  }
}
