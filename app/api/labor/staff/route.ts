import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)

    const supabase = createServiceClient()

    // Fetch active staff
    const { data: staffList, error: staffErr } = await supabase
      .from('staff')
      .select('id, employee_id, name, name_en, employment_type, hourly_rate, monthly_salary, is_active')
      .eq('store_id', storeId)
      .eq('is_active', true)
      .order('employee_id')

    if (staffErr) return apiError(staffErr.message, 500)

    // Fetch current month shifts for each staff
    const now = new Date()
    const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
    const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, '0')}`

    const { data: shifts } = await supabase
      .from('staff_shifts')
      .select('staff_id, actual_hours, labor_cost, is_day_off')
      .eq('store_id', storeId)
      .gte('date', monthStart)
      .lte('date', monthEnd)

    // Fetch revenue for the month
    const { data: salesData } = await supabase
      .from('daily_sales')
      .select('net_sales')
      .eq('store_id', storeId)
      .gte('date', monthStart)
      .lte('date', monthEnd)

    const totalRevenue = (salesData || []).reduce((s, r) => s + (Number(r.net_sales) || 0), 0)

    // Aggregate per staff
    const staffAgg = new Map<string, {
      totalHours: number
      overtimeHours: number
      totalCost: number
      hasCost: boolean
    }>()

    for (const s of shifts || []) {
      const agg = staffAgg.get(s.staff_id) || { totalHours: 0, overtimeHours: 0, totalCost: 0, hasCost: false }
      if (!s.is_day_off) {
        agg.totalHours += Number(s.actual_hours) || 0
      }
      if (s.labor_cost != null) {
        agg.totalCost += Number(s.labor_cost)
        agg.hasCost = true
      }
      staffAgg.set(s.staff_id, agg)
    }

    const result = (staffList || []).map(s => {
      const agg = staffAgg.get(s.id)
      const totalHours = agg?.totalHours || 0
      return {
        ...s,
        month_hours: Math.round(totalHours * 100) / 100,
        overtime_hours: Math.max(0, totalHours - 176), // rough monthly standard
        month_cost: agg?.hasCost ? Math.round(agg.totalCost * 100) / 100 : null,
        revenue_per_hour: totalHours > 0
          ? Math.round((totalRevenue / (staffList || []).reduce((sum, st) => {
              const a = staffAgg.get(st.id)
              return sum + (a?.totalHours || 0)
            }, 0)) * totalHours / totalHours * 100) / 100
          : null,
      }
    })

    // Recalculate revenue_per_hour correctly: total_revenue / total_all_hours * individual proportion
    const totalAllHours = (staffList || []).reduce((sum, s) => {
      const agg = staffAgg.get(s.id)
      return sum + (agg?.totalHours || 0)
    }, 0)

    const finalResult = result.map(s => ({
      ...s,
      revenue_per_hour: s.month_hours > 0 && totalAllHours > 0
        ? Math.round((totalRevenue / totalAllHours) * 100) / 100
        : null,
    }))

    return apiSuccess(finalResult)
  } catch {
    return apiError('Internal server error', 500)
  }
}
