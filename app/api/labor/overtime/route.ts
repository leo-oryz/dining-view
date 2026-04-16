import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const from = searchParams.get('from')
    const to = searchParams.get('to')

    const supabase = createServiceClient()

    let query = supabase
      .from('staff_shifts')
      .select('staff_id, date, scheduled_hours, actual_hours, overtime_hours, labor_cost, staff!inner(name)')
      .eq('store_id', storeId)
      .gt('overtime_hours', 0)
      .order('overtime_hours', { ascending: false })

    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)

    const { data, error } = await query.limit(500)
    if (error) return apiError(error.message, 500)

    // Aggregate by staff
    const byStaff = new Map<string, { name: string; totalOvertime: number; dates: string[] }>()
    for (const row of data || []) {
      const staffRef = row.staff as unknown as { name: string }
      const staffName = staffRef?.name || 'Unknown'
      const agg = byStaff.get(row.staff_id) || { name: staffName, totalOvertime: 0, dates: [] }
      agg.totalOvertime += Number(row.overtime_hours) || 0
      agg.dates.push(row.date)
      byStaff.set(row.staff_id, agg)
    }

    // Top overtime staff
    const topStaff = Array.from(byStaff.entries())
      .map(([id, agg]) => ({
        staff_id: id,
        name: agg.name,
        total_overtime: Math.round(agg.totalOvertime * 100) / 100,
        overtime_days: agg.dates.length,
      }))
      .sort((a, b) => b.total_overtime - a.total_overtime)
      .slice(0, 10)

    // Overtime by date
    const byDate = new Map<string, number>()
    for (const row of data || []) {
      byDate.set(row.date, (byDate.get(row.date) || 0) + (Number(row.overtime_hours) || 0))
    }
    const dateBreakdown = Array.from(byDate.entries())
      .map(([date, hours]) => ({ date, overtime_hours: Math.round(hours * 100) / 100 }))
      .sort((a, b) => b.overtime_hours - a.overtime_hours)
      .slice(0, 10)

    return apiSuccess({ topStaff, dateBreakdown })
  } catch {
    return apiError('Internal server error', 500)
  }
}
