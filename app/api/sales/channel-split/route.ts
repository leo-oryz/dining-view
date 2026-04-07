import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    if (!startDate || !endDate) {
      return apiError('start_date and end_date are required', 400)
    }

    const supabase = createServiceClient()

    // Fetch all __order__ rows from order_items for eat365
    // Paginate to bypass Supabase 1000-row default limit
    const PAGE_SIZE = 1000
    let allRows: { date: string; order_type: string; time: string; item_amount: number; guest_count: number }[] = []
    let from = 0
    while (true) {
      const { data: page, error: pageError } = await supabase
        .from('order_items')
        .select('date, order_type, time, item_amount, guest_count')
        .eq('store_id', storeId)
        .eq('item_name', '__order__')
        .eq('source', 'eat365')
        .gte('date', startDate)
        .lte('date', endDate)
        .range(from, from + PAGE_SIZE - 1)
      if (pageError) return apiError(pageError.message, 500)
      if (!page || page.length === 0) break
      allRows = allRows.concat(page)
      if (page.length < PAGE_SIZE) break
      from += PAGE_SIZE
    }

    const rows = allRows
    if (rows.length === 0) {
      return apiSuccess({
        summary: {
          dine_in: { order_count: 0, revenue: 0, avg_spend: 0, order_pct: 0, revenue_pct: 0 },
          takeout: { order_count: 0, revenue: 0, avg_spend: 0, order_pct: 0, revenue_pct: 0 },
        },
        daily: [],
        hourly: [],
      })
    }

    // Aggregate summary
    let dineInOrders = 0, dineInRevenue = 0
    let takeoutOrders = 0, takeoutRevenue = 0

    // Daily aggregation
    const dailyMap = new Map<string, { dine_in_orders: number; takeout_orders: number; dine_in_revenue: number; takeout_revenue: number }>()

    // Hourly aggregation
    const hourlyMap = new Map<number, { dine_in_orders: number; takeout_orders: number }>()

    for (const row of rows) {
      const amount = Number(row.item_amount) || 0
      const isDineIn = row.order_type === 'Dine-in'

      // Summary
      if (isDineIn) {
        dineInOrders++
        dineInRevenue += amount
      } else {
        takeoutOrders++
        takeoutRevenue += amount
      }

      // Daily
      const dateKey = row.date
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { dine_in_orders: 0, takeout_orders: 0, dine_in_revenue: 0, takeout_revenue: 0 })
      }
      const day = dailyMap.get(dateKey)!
      if (isDineIn) {
        day.dine_in_orders++
        day.dine_in_revenue += amount
      } else {
        day.takeout_orders++
        day.takeout_revenue += amount
      }

      // Hourly - parse hour from time field
      if (row.time) {
        const timeStr = String(row.time)
        // Try parsing various formats: "2025-01-01 14:30:00", "14:30:00", "14:30"
        const hourMatch = timeStr.match(/(\d{1,2}):\d{2}/)
        if (hourMatch) {
          // If format is "YYYY-MM-DD HH:MM", we want the hour part after the date
          const fullMatch = timeStr.match(/\d{4}-\d{2}-\d{2}\s+(\d{1,2}):\d{2}/)
          const hour = parseInt(fullMatch ? fullMatch[1] : hourMatch[1], 10)
          if (!hourlyMap.has(hour)) {
            hourlyMap.set(hour, { dine_in_orders: 0, takeout_orders: 0 })
          }
          const h = hourlyMap.get(hour)!
          if (isDineIn) {
            h.dine_in_orders++
          } else {
            h.takeout_orders++
          }
        }
      }
    }

    const totalOrders = dineInOrders + takeoutOrders
    const totalRevenue = dineInRevenue + takeoutRevenue

    const summary = {
      dine_in: {
        order_count: dineInOrders,
        revenue: Math.round(dineInRevenue),
        avg_spend: dineInOrders > 0 ? Math.round(dineInRevenue / dineInOrders) : 0,
        order_pct: totalOrders > 0 ? Math.round((dineInOrders / totalOrders) * 1000) / 10 : 0,
        revenue_pct: totalRevenue > 0 ? Math.round((dineInRevenue / totalRevenue) * 1000) / 10 : 0,
      },
      takeout: {
        order_count: takeoutOrders,
        revenue: Math.round(takeoutRevenue),
        avg_spend: takeoutOrders > 0 ? Math.round(takeoutRevenue / takeoutOrders) : 0,
        order_pct: totalOrders > 0 ? Math.round((takeoutOrders / totalOrders) * 1000) / 10 : 0,
        revenue_pct: totalRevenue > 0 ? Math.round((takeoutRevenue / totalRevenue) * 1000) / 10 : 0,
      },
    }

    // Sort daily by date
    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, ...d }))

    // Sort hourly by hour
    const hourly = Array.from(hourlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, h]) => ({ hour, ...h }))

    return apiSuccess({ summary, daily, hourly })
  } catch {
    return apiError('Internal server error', 500)
  }
}
