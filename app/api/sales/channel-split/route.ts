import { NextRequest } from 'next/server'
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

    // Fetch all __order__ rows via paginated REST API (Supabase caps at 1000/request).
    // Two sources may populate this table:
    //   - 'eat365'                : per-order rows from manual Transaction Report uploads
    //   - 'eat365-daily-closing'  : per-30min synthetic rows from the Daily Closing JSON API
    //                                (each row carries item_quantity = real order count)
    // For dates where both exist, daily-closing wins.
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const baseUrl = `${supabaseUrl}/rest/v1/order_items?select=date,order_type,time,item_amount,item_quantity,guest_count,source&store_id=eq.${storeId}&item_name=eq.__order__&source=in.(eat365,eat365-daily-closing)&date=gte.${startDate}&date=lte.${endDate}&order=date.asc,time.asc`

    type OrderRow = { date: string; order_type: string; time: string; item_amount: number; item_quantity: number | null; guest_count: number | null; source: string }
    const rawRows: OrderRow[] = []
    let offset = 0
    const PAGE = 1000
    while (true) {
      const res = await fetch(`${baseUrl}&offset=${offset}&limit=${PAGE}`, {
        headers: {
          'apikey': serviceKey,
          'Authorization': `Bearer ${serviceKey}`,
        },
      })
      if (!res.ok) return apiError(`Failed to fetch order data: ${res.status}`, 500)
      const page = await res.json()
      rawRows.push(...page)
      if (page.length < PAGE) break
      offset += PAGE
    }

    // Pick a single source per date so the two ingestion paths don't double-count.
    const sourceByDate = new Map<string, string>()
    for (const r of rawRows) {
      const cur = sourceByDate.get(r.date)
      if (cur === 'eat365-daily-closing') continue
      if (r.source === 'eat365-daily-closing') sourceByDate.set(r.date, 'eat365-daily-closing')
      else if (!cur) sourceByDate.set(r.date, r.source)
    }
    const rows = rawRows.filter((r) => sourceByDate.get(r.date) === r.source)

    if (rows.length === 0) {
      return apiSuccess({
        summary: {
          dine_in: { order_count: 0, guest_count: 0, revenue: 0, avg_spend: 0, order_pct: 0, revenue_pct: 0 },
          takeout: { order_count: 0, revenue: 0, avg_spend: 0, order_pct: 0, revenue_pct: 0 },
        },
        daily: [],
        hourly: [],
      })
    }

    // Aggregate summary
    let dineInOrders = 0, dineInRevenue = 0, dineInGuests = 0
    let takeoutOrders = 0, takeoutRevenue = 0

    // Daily aggregation
    const dailyMap = new Map<string, { dine_in_orders: number; takeout_orders: number; dine_in_revenue: number; takeout_revenue: number; dine_in_guests: number }>()

    // Hourly aggregation
    const hourlyMap = new Map<number, { dine_in_orders: number; takeout_orders: number }>()

    for (const row of rows) {
      const amount = Number(row.item_amount) || 0
      const guests = Number(row.guest_count) || 0
      // For daily-closing synthetic rows, item_quantity holds the real order count
      // for that 30-min slot. Real transaction rows have one row per order, so
      // count them as 1 regardless of item_quantity (which there means line-item qty).
      const orderCount = row.source === 'eat365-daily-closing'
        ? Math.max(1, Number(row.item_quantity) || 1)
        : 1
      const isDineIn = row.order_type === 'Dine-in'

      // Summary
      if (isDineIn) {
        dineInOrders += orderCount
        dineInRevenue += amount
        dineInGuests += guests
      } else {
        takeoutOrders += orderCount
        takeoutRevenue += amount
      }

      // Daily
      const dateKey = row.date
      if (!dailyMap.has(dateKey)) {
        dailyMap.set(dateKey, { dine_in_orders: 0, takeout_orders: 0, dine_in_revenue: 0, takeout_revenue: 0, dine_in_guests: 0 })
      }
      const day = dailyMap.get(dateKey)!
      if (isDineIn) {
        day.dine_in_orders += orderCount
        day.dine_in_revenue += amount
        day.dine_in_guests += guests
      } else {
        day.takeout_orders += orderCount
        day.takeout_revenue += amount
      }

      // Hourly - parse hour from time field
      if (row.time) {
        const timeStr = String(row.time)
        const hourMatch = timeStr.match(/(\d{1,2}):\d{2}/)
        if (hourMatch) {
          const fullMatch = timeStr.match(/\d{4}-\d{2}-\d{2}\s+(\d{1,2}):\d{2}/)
          const hour = parseInt(fullMatch ? fullMatch[1] : hourMatch[1], 10)
          if (!hourlyMap.has(hour)) {
            hourlyMap.set(hour, { dine_in_orders: 0, takeout_orders: 0 })
          }
          const h = hourlyMap.get(hour)!
          if (isDineIn) {
            h.dine_in_orders += orderCount
          } else {
            h.takeout_orders += orderCount
          }
        }
      }
    }

    const totalOrders = dineInOrders + takeoutOrders
    const totalRevenue = dineInRevenue + takeoutRevenue

    const summary = {
      dine_in: {
        order_count: dineInOrders,
        guest_count: dineInGuests,
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
