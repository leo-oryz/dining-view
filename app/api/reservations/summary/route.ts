import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

// Aggregate reservation metrics for a store + date range.
// Returns KPIs, country/status/source breakdowns, and daily trend.
//
// Query: ?from=YYYY-MM-DD&to=YYYY-MM-DD&store_id=<uuid>
// Dates are interpreted as local Asia/Ho_Chi_Minh days.

const APP_TZ_OFFSET = '+07:00'

interface Row {
  reserved_at: string
  party_size: number
  status: string
  source_channel: string | null
  guest_country: string | null
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const from = searchParams.get('from')
    const to = searchParams.get('to')
    if (!from || !to) return apiError('from and to are required', 400)

    const supabase = createServiceClient()

    const fromTs = `${from}T00:00:00${APP_TZ_OFFSET}`
    const toTs = `${to}T23:59:59${APP_TZ_OFFSET}`

    const { data, error } = await supabase
      .from('reservations')
      .select('reserved_at, party_size, status, source_channel, guest_country')
      .eq('store_id', storeId)
      .gte('reserved_at', fromTs)
      .lte('reserved_at', toTs)
      .limit(20000)

    if (error) return apiError(error.message, 500)

    const rows = (data ?? []) as Row[]
    const total = rows.length
    const covers = rows.reduce((s, r) => s + (r.party_size || 0), 0)
    const cancelled = rows.filter((r) => r.status === 'cancelled').length
    const noShow = rows.filter((r) => r.status === 'no_show').length
    const avgParty = total > 0 ? Math.round((covers / total) * 100) / 100 : 0

    const byStatus = bucketCount(rows, (r) => r.status || 'unknown')
    const bySource = bucketCount(rows, (r) => r.source_channel || 'unknown')
    const byCountry = bucketCount(rows, (r) => r.guest_country || 'unknown')

    const localCount = rows.filter((r) => r.guest_country === 'VN').length
    const touristCount = rows.filter(
      (r) => r.guest_country && r.guest_country !== 'VN'
    ).length
    const unknownCountry = total - localCount - touristCount

    // Daily trend in VN local time
    const trend = new Map<string, { date: string; reservations: number; covers: number }>()
    for (const r of rows) {
      const d = new Date(r.reserved_at)
      const vn = new Date(d.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10)
      const cur = trend.get(vn) ?? { date: vn, reservations: 0, covers: 0 }
      cur.reservations += 1
      cur.covers += r.party_size || 0
      trend.set(vn, cur)
    }
    const daily = Array.from(trend.values()).sort((a, b) => a.date.localeCompare(b.date))

    return apiSuccess({
      kpis: {
        total,
        covers,
        avg_party_size: avgParty,
        no_show_rate: total > 0 ? noShow / total : 0,
        cancellation_rate: total > 0 ? cancelled / total : 0,
        no_show_count: noShow,
        cancelled_count: cancelled,
      },
      by_status: byStatus,
      by_source: bySource,
      by_country: byCountry,
      local_vs_tourist: {
        local: localCount,
        tourist: touristCount,
        unknown: unknownCountry,
      },
      daily,
    })
  } catch (err) {
    return apiError(err instanceof Error ? err.message : 'Internal error', 500)
  }
}

function bucketCount<T>(rows: T[], key: (r: T) => string) {
  const map = new Map<string, number>()
  for (const r of rows) {
    const k = key(r)
    map.set(k, (map.get(k) ?? 0) + 1)
  }
  return Array.from(map.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
}
