import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * Labor cost context for AI analysis — gathered from payroll_records and
 * daily_sales across the months overlapping [periodStart, periodEnd].
 */
export interface LaborContext {
  periodStart: string
  periodEnd: string
  targetCostRatio: number
  perMonth: {
    label: string
    total_payable: number
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
    departments: { name: string; total: number; share_pct: number }[]
  }[]
  monthsMissing: string[]
  staffAnalysis: {
    name: string
    department: string | null
    employment_type: string
    total_payable: number
    total_hours: number
    total_overtime_hours: number
    implied_hourly: number | null
  }[]
  topOvertimeStaff: {
    name: string
    department: string | null
    total_hours: number
    total_overtime_hours: number
    implied_hourly: number | null
  }[]
}

export async function prepareLaborContext(
  supabase: SupabaseClient,
  storeId: string,
  periodStart: string,
  periodEnd: string,
): Promise<LaborContext> {
  const from = new Date(periodStart)
  const to = new Date(periodEnd)
  const months: { year: number; month: number }[] = []
  let cur = new Date(from.getFullYear(), from.getMonth(), 1)
  const end = new Date(to.getFullYear(), to.getMonth(), 1)
  while (cur <= end) {
    months.push({ year: cur.getFullYear(), month: cur.getMonth() + 1 })
    cur = new Date(cur.getFullYear(), cur.getMonth() + 1, 1)
  }

  const perMonth: LaborContext['perMonth'] = []
  const monthsMissing: string[] = []
  const staffAgg = new Map<string, LaborContext['staffAnalysis'][number]>()

  for (const { year, month } of months) {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
    const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10)
    const label = `${year}-${String(month).padStart(2, '0')}`

    const { data: payrollRaw } = await supabase
      .from('payroll_records')
      .select('staff_id, total_payable, actual_hours, overtime_hours, department, staff:staff_id(name, employment_type)')
      .eq('store_id', storeId).eq('year', year).eq('month', month)

    type Row = {
      staff_id: string
      total_payable: number
      actual_hours: number
      overtime_hours: number | null
      department: string | null
      staff: { name: string; employment_type: string } | null
    }
    const payroll = (payrollRaw || []) as unknown as Row[]

    const { data: sales } = await supabase
      .from('daily_sales')
      .select('net_sales')
      .eq('store_id', storeId).gte('date', monthStart).lte('date', monthEnd)

    const totalRevenue = (sales || []).reduce((s, r) => s + (Number(r.net_sales) || 0), 0)

    if (payroll.length === 0) {
      monthsMissing.push(label)
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

      if (hours > 0 && ot > 0) {
        estimatedOtPremium += (pay / hours) * ot * 0.34
      }

      const prev = staffAgg.get(r.staff_id)
      const name = r.staff?.name || 'Unknown'
      if (prev) {
        prev.total_payable += pay
        prev.total_hours += hours
        prev.total_overtime_hours += ot
      } else {
        staffAgg.set(r.staff_id, {
          name,
          department: r.department,
          employment_type: type,
          total_payable: pay,
          total_hours: hours,
          total_overtime_hours: ot,
          implied_hourly: null,
        })
      }
    }

    const departments = Array.from(deptMap.entries())
      .map(([name, total]) => ({
        name,
        total: Math.round(total),
        share_pct: totalPayable > 0 ? Math.round((total / totalPayable) * 1000) / 10 : 0,
      }))
      .sort((a, b) => b.total - a.total)

    perMonth.push({
      label,
      total_payable: Math.round(totalPayable),
      total_revenue: Math.round(totalRevenue),
      cost_ratio: totalRevenue > 0 ? Math.round((totalPayable / totalRevenue) * 10000) / 10000 : null,
      revenue_per_salary: totalPayable > 0 ? Math.round((totalRevenue / totalPayable) * 100) / 100 : null,
      staff_count: payroll.length,
      ft_payable: Math.round(ftPayable),
      pt_payable: Math.round(ptPayable),
      ft_count: ftCount,
      pt_count: ptCount,
      total_overtime_hours: Math.round(totalOtHours * 10) / 10,
      total_actual_hours: Math.round(totalActualHours * 10) / 10,
      ot_hours_ratio: totalActualHours > 0 ? Math.round((totalOtHours / totalActualHours) * 10000) / 10000 : null,
      estimated_ot_premium: Math.round(estimatedOtPremium),
      departments,
    })
  }

  // Finalize implied_hourly per staff across whole period
  const staffAnalysis: LaborContext['staffAnalysis'] = []
  for (const s of staffAgg.values()) {
    staffAnalysis.push({
      ...s,
      total_payable: Math.round(s.total_payable),
      total_hours: Math.round(s.total_hours * 10) / 10,
      total_overtime_hours: Math.round(s.total_overtime_hours * 10) / 10,
      implied_hourly: s.total_hours > 0 ? Math.round(s.total_payable / s.total_hours) : null,
    })
  }

  const topOvertimeStaff = [...staffAnalysis]
    .filter(s => s.total_overtime_hours > 0)
    .sort((a, b) => b.total_overtime_hours - a.total_overtime_hours)
    .slice(0, 5)
    .map(({ name, department, total_hours, total_overtime_hours, implied_hourly }) =>
      ({ name, department, total_hours, total_overtime_hours, implied_hourly }))

  return {
    periodStart,
    periodEnd,
    targetCostRatio: 0.30,
    perMonth,
    monthsMissing,
    staffAnalysis,
    topOvertimeStaff,
  }
}
