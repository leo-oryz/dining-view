import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { type WeatherDaily, isTyphoon } from '@/lib/weather/weatherUtils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)

    const supabase = createServiceClient()

    // Get all broadcasts (exclude auto-synced follower snapshots)
    const { data: broadcasts, error: bErr } = await supabase
      .from('line_broadcasts')
      .select('broadcast_date, title')
      .eq('store_id', storeId)
      .neq('title', '__follower_snapshot__')
      .order('broadcast_date', { ascending: false })
      .limit(20)

    if (bErr) return apiError(bErr.message, 500)
    if (!broadcasts || broadcasts.length === 0) return apiSuccess([])

    // Get daily sales for the relevant date range
    const dates = broadcasts.map((b) => b.broadcast_date)
    const earliest = dates[dates.length - 1]

    // Need 7 days before earliest + 3 days after latest
    const startDate = new Date(earliest)
    startDate.setDate(startDate.getDate() - 7)
    const endDate = new Date(dates[0])
    endDate.setDate(endDate.getDate() + 3)

    const { data: sales, error: sErr } = await supabase
      .from('daily_sales')
      .select('date, net_sales')
      .eq('store_id', storeId)
      .gte('date', startDate.toISOString().slice(0, 10))
      .lte('date', endDate.toISOString().slice(0, 10))
      .order('date')

    if (sErr) return apiError(sErr.message, 500)

    const salesMap = new Map<string, number>()
    for (const s of sales || []) {
      if (s.net_sales != null) salesMap.set(s.date, s.net_sales)
    }

    // Fetch weather data for typhoon filtering
    const { data: weatherRows } = await supabase
      .from('weather_daily')
      .select('date, description, precipitation')
      .eq('store_id', storeId)
      .gte('date', startDate.toISOString().slice(0, 10))
      .lte('date', endDate.toISOString().slice(0, 10))

    const weatherMap = new Map<string, WeatherDaily>()
    for (const w of weatherRows || []) {
      weatherMap.set(w.date, w as WeatherDaily)
    }

    const isTyphoonDate = (dateStr: string) => {
      const w = weatherMap.get(dateStr)
      return w ? isTyphoon(w) : false
    }

    // Calculate impact per broadcast (excluding typhoon days)
    const results = broadcasts.map((b) => {
      const bDate = new Date(b.broadcast_date)

      // 7-day rolling average before broadcast (excluding typhoon days)
      const beforeSales: number[] = []
      for (let i = 1; i <= 7; i++) {
        const d = new Date(bDate)
        d.setDate(d.getDate() - i)
        const key = d.toISOString().slice(0, 10)
        if (salesMap.has(key) && !isTyphoonDate(key)) {
          beforeSales.push(salesMap.get(key)!)
        }
      }
      const avgBefore = beforeSales.length > 0
        ? beforeSales.reduce((a, b) => a + b, 0) / beforeSales.length
        : 0

      // D+1, D+2, D+3
      const getDay = (offset: number) => {
        const d = new Date(bDate)
        d.setDate(d.getDate() + offset)
        return salesMap.get(d.toISOString().slice(0, 10)) ?? null
      }

      // Check if D+1~D+3 has typhoon days
      const hasTyphoonInWindow = [1, 2, 3].some(offset => {
        const d = new Date(bDate)
        d.setDate(d.getDate() + offset)
        return isTyphoonDate(d.toISOString().slice(0, 10))
      })

      return {
        broadcast_title: b.title,
        broadcast_date: b.broadcast_date,
        avg_before: avgBefore,
        d1_revenue: getDay(1),
        d2_revenue: getDay(2),
        d3_revenue: getDay(3),
        has_typhoon_warning: hasTyphoonInWindow,
      }
    })

    return apiSuccess(results)
  } catch {
    return apiError('Internal server error', 500)
  }
}
