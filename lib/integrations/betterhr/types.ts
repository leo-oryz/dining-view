// BetterHR API response shapes.
// ⚠️ Field names are best-guess based on common HRIS conventions.
// Verify against the actual BetterHR API docs once credentials are available
// and adjust the transformer accordingly.

export interface BetterHREmployee {
  id: string
  full_name?: string // ⚠️ verify field name (could be `name` or `display_name`)
  first_name?: string
  last_name?: string
  email?: string
  role?: string // ⚠️ verify (could be `position` or `job_title`)
  job_title?: string
  department?: string
  employment_type?: string // ⚠️ verify enum: full_time | part_time | contractor
  start_date?: string // ISO date
  end_date?: string | null
  is_active?: boolean
  status?: string // ⚠️ alternative to is_active
}

export interface BetterHRAttendance {
  id?: string
  employee_id: string
  date: string // YYYY-MM-DD
  clock_in?: string | null // ISO8601
  clock_out?: string | null // ISO8601
  hours_worked?: number | null
  is_late?: boolean
  is_absent?: boolean
  status?: string // ⚠️ verify — may use 'present'|'late'|'absent' instead of booleans
}

export interface BetterHRPayroll {
  id?: string
  period_start: string // YYYY-MM-DD
  period_end: string // YYYY-MM-DD
  total_cost?: number // ⚠️ verify currency unit (VND integer expected)
  total_amount?: number // alternative field name
  cost_by_department?: Record<string, number> | null
  headcount?: number
}

export interface BetterHRLeave {
  id?: string
  employee_id: string
  leave_type?: string // ⚠️ verify enum: annual | sick | unpaid | other
  type?: string // alternative field name
  start_date: string
  end_date: string
  status?: string // pending | approved | rejected
  approved_by?: string | null
}

export interface BetterHRListResponse<T> {
  data?: T[]
  results?: T[]
  items?: T[]
  next_page?: number | null
  meta?: { next_page?: number | null; total?: number }
}
