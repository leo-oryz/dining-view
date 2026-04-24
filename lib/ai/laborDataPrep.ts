import type { SupabaseClient } from '@supabase/supabase-js'

export interface LaborCostThresholds {
  targetCostRatio: number
  ptHealthyMin: number
  ptHealthyMax: number
  otMonthlyCap: number
  otQuarterlyCap: number
  ftLowThreshold: number
  ptHighThreshold: number
}

const DEFAULT_THRESHOLDS: LaborCostThresholds = {
  targetCostRatio: 0.30,
  ptHealthyMin: 0.30,
  ptHealthyMax: 0.40,
  otMonthlyCap: 46,
  otQuarterlyCap: 138,
  ftLowThreshold: 140,
  ptHighThreshold: 80,
}

async function loadThresholds(
  supabase: SupabaseClient,
  storeId: string,
): Promise<{ thresholds: LaborCostThresholds; businessContext: string | null }> {
  const { data } = await supabase
    .from('ai_analysis_config')
    .select('business_context, labor_target_cost_ratio, labor_pt_healthy_min, labor_pt_healthy_max, labor_ot_monthly_cap, labor_ot_quarterly_cap, labor_ft_low_threshold, labor_pt_high_threshold')
    .eq('store_id', storeId)
    .maybeSingle()

  if (!data) {
    return { thresholds: DEFAULT_THRESHOLDS, businessContext: null }
  }
  return {
    thresholds: {
      targetCostRatio: Number(data.labor_target_cost_ratio) || DEFAULT_THRESHOLDS.targetCostRatio,
      ptHealthyMin: Number(data.labor_pt_healthy_min) || DEFAULT_THRESHOLDS.ptHealthyMin,
      ptHealthyMax: Number(data.labor_pt_healthy_max) || DEFAULT_THRESHOLDS.ptHealthyMax,
      otMonthlyCap: Number(data.labor_ot_monthly_cap) || DEFAULT_THRESHOLDS.otMonthlyCap,
      otQuarterlyCap: Number(data.labor_ot_quarterly_cap) || DEFAULT_THRESHOLDS.otQuarterlyCap,
      ftLowThreshold: Number(data.labor_ft_low_threshold) || DEFAULT_THRESHOLDS.ftLowThreshold,
      ptHighThreshold: Number(data.labor_pt_high_threshold) || DEFAULT_THRESHOLDS.ptHighThreshold,
    },
    businessContext: data.business_context || null,
  }
}

/**
 * Labor cost context for AI analysis — gathered from payroll_records and
 * daily_sales across the months overlapping [periodStart, periodEnd].
 */
export interface LaborContext {
  periodStart: string
  periodEnd: string
  thresholds: LaborCostThresholds
  businessContext: string | null
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
    months_active: number
    max_monthly_ot: number
    avg_monthly_hours: number
    flags: string[]
  }[]
  topOvertimeStaff: {
    name: string
    department: string | null
    employment_type: string
    total_hours: number
    total_overtime_hours: number
    max_monthly_ot: number
    implied_hourly: number | null
  }[]
  complianceFlags: {
    name: string
    department: string | null
    employment_type: string
    flags: string[]
  }[]
}

export async function prepareLaborContext(
  supabase: SupabaseClient,
  storeId: string,
  periodStart: string,
  periodEnd: string,
): Promise<LaborContext> {
  const { thresholds, businessContext } = await loadThresholds(supabase, storeId)
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
  type StaffAcc = {
    name: string
    department: string | null
    employment_type: string
    total_payable: number
    total_hours: number
    total_overtime_hours: number
    months_active: number
    max_monthly_ot: number
  }
  const staffAgg = new Map<string, StaffAcc>()

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
        prev.months_active += 1
        if (ot > prev.max_monthly_ot) prev.max_monthly_ot = ot
      } else {
        staffAgg.set(r.staff_id, {
          name,
          department: r.department,
          employment_type: type,
          total_payable: pay,
          total_hours: hours,
          total_overtime_hours: ot,
          months_active: 1,
          max_monthly_ot: ot,
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

  // Legal baselines (Taiwan 勞基法) — used for pre-computed compliance flags so
  // Claude doesn't have to invent thresholds.
  // Standard FT month is 176h (8h × 22 days). All below come from config,
  // with sensible defaults baked into ai_analysis_config on row creation.
  const OT_MONTHLY_CAP = thresholds.otMonthlyCap
  const OT_THREEMONTH_CAP = thresholds.otQuarterlyCap
  const FT_LOW_THRESHOLD = thresholds.ftLowThreshold
  const PT_HIGH_THRESHOLD = thresholds.ptHighThreshold

  // Finalize per-staff analysis with derived metrics + compliance flags
  const staffAnalysis: LaborContext['staffAnalysis'] = []
  for (const s of staffAgg.values()) {
    const totalHours = Math.round(s.total_hours * 10) / 10
    const totalOt = Math.round(s.total_overtime_hours * 10) / 10
    const maxMonthlyOt = Math.round(s.max_monthly_ot * 10) / 10
    const avgMonthlyHours = s.months_active > 0
      ? Math.round((s.total_hours / s.months_active) * 10) / 10
      : 0
    const impliedHourly = s.total_hours > 0 ? Math.round(s.total_payable / s.total_hours) : null

    const flags: string[] = []
    if (maxMonthlyOt > OT_MONTHLY_CAP) {
      flags.push(`單月最高 OT ${maxMonthlyOt}h > 法規上限 ${OT_MONTHLY_CAP}h`)
    }
    if (s.months_active >= 3 && totalOt > OT_THREEMONTH_CAP) {
      flags.push(`三個月累計 OT ${totalOt}h > 法規上限 ${OT_THREEMONTH_CAP}h`)
    }
    if (s.employment_type === 'part_time' && avgMonthlyHours > PT_HIGH_THRESHOLD) {
      flags.push(`PT 平均月工時 ${avgMonthlyHours}h > ${PT_HIGH_THRESHOLD}h (可能應檢視是否轉正)`)
    }
    if (s.employment_type === 'full_time' && s.months_active >= 2 && avgMonthlyHours < FT_LOW_THRESHOLD) {
      flags.push(`FT 平均月工時 ${avgMonthlyHours}h < ${FT_LOW_THRESHOLD}h (工時偏低)`)
    }

    staffAnalysis.push({
      name: s.name,
      department: s.department,
      employment_type: s.employment_type,
      total_payable: Math.round(s.total_payable),
      total_hours: totalHours,
      total_overtime_hours: totalOt,
      implied_hourly: impliedHourly,
      months_active: s.months_active,
      max_monthly_ot: maxMonthlyOt,
      avg_monthly_hours: avgMonthlyHours,
      flags,
    })
  }

  const topOvertimeStaff = [...staffAnalysis]
    .filter(s => s.total_overtime_hours > 0)
    .sort((a, b) => b.total_overtime_hours - a.total_overtime_hours)
    .slice(0, 5)
    .map(({ name, department, employment_type, total_hours, total_overtime_hours, max_monthly_ot, implied_hourly }) =>
      ({ name, department, employment_type, total_hours, total_overtime_hours, max_monthly_ot, implied_hourly }))

  const complianceFlags = staffAnalysis
    .filter(s => s.flags.length > 0)
    .map(({ name, department, employment_type, flags }) => ({ name, department, employment_type, flags }))

  return {
    periodStart,
    periodEnd,
    thresholds,
    businessContext,
    targetCostRatio: thresholds.targetCostRatio,
    perMonth,
    monthsMissing,
    staffAnalysis,
    topOvertimeStaff,
    complianceFlags,
  }
}
