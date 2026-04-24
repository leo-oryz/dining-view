import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'

/**
 * Cost ratio + analysis computed from payroll_records (ground truth).
 *
 * Response has three layers:
 *   1. per_month       — time series for trend charts
 *   2. aggregate       — single row for KPIs
 *   3. staff_analysis  — per-person roll-up across the range for outlier tables
 */
export async function GET(request: NextRequest) {
  try {
    // Payroll totals expose salary info — owners only.
    const session = await getSession()
    if (!session || session.role !== 'owner') {
      return apiError('Forbidden', 403)
    }

    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const fromStr = searchParams.get('from')
    const toStr = searchParams.get('to')
    if (!fromStr || !toStr) return apiError('from and to are required', 400)

    const supabase = createServiceClient()

    // Enumerate (year, month) pairs touched by [from, to]
    const from = new Date(fromStr)
    const to = new Date(toStr)
    const months: { year: number; month: number }[] = []
    let cur = new Date(from.getFullYear(), from.getMonth(), 1)
    const end = new Date(to.getFullYear(), to.getMonth(), 1)
    while (cur <= end) {
      months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 })
      cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
    }

    // Payroll row with staff JOIN lets us bucket by employment_type without
    // second-guessing job_title text.
    type PayrollRow = {
      staff_id: string
      total_payable: number
      actual_hours: number
      overtime_hours: number | null
      department: string | null
      job_title: string | null
      staff: { name: string; employment_type: string } | null
    }

    type MonthEntry = {
      year: number
      month: number
      total_payable: number | null
      total_revenue: number
      cost_ratio: number | null
      revenue_per_salary: number | null
      staff_count: number
      ft_payable: number
      pt_payable: number
      ft_count: number
      pt_count: number
      total_overtime_hours: number
      total_actual_hours: number
      ot_hours_ratio: number | null
      estimated_ot_premium: number
      department_breakdown: { department: string; total: number }[]
    }

    const perMonth: MonthEntry[] = []
    const monthsMissing: string[] = []
    const staffAgg = new Map<string, {
      name: string
      department: string | null
      employment_type: string
      total_payable: number
      total_hours: number
      total_overtime_hours: number
    }>()

    for (const { year, month } of months) {
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
      const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10)

      const { data: payrollRaw } = await supabase
        .from('payroll_records')
        .select('staff_id, total_payable, actual_hours, overtime_hours, department, job_title, staff:staff_id(name, employment_type)')
        .eq('store_id', storeId).eq('year', year).eq('month', month)

      const payroll = (payrollRaw || []) as unknown as PayrollRow[]

      const { data: sales } = await supabase
        .from('daily_sales')
        .select('net_sales')
        .eq('store_id', storeId).gte('date', monthStart).lte('date', monthEnd)

      const totalRevenue = (sales || []).reduce((s, r) => s + (Number(r.net_sales) || 0), 0)

      if (payroll.length === 0) {
        monthsMissing.push(`${year}-${String(month).padStart(2, '0')}`)
        perMonth.push({
          year, month,
          total_payable: null,
          total_revenue: totalRevenue,
          cost_ratio: null,
          revenue_per_salary: null,
          staff_count: 0,
          ft_payable: 0, pt_payable: 0, ft_count: 0, pt_count: 0,
          total_overtime_hours: 0, total_actual_hours: 0,
          ot_hours_ratio: null, estimated_ot_premium: 0,
          department_breakdown: [],
        })
        continue
      }

      let totalPayable = 0
      let ftPayable = 0, ftCount = 0
      let ptPayable = 0, ptCount = 0
      let totalActualHours = 0
      let totalOtHours = 0
      let estimatedOtPremium = 0
      const deptMap = new Map<string, number>()

      for (const r of payroll) {
        const pay = Number(r.total_payable) || 0
        const hours = Number(r.actual_hours) || 0
        const ot = Number(r.overtime_hours) || 0
        totalPayable += pay
        totalActualHours += hours
        totalOtHours += ot

        const type = r.staff?.employment_type || 'full_time'
        if (type === 'part_time') { ptPayable += pay; ptCount += 1 }
        else { ftPayable += pay; ftCount += 1 }

        const dept = r.department || '未分類'
        deptMap.set(dept, (deptMap.get(dept) || 0) + pay)

        // Overtime premium ≈ blended hourly × OT × 0.34 (the 1.34x extra portion).
        // Rough but answers "how much could scheduling save?" — use as upper bound estimate.
        if (hours > 0 && ot > 0) {
          const hourlyBlend = pay / hours
          estimatedOtPremium += hourlyBlend * ot * 0.34
        }

        // Accumulate per-staff totals for outlier table
        const prev = staffAgg.get(r.staff_id)
        if (prev) {
          prev.total_payable += pay
          prev.total_hours += hours
          prev.total_overtime_hours += ot
        } else {
          staffAgg.set(r.staff_id, {
            name: r.staff?.name || 'Unknown',
            department: r.department,
            employment_type: type,
            total_payable: pay,
            total_hours: hours,
            total_overtime_hours: ot,
          })
        }
      }

      perMonth.push({
        year, month,
        total_payable: Math.round(totalPayable * 100) / 100,
        total_revenue: totalRevenue,
        cost_ratio: totalRevenue > 0 ? Math.round((totalPayable / totalRevenue) * 10000) / 10000 : null,
        revenue_per_salary: totalPayable > 0 ? Math.round((totalRevenue / totalPayable) * 100) / 100 : null,
        staff_count: payroll.length,
        ft_payable: Math.round(ftPayable * 100) / 100,
        pt_payable: Math.round(ptPayable * 100) / 100,
        ft_count: ftCount,
        pt_count: ptCount,
        total_overtime_hours: Math.round(totalOtHours * 10) / 10,
        total_actual_hours: Math.round(totalActualHours * 10) / 10,
        ot_hours_ratio: totalActualHours > 0 ? Math.round((totalOtHours / totalActualHours) * 10000) / 10000 : null,
        estimated_ot_premium: Math.round(estimatedOtPremium),
        department_breakdown: Array.from(deptMap.entries())
          .map(([department, total]) => ({ department, total: Math.round(total * 100) / 100 }))
          .sort((a, b) => b.total - a.total),
      })
    }

    // Aggregate across months that DO have payroll
    const covered = perMonth.filter(m => m.total_payable != null)
    const aggTotalPayable = covered.reduce((s, m) => s + (m.total_payable || 0), 0)
    const aggTotalRevenue = covered.reduce((s, m) => s + m.total_revenue, 0)

    const aggregate = covered.length === 0 ? null : {
      total_payable: Math.round(aggTotalPayable * 100) / 100,
      total_revenue: aggTotalRevenue,
      cost_ratio: aggTotalRevenue > 0 ? Math.round((aggTotalPayable / aggTotalRevenue) * 10000) / 10000 : null,
      revenue_per_salary: aggTotalPayable > 0 ? Math.round((aggTotalRevenue / aggTotalPayable) * 100) / 100 : null,
      ft_payable: Math.round(covered.reduce((s, m) => s + m.ft_payable, 0) * 100) / 100,
      pt_payable: Math.round(covered.reduce((s, m) => s + m.pt_payable, 0) * 100) / 100,
      total_overtime_hours: Math.round(covered.reduce((s, m) => s + m.total_overtime_hours, 0) * 10) / 10,
      total_actual_hours: Math.round(covered.reduce((s, m) => s + m.total_actual_hours, 0) * 10) / 10,
      estimated_ot_premium: Math.round(covered.reduce((s, m) => s + m.estimated_ot_premium, 0)),
      months_covered: covered.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`),
    }

    // Per-staff roll-up: implied hourly = total_payable / total_hours
    const staffAnalysis = Array.from(staffAgg.entries()).map(([staff_id, a]) => {
      const impliedHourly = a.total_hours > 0 ? a.total_payable / a.total_hours : null
      return {
        staff_id,
        name: a.name,
        department: a.department,
        employment_type: a.employment_type,
        total_payable: Math.round(a.total_payable * 100) / 100,
        total_hours: Math.round(a.total_hours * 10) / 10,
        total_overtime_hours: Math.round(a.total_overtime_hours * 10) / 10,
        implied_hourly: impliedHourly != null ? Math.round(impliedHourly) : null,
      }
    })

    // Top OT staff (top 5 by OT hours)
    const topOt = [...staffAnalysis]
      .filter(s => s.total_overtime_hours > 0)
      .sort((a, b) => b.total_overtime_hours - a.total_overtime_hours)
      .slice(0, 5)

    return apiSuccess({
      per_month: perMonth,
      aggregate,
      staff_analysis: staffAnalysis,
      top_ot_staff: topOt,
      months_missing: monthsMissing,
    })
  } catch (err) {
    console.error('[payroll-cost] error:', err)
    return apiError('Internal server error', 500)
  }
}
