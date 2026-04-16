import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

type OrderRow = {
  date: string
  order_type: string
  time: string
  item_amount: number
  item_quantity: number | null
  guest_count: number | null
  source: string
}

async function fetchPaginated(
  supabase: ReturnType<typeof createServiceClient>,
  storeId: string,
  startDate: string,
  endDate: string,
  source: string,
  excludeDates?: Set<string>
): Promise<{ rows: OrderRow[]; error: string | null }> {
  const PAGE = 1000
  const rows: OrderRow[] = []
  let from = 0

  while (true) {
    const { data, error } = await supabase
      .from('order_items')
      .select('date,order_type,time,item_amount,item_quantity,guest_count,source')
      .eq('store_id', storeId)
      .eq('item_name', '__order__')
      .eq('source', source)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: true })
      .order('time', { ascending: true })
      .range(from, from + PAGE - 1)
    if (error) return { rows: [], error: error.message }

    if (excludeDates && excludeDates.size > 0) {
      rows.push(...(data || []).filter((r) => !excludeDates.has(r.date)))
    } else {
      rows.push(...(data || []))
    }

    if (!data || data.length < PAGE) break
    from += PAGE
  }

  return { rows, error: null }
}

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

    // Strategy: fetch daily-closing first (preferred source, fewer rows per date).
    // Then only fetch eat365 transaction rows for dates NOT covered by daily-closing.
    const { rows: dcRows, error: dcErr } = await fetchPaginated(
      supabase, storeId, startDate, endDate, 'eat365-daily-closing'
    )
    if (dcErr) return apiError(dcErr, 500)

    const dcDates = new Set(dcRows.map((r) => r.date))

    // Only fetch eat365 rows for dates missing daily-closing data
    let allRows = dcRows
    const { rows: etRows, error: etErr } = await fetchPaginated(
      supabase, storeId, startDate, endDate, 'eat365', dcDates
    )
    if (etErr) return apiError(etErr, 500)
    allRows = [...dcRows, ...etRows]

    if (allRows.length === 0) {
      return apiSuccess({
        summary: {
          dine_in: { order_count: 0, guest_count: 0, revenue: 0, avg_spend: 0, order_pct: 0, revenue_pct: 0 },
          takeout: { order_count: 0, revenue: 0, avg_spend: 0, order_pct: 0, revenue_pct: 0 },
        },
        daily: [],
        hourly: [],
      })
    }

    // Aggregate
    let dineInOrders = 0, dineInRevenue = 0, dineInGuests = 0
    let takeoutOrders = 0, takeoutRevenue = 0

    const dailyMap = new Map<string, { dine_in_orders: number; takeout_orders: number; dine_in_revenue: number; takeout_revenue: number; dine_in_guests: number }>()
    const hourlyMap = new Map<number, { dine_in_orders: number; takeout_orders: number }>()

    for (const row of allRows) {
      const amount = Number(row.item_amount) || 0
      const guests = Number(row.guest_count) || 0
      // For daily-closing synthetic rows, item_quantity holds the real order count
      // for that 30-min slot. Real transaction rows have one row per order.
      const orderCount = row.source === 'eat365-daily-closing'
        ? Math.max(1, Number(row.item_quantity) || 1)
        : 1
      const isDineIn = row.order_type === 'Dine-in'

      if (isDineIn) {
        dineInOrders += orderCount
        dineInRevenue += amount
        dineInGuests += guests
      } else {
        takeoutOrders += orderCount
        takeoutRevenue += amount
      }

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
          if (isDineIn) h.dine_in_orders += orderCount
          else h.takeout_orders += orderCount
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

    const daily = Array.from(dailyMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, d]) => ({ date, ...d }))

    const hourly = Array.from(hourlyMap.entries())
      .sort(([a], [b]) => a - b)
      .map(([hour, h]) => ({ hour, ...h }))

    return apiSuccess({ summary, daily, hourly })
  } catch {
    return apiError('Internal server error', 500)
  }
}
