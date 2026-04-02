import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const startDate = params.get('start_date')
    const endDate = params.get('end_date')

    if (!startDate || !endDate) {
      return apiError('start_date and end_date are required', 400)
    }

    const supabase = createServiceClient()

    // Fetch all stores
    const { data: stores, error: storesError } = await supabase
      .from('stores')
      .select('id, name')
      .order('name')

    if (storesError) return apiError(storesError.message, 500)

    // Fetch daily sales for all stores in date range
    const { data: salesData, error: salesError } = await supabase
      .from('daily_sales')
      .select('store_id, net_sales, guests, avg_spending, table_turnover_rate, new_members, member_visits, total_members')
      .gte('date', startDate)
      .lte('date', endDate)

    if (salesError) return apiError(salesError.message, 500)

    // Also calculate previous period for deltas
    const dayCount = Math.ceil((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24)) + 1
    const prevEnd = new Date(new Date(startDate).getTime() - 1000 * 60 * 60 * 24)
    const prevStart = new Date(prevEnd.getTime() - (dayCount - 1) * 1000 * 60 * 60 * 24)
    const prevStartStr = prevStart.toISOString().split('T')[0]
    const prevEndStr = prevEnd.toISOString().split('T')[0]

    const { data: prevSalesData } = await supabase
      .from('daily_sales')
      .select('store_id, net_sales, guests, avg_spending, table_turnover_rate, new_members, member_visits')
      .gte('date', prevStartStr)
      .lte('date', prevEndStr)

    // Aggregate per store
    const aggregate = (rows: typeof salesData, storeId: string) => {
      const storeRows = (rows || []).filter(r => r.store_id === storeId)
      if (storeRows.length === 0) return null
      const sum = (field: string) => storeRows.reduce((s, r) => s + (Number((r as Record<string, unknown>)[field]) || 0), 0)
      const avg = (field: string) => {
        const vals = storeRows.filter(r => (r as Record<string, unknown>)[field] != null)
        return vals.length > 0 ? vals.reduce((s, r) => s + (Number((r as Record<string, unknown>)[field]) || 0), 0) / vals.length : 0
      }
      const latestMembers = storeRows.reduce((latest, r) => {
        return Number(r.total_members) > Number(latest.total_members) ? r : latest
      }, storeRows[0])

      return {
        revenue_total: sum('net_sales'),
        guest_count: sum('guests'),
        avg_spend_per_guest: avg('avg_spending'),
        table_turnover_rate: avg('table_turnover_rate'),
        member_new: sum('new_members'),
        returning_customer_ratio: sum('member_visits') > 0 && sum('guests') > 0
          ? (sum('member_visits') / sum('guests'))
          : 0,
        total_members: Number(latestMembers?.total_members) || 0,
      }
    }

    const storeComparisons = (stores || []).map(store => {
      const current = aggregate(salesData, store.id)
      const prev = aggregate(prevSalesData || [], store.id)

      const delta = (cur: number, prv: number) =>
        prv > 0 ? ((cur - prv) / prv) * 100 : null

      return {
        store_id: store.id,
        store_name: store.name,
        current,
        deltas: current && prev ? {
          revenue_total: delta(current.revenue_total, prev.revenue_total),
          guest_count: delta(current.guest_count, prev.guest_count),
          avg_spend_per_guest: delta(current.avg_spend_per_guest, prev.avg_spend_per_guest),
          table_turnover_rate: delta(current.table_turnover_rate, prev.table_turnover_rate),
          member_new: delta(current.member_new, prev.member_new),
          returning_customer_ratio: delta(current.returning_customer_ratio, prev.returning_customer_ratio),
        } : null,
      }
    })

    return apiSuccess({
      period: { start_date: startDate, end_date: endDate },
      prev_period: { start_date: prevStartStr, end_date: prevEndStr },
      stores: storeComparisons,
    })
  } catch {
    return apiError('Internal server error', 500)
  }
}
