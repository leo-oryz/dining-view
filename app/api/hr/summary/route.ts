import { NextRequest } from 'next/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { createServerSupabase } from '@/lib/supabase/server'

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + n)
  return out
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const storeId = getStoreId(searchParams)
  const supabase = await createServerSupabase()

  const now = new Date()
  const today = ymd(now)
  const sevenDaysAgo = ymd(addDays(now, -6))
  const fourteenDaysAhead = ymd(addDays(now, 14))
  const monthStart = `${today.slice(0, 7)}-01`
  const prevMonthDate = new Date(now)
  prevMonthDate.setUTCDate(1)
  prevMonthDate.setUTCMonth(prevMonthDate.getUTCMonth() - 1)
  const prevMonthStart = ymd(prevMonthDate)

  // Detect whether HR is configured (has any employees synced for this store).
  const [
    employeesRes,
    attendanceRes,
    upcomingLeaveRes,
    leaveBreakdownRes,
    payrollRes,
    salesRes,
  ] = await Promise.all([
    supabase
      .from('hr_employees')
      .select('id, department, employment_type, is_active')
      .eq('store_id', storeId),
    supabase
      .from('hr_attendance')
      .select('date, is_late, is_absent')
      .eq('store_id', storeId)
      .gte('date', sevenDaysAgo)
      .lte('date', today),
    supabase
      .from('hr_leave')
      .select('id, employee_id, leave_type, start_date, end_date, status, hr_employees(full_name)')
      .eq('store_id', storeId)
      .eq('status', 'approved')
      .gte('start_date', today)
      .lte('start_date', fourteenDaysAhead)
      .order('start_date', { ascending: true }),
    supabase
      .from('hr_leave')
      .select('leave_type, status')
      .eq('store_id', storeId)
      .gte('start_date', addDays(now, -90).toISOString().slice(0, 10)),
    supabase
      .from('hr_payroll')
      .select('period_start, period_end, total_cost, headcount, cost_by_department')
      .eq('store_id', storeId)
      .gte('period_start', prevMonthStart)
      .order('period_start', { ascending: false }),
    supabase
      .from('daily_sales')
      .select('date, net_sales')
      .eq('store_id', storeId)
      .gte('date', prevMonthStart)
      .lte('date', today),
  ])

  const errors = [
    employeesRes.error,
    attendanceRes.error,
    upcomingLeaveRes.error,
    leaveBreakdownRes.error,
    payrollRes.error,
    salesRes.error,
  ].filter(Boolean)
  if (errors.length) {
    return apiError(errors.map((e) => e!.message).join('; '), 500)
  }

  const employees = employeesRes.data ?? []
  const active = employees.filter((e) => e.is_active)
  const byDepartment: Record<string, number> = {}
  const byEmploymentType: Record<string, number> = {}
  for (const e of active) {
    const dept = (e.department as string | null) ?? 'unassigned'
    const type = (e.employment_type as string | null) ?? 'unknown'
    byDepartment[dept] = (byDepartment[dept] ?? 0) + 1
    byEmploymentType[type] = (byEmploymentType[type] ?? 0) + 1
  }

  const attendance = attendanceRes.data ?? []
  const totalAttendance = attendance.length
  const lateCount = attendance.filter((a) => a.is_late).length
  const absentCount = attendance.filter((a) => a.is_absent).length

  const dailyMap = new Map<string, { scheduled: number; present: number }>()
  for (const a of attendance) {
    const day = a.date as string
    const cur = dailyMap.get(day) ?? { scheduled: 0, present: 0 }
    cur.scheduled += 1
    if (!a.is_absent) cur.present += 1
    dailyMap.set(day, cur)
  }
  const dailyAttendance = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }))

  const upcomingLeave = (upcomingLeaveRes.data ?? []).map((l) => {
    const emp = (l as { hr_employees?: { full_name?: string } | null }).hr_employees
    return {
      id: l.id,
      employee_name: emp?.full_name ?? 'Unknown',
      leave_type: l.leave_type,
      start_date: l.start_date,
      end_date: l.end_date,
    }
  })

  const leaveBreakdown: Record<string, number> = {}
  for (const l of leaveBreakdownRes.data ?? []) {
    const k = (l.leave_type as string | null) ?? 'other'
    leaveBreakdown[k] = (leaveBreakdown[k] ?? 0) + 1
  }

  const payrollRows = payrollRes.data ?? []
  const currentPayroll = payrollRows.find((p) => (p.period_start as string) >= monthStart) ?? null
  const previousPayroll = payrollRows.find((p) => (p.period_start as string) < monthStart) ?? null

  const sales = salesRes.data ?? []
  const monthSales = sales
    .filter((s) => (s.date as string) >= monthStart)
    .reduce((sum, s) => sum + Number(s.net_sales ?? 0), 0)
  const laborCostPct =
    currentPayroll && monthSales > 0
      ? (Number(currentPayroll.total_cost) / monthSales) * 100
      : null
  const momChange =
    currentPayroll && previousPayroll && Number(previousPayroll.total_cost) > 0
      ? ((Number(currentPayroll.total_cost) - Number(previousPayroll.total_cost)) /
          Number(previousPayroll.total_cost)) *
        100
      : null

  return apiSuccess({
    configured: employees.length > 0,
    headcount: {
      total_active: active.length,
      by_department: byDepartment,
      by_employment_type: byEmploymentType,
    },
    attendance: {
      total: totalAttendance,
      late_count: lateCount,
      absent_count: absentCount,
      late_rate: totalAttendance ? (lateCount / totalAttendance) * 100 : 0,
      absence_rate: totalAttendance ? (absentCount / totalAttendance) * 100 : 0,
      daily: dailyAttendance,
    },
    leave: {
      upcoming: upcomingLeave,
      breakdown: leaveBreakdown,
    },
    payroll: {
      current: currentPayroll
        ? {
            period_start: currentPayroll.period_start,
            period_end: currentPayroll.period_end,
            total_cost: Number(currentPayroll.total_cost),
            headcount: currentPayroll.headcount,
            cost_by_department: currentPayroll.cost_by_department,
          }
        : null,
      previous: previousPayroll
        ? {
            period_start: previousPayroll.period_start,
            period_end: previousPayroll.period_end,
            total_cost: Number(previousPayroll.total_cost),
          }
        : null,
      labor_cost_pct: laborCostPct,
      mom_change_pct: momChange,
    },
  })
}
