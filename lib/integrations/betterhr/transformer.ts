import type {
  BetterHREmployee,
  BetterHRAttendance,
  BetterHRPayroll,
  BetterHRLeave,
} from './types'

// ============================================================
// Employee
// ============================================================
export function transformEmployee(raw: BetterHREmployee, storeId: string) {
  const fullName =
    raw.full_name?.trim() ||
    [raw.first_name, raw.last_name].filter(Boolean).join(' ').trim() ||
    'Unknown'

  const isActive = raw.is_active ?? (raw.status ? raw.status.toLowerCase() === 'active' : true)

  return {
    store_id: storeId,
    betterhr_id: String(raw.id),
    full_name: fullName,
    role: raw.role ?? raw.job_title ?? null,
    department: raw.department ?? null,
    employment_type: normalizeEmploymentType(raw.employment_type),
    start_date: raw.start_date ?? null,
    end_date: raw.end_date ?? null,
    is_active: isActive,
    updated_at: new Date().toISOString(),
  }
}

function normalizeEmploymentType(t: string | undefined | null): string | null {
  if (!t) return null
  const lc = t.toLowerCase().replace(/[\s-]+/g, '_')
  if (['full_time', 'fulltime', 'permanent'].includes(lc)) return 'full_time'
  if (['part_time', 'parttime'].includes(lc)) return 'part_time'
  if (['contractor', 'contract', 'freelance'].includes(lc)) return 'contractor'
  return lc
}

// ============================================================
// Attendance
// ============================================================
export function transformAttendance(
  raw: BetterHRAttendance,
  storeId: string,
  employeeId: string,
) {
  const status = raw.status?.toLowerCase()
  const isLate = raw.is_late ?? status === 'late'
  const isAbsent = raw.is_absent ?? status === 'absent'

  let hoursWorked = raw.hours_worked ?? null
  if (hoursWorked == null && raw.clock_in && raw.clock_out) {
    const ms = new Date(raw.clock_out).getTime() - new Date(raw.clock_in).getTime()
    if (Number.isFinite(ms) && ms > 0) {
      hoursWorked = Math.round((ms / 3_600_000) * 100) / 100
    }
  }

  return {
    store_id: storeId,
    employee_id: employeeId,
    date: raw.date,
    clock_in: raw.clock_in ?? null,
    clock_out: raw.clock_out ?? null,
    hours_worked: hoursWorked,
    is_late: !!isLate,
    is_absent: !!isAbsent,
  }
}

// ============================================================
// Payroll
// ============================================================
export function transformPayroll(raw: BetterHRPayroll, storeId: string) {
  const totalCost = Math.round(raw.total_cost ?? raw.total_amount ?? 0)
  return {
    store_id: storeId,
    period_start: raw.period_start,
    period_end: raw.period_end,
    total_cost: totalCost,
    cost_by_department: raw.cost_by_department ?? null,
    headcount: raw.headcount ?? null,
    updated_at: new Date().toISOString(),
  }
}

// ============================================================
// Leave
// ============================================================
export function transformLeave(
  raw: BetterHRLeave,
  storeId: string,
  employeeId: string,
) {
  return {
    store_id: storeId,
    employee_id: employeeId,
    leave_type: normalizeLeaveType(raw.leave_type ?? raw.type),
    start_date: raw.start_date,
    end_date: raw.end_date,
    status: normalizeLeaveStatus(raw.status),
    approved_by: raw.approved_by ?? null,
    updated_at: new Date().toISOString(),
  }
}

function normalizeLeaveType(t: string | undefined | null): string {
  if (!t) return 'other'
  const lc = t.toLowerCase()
  if (lc.includes('annual') || lc.includes('vacation')) return 'annual'
  if (lc.includes('sick') || lc.includes('medical')) return 'sick'
  if (lc.includes('unpaid')) return 'unpaid'
  return 'other'
}

function normalizeLeaveStatus(s: string | undefined | null): string {
  const lc = s?.toLowerCase() ?? ''
  if (['approved', 'accepted'].includes(lc)) return 'approved'
  if (['rejected', 'denied'].includes(lc)) return 'rejected'
  return 'pending'
}
