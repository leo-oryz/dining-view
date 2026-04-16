import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parseNuEIPSchedule } from '@/lib/parsers/nuEIPSchedule'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiError('No file provided', 400)

    const storeId = (formData.get('store_id') as string) || DEFAULT_STORE_ID
    const buffer = await file.arrayBuffer()
    const { shifts, staff, staffShifts, errors } = parseNuEIPSchedule(buffer)

    if (staff.length === 0 && staffShifts.length === 0) {
      return apiError('No valid data found in the file', 400)
    }

    const supabase = createServiceClient()

    // 1. Upsert shift definitions
    if (shifts.length > 0) {
      const shiftRows = shifts.map(s => ({
        store_id: storeId,
        code: s.code,
        name: s.name,
        start_time: s.start_time,
        end_time: s.end_time,
        break_start: s.break_start,
        break_end: s.break_end,
        scheduled_hours: s.scheduled_hours,
      }))
      const { error: shiftErr } = await supabase
        .from('shift_definitions')
        .upsert(shiftRows, { onConflict: 'store_id,code' })
      if (shiftErr) return apiError(`Shift definitions error: ${shiftErr.message}`, 500)
    }

    // 2. Upsert staff
    if (staff.length > 0) {
      const staffRows = staff.map(s => ({
        store_id: storeId,
        employee_id: s.employee_id,
        name: s.name,
        name_en: s.name_en,
      }))
      const { error: staffErr } = await supabase
        .from('staff')
        .upsert(staffRows, { onConflict: 'store_id,employee_id' })
      if (staffErr) return apiError(`Staff error: ${staffErr.message}`, 500)
    }

    // 3. Fetch staff IDs for mapping employee_id → UUID
    const { data: staffList } = await supabase
      .from('staff')
      .select('id, employee_id, employment_type, hourly_rate, monthly_salary')
      .eq('store_id', storeId)

    const staffMap = new Map(
      (staffList || []).map(s => [s.employee_id, s])
    )

    // 4. Upsert staff_shifts with labor_cost calculation
    const shiftRows = staffShifts
      .map(ss => {
        const staffRecord = staffMap.get(ss.employee_id)
        if (!staffRecord) return null

        let laborCost: number | null = null
        if (ss.actual_hours != null && ss.actual_hours > 0) {
          if (staffRecord.employment_type === 'part_time' && staffRecord.hourly_rate) {
            laborCost = staffRecord.hourly_rate * ss.actual_hours
          } else if (staffRecord.monthly_salary) {
            const dailySalary = staffRecord.monthly_salary / 30
            const overtimeHours = Math.max((ss.actual_hours || 0) - (ss.scheduled_hours || 0), 0)
            const overtimePay = staffRecord.hourly_rate
              ? staffRecord.hourly_rate * overtimeHours * 1.34
              : 0
            laborCost = dailySalary + overtimePay
          }
        } else if (ss.is_day_off || ss.actual_hours === 0) {
          // Day off for full-time still costs daily salary
          if (staffRecord.employment_type !== 'part_time' && staffRecord.monthly_salary) {
            laborCost = staffRecord.monthly_salary / 30
          } else {
            laborCost = 0
          }
        }

        return {
          store_id: storeId,
          staff_id: staffRecord.id,
          date: ss.date,
          shift_code: ss.shift_code,
          scheduled_hours: ss.scheduled_hours,
          actual_hours: ss.actual_hours,
          is_day_off: ss.is_day_off,
          is_absent: ss.is_absent,
          labor_cost: laborCost != null ? Math.round(laborCost * 100) / 100 : null,
        }
      })
      .filter(Boolean)

    if (shiftRows.length > 0) {
      // Batch upsert in chunks of 500
      for (let i = 0; i < shiftRows.length; i += 500) {
        const chunk = shiftRows.slice(i, i + 500)
        const { error: ssErr } = await supabase
          .from('staff_shifts')
          .upsert(chunk, { onConflict: 'store_id,staff_id,date' })
        if (ssErr) return apiError(`Staff shifts error: ${ssErr.message}`, 500)
      }
    }

    // 5. Compute labor_daily_summary
    const dates = Array.from(new Set(staffShifts.map(ss => ss.date))).sort()
    if (dates.length > 0) {
      // Fetch daily revenue
      const { data: salesData } = await supabase
        .from('daily_sales')
        .select('date, net_sales')
        .eq('store_id', storeId)
        .in('date', dates)

      const revenueMap = new Map(
        (salesData || []).map(s => [s.date, Number(s.net_sales) || 0])
      )

      // Aggregate from staff_shifts
      const { data: shiftAgg } = await supabase
        .from('staff_shifts')
        .select('date, scheduled_hours, actual_hours, labor_cost, is_day_off')
        .eq('store_id', storeId)
        .in('date', dates)

      const dailyMap = new Map<string, {
        staffCount: number
        scheduledHours: number
        actualHours: number
        laborCost: number
        hasAnyCost: boolean
      }>()

      for (const row of shiftAgg || []) {
        const d = dailyMap.get(row.date) || {
          staffCount: 0, scheduledHours: 0, actualHours: 0, laborCost: 0, hasAnyCost: false,
        }
        if (!row.is_day_off) {
          d.staffCount += 1
        }
        d.scheduledHours += Number(row.scheduled_hours) || 0
        d.actualHours += Number(row.actual_hours) || 0
        if (row.labor_cost != null) {
          d.laborCost += Number(row.labor_cost)
          d.hasAnyCost = true
        }
        dailyMap.set(row.date, d)
      }

      const summaryRows = dates.map(date => {
        const agg = dailyMap.get(date)
        const revenue = revenueMap.get(date) || 0
        const totalActual = agg?.actualHours || 0
        const totalCost = agg?.hasAnyCost ? agg.laborCost : null

        return {
          store_id: storeId,
          date,
          staff_count: agg?.staffCount || 0,
          total_scheduled_hours: agg?.scheduledHours || 0,
          total_actual_hours: totalActual,
          total_overtime_hours: Math.max((agg?.actualHours || 0) - (agg?.scheduledHours || 0), 0),
          total_labor_cost: totalCost != null ? Math.round(totalCost * 100) / 100 : null,
          revenue,
          labor_cost_ratio: totalCost != null && revenue > 0
            ? Math.round((totalCost / revenue) * 10000) / 10000
            : null,
          revenue_per_hour: totalActual > 0
            ? Math.round((revenue / totalActual) * 100) / 100
            : null,
        }
      })

      const { error: sumErr } = await supabase
        .from('labor_daily_summary')
        .upsert(summaryRows, { onConflict: 'store_id,date' })
      if (sumErr) return apiError(`Daily summary error: ${sumErr.message}`, 500)
    }

    // 6. Compute labor_hourly
    if (dates.length > 0) {
      // Fetch hourly sales
      const { data: hourlySales } = await supabase
        .from('hourly_sales')
        .select('date, hour, net_sales')
        .eq('store_id', storeId)
        .in('date', dates)

      // Fetch shift definitions for start/end times
      const { data: allShiftDefs } = await supabase
        .from('shift_definitions')
        .select('code, start_time, end_time')
        .eq('store_id', storeId)

      const shiftTimeMap = new Map(
        (allShiftDefs || []).map(s => [s.code, { start: s.start_time, end: s.end_time }])
      )

      // Build per-date, per-hour staff count
      const hourlyStaffCount = new Map<string, number>()

      for (const ss of staffShifts) {
        if (ss.is_day_off || !ss.shift_code) continue
        const shiftDef = shiftTimeMap.get(ss.shift_code)
        if (!shiftDef?.start || !shiftDef?.end) continue

        const startHour = parseInt(shiftDef.start.split(':')[0])
        const endHour = parseInt(shiftDef.end.split(':')[0])

        for (let h = startHour; h < endHour; h++) {
          const key = `${ss.date}-${h}`
          hourlyStaffCount.set(key, (hourlyStaffCount.get(key) || 0) + 1)
        }
      }

      // Build labor_hourly rows
      const hourlyRows: {
        store_id: string
        date: string
        time_slot_start: string
        staff_count: number
        revenue: number
        revenue_per_staff: number | null
      }[] = []

      for (const hs of hourlySales || []) {
        const key = `${hs.date}-${hs.hour}`
        const staffCount = hourlyStaffCount.get(key) || 0
        const revenue = Number(hs.net_sales) || 0

        hourlyRows.push({
          store_id: storeId,
          date: hs.date,
          time_slot_start: `${String(hs.hour).padStart(2, '0')}:00`,
          staff_count: staffCount,
          revenue,
          revenue_per_staff: staffCount > 0 ? Math.round((revenue / staffCount) * 100) / 100 : null,
        })
      }

      if (hourlyRows.length > 0) {
        for (let i = 0; i < hourlyRows.length; i += 500) {
          const chunk = hourlyRows.slice(i, i + 500)
          const { error: hourlyErr } = await supabase
            .from('labor_hourly')
            .upsert(chunk, { onConflict: 'store_id,date,time_slot_start' })
          if (hourlyErr) return apiError(`Hourly labor error: ${hourlyErr.message}`, 500)
        }
      }
    }

    // Record upload history
    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: file.name,
      file_type: 'nueip-schedule',
      record_count: shiftRows.length,
      status: errors.length > 0 ? 'partial' : 'success',
      error_details: errors.length > 0 ? errors : null,
    })

    return apiSuccess({
      imported: shiftRows.length,
      staff_count: staff.length,
      days: Array.from(new Set(staffShifts.map(s => s.date))).length,
      errors,
    })
  } catch (err) {
    console.error('[labor/upload] error:', err)
    return apiError('Internal server error', 500)
  }
}
