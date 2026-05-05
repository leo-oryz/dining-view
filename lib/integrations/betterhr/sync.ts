import { createServiceClient } from '@/lib/supabase/server'
import {
  fetchEmployees,
  fetchAttendance,
  fetchPayroll,
  fetchLeave,
  isBetterHRConfigured,
  type BetterHRConfig,
} from './client'
import {
  transformEmployee,
  transformAttendance,
  transformPayroll,
  transformLeave,
} from './transformer'

const SETTING_KEY_API = 'betterhr_api_key'
const SETTING_KEY_COMPANY = 'betterhr_company_id'

async function loadStoreConfig(
  supabase: ReturnType<typeof createServiceClient>,
  storeId: string,
): Promise<BetterHRConfig> {
  const { data } = await supabase
    .from('store_settings')
    .select('setting_key, setting_value')
    .eq('store_id', storeId)
    .in('setting_key', [SETTING_KEY_API, SETTING_KEY_COMPANY])

  const cfg: BetterHRConfig = {}
  for (const row of data ?? []) {
    if (row.setting_key === SETTING_KEY_API) cfg.apiKey = row.setting_value as string
    if (row.setting_key === SETTING_KEY_COMPANY) cfg.companyId = row.setting_value as string
  }
  return cfg
}

export interface SyncResult {
  store: string
  store_id: string
  employees?: number
  attendance?: number
  payroll?: number
  leave?: number
  skipped?: boolean
  error?: string
}

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, days: number): Date {
  const out = new Date(d)
  out.setUTCDate(out.getUTCDate() + days)
  return out
}

function periodKey(d: Date): string {
  return d.toISOString().slice(0, 7) // YYYY-MM
}

export async function syncBetterHR(options?: {
  storeId?: string
  config?: BetterHRConfig
}): Promise<SyncResult[]> {
  const supabase = createServiceClient()

  let storesQuery = supabase.from('stores').select('id, name')
  if (options?.storeId) {
    storesQuery = storesQuery.eq('id', options.storeId)
  }
  const { data: stores, error: storesErr } = await storesQuery
  if (storesErr) throw storesErr
  if (!stores?.length) return []

  const now = new Date()
  const attendanceStart = ymd(addDays(now, -7))
  const attendanceEnd = ymd(now)
  const leaveStart = ymd(addDays(now, -30))
  const leaveEnd = ymd(addDays(now, 60))
  const currentPeriod = periodKey(now)
  const prevPeriod = periodKey(addDays(now, -now.getUTCDate())) // last day of prev month

  const results: SyncResult[] = []

  for (const store of stores) {
    const storeId = store.id as string
    const result: SyncResult = { store: store.name, store_id: storeId }

    // Resolve credentials: explicit override > store_settings row > env vars (handled in client).
    const storeCfg = options?.config ?? (await loadStoreConfig(supabase, storeId))
    if (!isBetterHRConfigured(storeCfg)) {
      result.skipped = true
      results.push(result)
      continue
    }

    try {
      // ===== Employees =====
      const rawEmployees = await fetchEmployees(storeCfg)
      const employeeRows = rawEmployees.map((e) => transformEmployee(e, storeId))
      if (employeeRows.length) {
        const { error } = await supabase
          .from('hr_employees')
          .upsert(employeeRows, { onConflict: 'store_id,betterhr_id', ignoreDuplicates: false })
        if (error) throw error
      }
      result.employees = employeeRows.length

      // Build betterhr_id → DB UUID map for attendance/leave foreign keys.
      const { data: dbEmployees, error: empErr } = await supabase
        .from('hr_employees')
        .select('id, betterhr_id')
        .eq('store_id', storeId)
      if (empErr) throw empErr
      const idMap = new Map<string, string>()
      for (const row of dbEmployees ?? []) {
        idMap.set(String(row.betterhr_id), String(row.id))
      }

      // ===== Attendance (rolling 7-day window) =====
      const rawAttendance = await fetchAttendance(
        { startDate: attendanceStart, endDate: attendanceEnd },
        storeCfg,
      )
      const attendanceRows = rawAttendance
        .map((a) => {
          const empId = idMap.get(String(a.employee_id))
          if (!empId) return null
          return transformAttendance(a, storeId, empId)
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
      if (attendanceRows.length) {
        const { error } = await supabase
          .from('hr_attendance')
          .upsert(attendanceRows, { onConflict: 'employee_id,date', ignoreDuplicates: false })
        if (error) throw error
      }
      result.attendance = attendanceRows.length

      // ===== Leave (past 30d + next 60d) =====
      const rawLeave = await fetchLeave(
        { startDate: leaveStart, endDate: leaveEnd },
        storeCfg,
      )
      const leaveRows = rawLeave
        .map((l) => {
          const empId = idMap.get(String(l.employee_id))
          if (!empId) return null
          return transformLeave(l, storeId, empId)
        })
        .filter((r): r is NonNullable<typeof r> => r !== null)
      if (leaveRows.length) {
        // hr_leave has no natural unique constraint; clear and re-insert the window
        // to avoid duplicating rows on every sync.
        await supabase
          .from('hr_leave')
          .delete()
          .eq('store_id', storeId)
          .gte('start_date', leaveStart)
          .lte('end_date', leaveEnd)
        const { error } = await supabase.from('hr_leave').insert(leaveRows)
        if (error) throw error
      }
      result.leave = leaveRows.length

      // ===== Payroll (current + previous month) =====
      const payrollPeriods = [currentPeriod, prevPeriod]
      let payrollCount = 0
      for (const period of payrollPeriods) {
        const rawPayroll = await fetchPayroll({ period }, storeCfg)
        const rows = rawPayroll.map((p) => transformPayroll(p, storeId))
        if (rows.length) {
          const { error } = await supabase
            .from('hr_payroll')
            .upsert(rows, {
              onConflict: 'store_id,period_start,period_end',
              ignoreDuplicates: false,
            })
          if (error) throw error
          payrollCount += rows.length
        }
      }
      result.payroll = payrollCount
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err)
    }

    results.push(result)
  }

  return results
}
