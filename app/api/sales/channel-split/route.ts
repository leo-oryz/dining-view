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

const CHUNK_DAYS = 7
const PAGE = 1000
const MAX_CONCURRENCY = 4

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
): Promise<R[]> {
  const results: R[] = new Array(items.length)
  let next = 0
  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (true) {
      const i = next++
      if (i >= items.length) return
      results[i] = await worker(items[i])
    }
  })
  await Promise.all(runners)
  return results
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d)
  x.setUTCDate(x.getUTCDate() + n)
  return x
}

function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10)
}

// Fetches order-header rows in small date chunks, in parallel. Chunking keeps
// each query narrow enough that Postgres can satisfy it via the (store_id, date)
// index without hitting the statement timeout that deep OFFSET pagination
// triggered on YTD-sized ranges; parallelism then collapses wall-clock time to
// roughly the cost of one chunk regardless of range width.
async function fetchChunk(
  supabase: ReturnType<typeof createServiceClient>,
  storeId: string,
  cs: string,
  ce: string,
  source: string,
  keepDate?: (date: string) => boolean
): Promise<{ rows: OrderRow[]; error: string | null }> {
  const rows: OrderRow[] = []
  let from = 0
  while (true) {
    const { data, error } = await supabase
      .from('order_items')
      .select('date,order_type,time,item_amount,item_quantity,guest_count,source')
      .eq('store_id', storeId)
      .eq('item_name', '__order__')
      .eq('source', source)
      .gte('date', cs)
      .lte('date', ce)
      .range(from, from + PAGE - 1)
    if (error) return { rows: [], error: error.message }

    const batch = keepDate ? (data || []).filter((r) => keepDate(r.date)) : data || []
    rows.push(...batch)

    if (!data || data.length < PAGE) break
    from += PAGE
  }
  return { rows, error: null }
}

async function fetchByChunks(
  supabase: ReturnType<typeof createServiceClient>,
  storeId: string,
  startDate: string,
  endDate: string,
  source: string,
  keepDate?: (date: string) => boolean
): Promise<{ rows: OrderRow[]; error: string | null }> {
  const chunks: { cs: string; ce: string }[] = []
  const endD = new Date(endDate + 'T00:00:00Z')
  let cursor = new Date(startDate + 'T00:00:00Z')
  while (cursor <= endD) {
    const chunkEnd = addDays(cursor, CHUNK_DAYS - 1)
    const actualEnd = chunkEnd > endD ? endD : chunkEnd
    chunks.push({ cs: isoDate(cursor), ce: isoDate(actualEnd) })
    cursor = addDays(actualEnd, 1)
  }

  const results = await mapWithConcurrency(chunks, MAX_CONCURRENCY, (c) =>
    fetchChunk(supabase, storeId, c.cs, c.ce, source, keepDate)
  )
  const rows: OrderRow[] = []
  for (const r of results) {
    if (r.error) return { rows: [], error: r.error }
    rows.push(...r.rows)
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
    const { rows: dcRows, error: dcErr } = await fetchByChunks(
      supabase, storeId, startDate, endDate, 'eat365-daily-closing'
    )
    if (dcErr) return apiError(dcErr, 500)

    const dcDates = new Set(dcRows.map((r) => r.date))

    // Compute dates in range NOT covered by daily-closing. If empty, skip the
    // eat365 backfill fetch entirely — otherwise we'd waste tens of thousands
    // of rows of network/DB work just to filter them all out client-side.
    const missingDates: string[] = []
    const rangeEnd = new Date(endDate + 'T00:00:00Z')
    let c = new Date(startDate + 'T00:00:00Z')
    while (c <= rangeEnd) {
      const d = isoDate(c)
      if (!dcDates.has(d)) missingDates.push(d)
      c = addDays(c, 1)
    }

    let etRows: OrderRow[] = []
    if (missingDates.length > 0) {
      const missingSet = new Set(missingDates)
      const result = await fetchByChunks(
        supabase, storeId, missingDates[0], missingDates[missingDates.length - 1],
        'eat365', (date) => missingSet.has(date)
      )
      if (result.error) return apiError(result.error, 500)
      etRows = result.rows
    }

    const allRows = [...dcRows, ...etRows]

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
