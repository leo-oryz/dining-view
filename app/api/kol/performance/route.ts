import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { type WeatherDaily, isTyphoon } from '@/lib/weather/weatherUtils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const supabase = createServiceClient()

    // Fetch collaborations with posts
    let query = supabase
      .from('kol_collaborations')
      .select('*, kol_posts(*)')
      .eq('store_id', storeId)
      .order('collaboration_date', { ascending: false })

    if (startDate) query = query.gte('collaboration_date', startDate)
    if (endDate) query = query.lte('collaboration_date', endDate)

    const { data: collabs, error } = await query
    if (error) return apiError(error.message, 500)

    // For each collaboration, compute D+1~D+7 sales delta
    const performance = await Promise.all(
      (collabs || []).map(async (collab) => {
        const posts = collab.kol_posts || []
        const totalViews = posts.reduce((s: number, p: { views: number | null }) => s + (p.views || 0), 0)
        const totalLikes = posts.reduce((s: number, p: { likes: number | null }) => s + (p.likes || 0), 0)
        const totalComments = posts.reduce((s: number, p: { comments: number | null }) => s + (p.comments || 0), 0)
        const totalShares = posts.reduce((s: number, p: { shares: number | null }) => s + (p.shares || 0), 0)

        const totalEngagement = totalLikes + totalComments + totalShares
        const engagementRate = totalViews > 0
          ? totalEngagement / totalViews
          : null

        // D+1 ~ D+7 sales vs D-7 ~ D-1 baseline (excluding typhoon days)
        const collabDate = collab.collaboration_date
        const d1 = addDays(collabDate, 1)
        const d7 = addDays(collabDate, 7)
        const dMinus7 = addDays(collabDate, -7)
        const dMinus1 = addDays(collabDate, -1)

        const [afterRes, beforeRes, weatherRes] = await Promise.all([
          supabase
            .from('daily_sales')
            .select('date, net_sales')
            .eq('store_id', storeId)
            .gte('date', d1)
            .lte('date', d7),
          supabase
            .from('daily_sales')
            .select('date, net_sales')
            .eq('store_id', storeId)
            .gte('date', dMinus7)
            .lte('date', dMinus1),
          supabase
            .from('weather_daily')
            .select('date, description, precipitation')
            .eq('store_id', storeId)
            .gte('date', dMinus7)
            .lte('date', d7),
        ])

        // Build weather lookup for typhoon filtering
        const weatherMap = new Map<string, WeatherDaily>()
        for (const w of weatherRes.data || []) {
          weatherMap.set(w.date, w as WeatherDaily)
        }

        const isNonTyphoon = (row: { date: string }) => {
          const w = weatherMap.get(row.date)
          return !w || !isTyphoon(w)
        }

        const afterRows = (afterRes.data || []).filter(isNonTyphoon)
        const beforeRows = (beforeRes.data || []).filter(isNonTyphoon)

        const afterTotal = afterRows.reduce(
          (s: number, r: { net_sales: number | null }) => s + (r.net_sales || 0), 0
        )
        const beforeTotal = beforeRows.reduce(
          (s: number, r: { net_sales: number | null }) => s + (r.net_sales || 0), 0
        )
        const salesDelta = beforeTotal > 0
          ? ((afterTotal - beforeTotal) / beforeTotal) * 100
          : null

        // Check if D+1~D+3 has typhoon days for warning
        const hasTyphoonInWindow = [1, 2, 3].some(offset => {
          const d = addDays(collabDate, offset)
          const w = weatherMap.get(d)
          return w && isTyphoon(w)
        })

        const fee = collab.collaboration_fee || 0
        const roi = fee > 0 ? ((afterTotal - beforeTotal) / fee) * 100 : null

        return {
          id: collab.id,
          kol_name: collab.kol_name,
          kol_handle: collab.kol_handle,
          collaboration_date: collab.collaboration_date,
          featured_products: collab.featured_products,
          collaboration_fee: collab.collaboration_fee,
          fee_type: collab.fee_type,
          status: collab.status,
          platforms: Array.from(new Set(posts.map((p: { platform: string }) => p.platform))),
          total_views: totalViews,
          total_likes: totalLikes,
          total_comments: totalComments,
          total_shares: totalShares,
          engagement_rate: engagementRate,
          sales_delta_pct: salesDelta,
          roi,
          has_typhoon_warning: hasTyphoonInWindow,
          posts,
        }
      })
    )

    return apiSuccess(performance)
  } catch {
    return apiError('Internal server error', 500)
  }
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}
