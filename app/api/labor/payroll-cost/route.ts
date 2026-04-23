import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

/**
 * Cost ratio computed from payroll_records (ground truth) ÷ daily_sales.
 *
 * Because payroll is monthly, we include every month that overlaps the
 * requested range AND has payroll data. Months without payroll are reported
 * in `months_missing` so the UI can flag incomplete coverage.
 */
export async function GET(request: NextRequest) {
  try {
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

    const perMonth: {
      year: number
      month: number
      total_payable: number | null
      total_revenue: number
      cost_ratio: number | null
      staff_count: number
      department_breakdown: { department: string; total: number }[]
    }[] = []

    const monthsMissing: string[] = []

    for (const { year, month } of months) {
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`
      const monthEnd = new Date(year, month, 0).toISOString().slice(0, 10)

      const { data: payroll } = await supabase
        .from('payroll_records')
        .select('total_payable, department')
        .eq('store_id', storeId).eq('year', year).eq('month', month)

      const { data: sales } = await supabase
        .from('daily_sales')
        .select('net_sales')
        .eq('store_id', storeId).gte('date', monthStart).lte('date', monthEnd)

      const totalRevenue = (sales || []).reduce((s, r) => s + (Number(r.net_sales) || 0), 0)

      if (!payroll || payroll.length === 0) {
        monthsMissing.push(`${year}-${String(month).padStart(2, '0')}`)
        perMonth.push({
          year, month,
          total_payable: null,
          total_revenue: totalRevenue,
          cost_ratio: null,
          staff_count: 0,
          department_breakdown: [],
        })
        continue
      }

      const totalPayable = payroll.reduce((s, r) => s + Number(r.total_payable), 0)
      const deptMap = new Map<string, number>()
      for (const r of payroll) {
        const d = r.department || '未分類'
        deptMap.set(d, (deptMap.get(d) || 0) + Number(r.total_payable))
      }

      perMonth.push({
        year, month,
        total_payable: Math.round(totalPayable * 100) / 100,
        total_revenue: totalRevenue,
        cost_ratio: totalRevenue > 0 ? Math.round((totalPayable / totalRevenue) * 10000) / 10000 : null,
        staff_count: payroll.length,
        department_breakdown: Array.from(deptMap.entries())
          .map(([department, total]) => ({ department, total: Math.round(total * 100) / 100 }))
          .sort((a, b) => b.total - a.total),
      })
    }

    // Aggregate across months that DO have payroll
    const covered = perMonth.filter(m => m.total_payable != null)
    const aggregate = covered.length === 0 ? null : {
      total_payable: Math.round(covered.reduce((s, m) => s + (m.total_payable || 0), 0) * 100) / 100,
      total_revenue: covered.reduce((s, m) => s + m.total_revenue, 0),
      cost_ratio: (() => {
        const tp = covered.reduce((s, m) => s + (m.total_payable || 0), 0)
        const tr = covered.reduce((s, m) => s + m.total_revenue, 0)
        return tr > 0 ? Math.round((tp / tr) * 10000) / 10000 : null
      })(),
      months_covered: covered.map(m => `${m.year}-${String(m.month).padStart(2, '0')}`),
    }

    return apiSuccess({
      per_month: perMonth,
      aggregate,
      months_missing: monthsMissing,
    })
  } catch (err) {
    console.error('[payroll-cost] error:', err)
    return apiError('Internal server error', 500)
  }
}
