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

    // Aggregate ad metrics by date
    const dailyAds = new Map<string, { spend: number; clicks: number; impressions: number }>()
    for (const a of adsRes.data || []) {
      const existing = dailyAds.get(a.date) || { spend: 0, clicks: 0, impressions: 0 }
      existing.spend += a.spend || 0
      existing.clicks += a.clicks || 0
      existing.impressions += a.impressions || 0
      dailyAds.set(a.date, existing)
    }

    // Build sales lookup
    const salesByDate = new Map<string, number>()
    for (const s of salesRes.data || []) {
      salesByDate.set(s.date, s.net_sales)
    }

    // Merge all dates from both ad_campaigns and daily_sales
    const allDates = new Set([...dailyAds.keys(), ...salesByDate.keys()])
    const correlation = Array.from(allDates).map((date) => {
      const agg = dailyAds.get(date)
      return {
        date,
        ad_spend: agg?.spend ?? 0,
        ad_clicks: agg?.clicks ?? 0,
        ad_impressions: agg?.impressions ?? 0,
        revenue: salesByDate.get(date) ?? null,
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
