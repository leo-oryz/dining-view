import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'

export async function POST(request: NextRequest) {
  try {
    // Owner-only: edits salary + employment fields.
    const session = await getSession()
    if (!session || session.role !== 'owner') return apiError('Forbidden', 403)

    const body = await request.json()
    const {
      staff_id, employment_type, hourly_rate, monthly_salary,
      department, job_title, hired_at, left_at, is_active,
      requires_review, mark_reviewed,
    } = body
    const storeId = body.store_id || DEFAULT_STORE_ID

    if (!staff_id) return apiError('staff_id is required', 400)

    const supabase = createServiceClient()

    // Update staff record — only touch fields the caller sent.
    const updates: Record<string, unknown> = {}
    if (employment_type) updates.employment_type = employment_type
    if (hourly_rate !== undefined) updates.hourly_rate = hourly_rate
    if (monthly_salary !== undefined) updates.monthly_salary = monthly_salary
    if (department !== undefined) updates.department = department
    if (job_title !== undefined) updates.job_title = job_title
    if (hired_at !== undefined) updates.hired_at = hired_at || null
    if (left_at !== undefined) updates.left_at = left_at || null
    if (is_active !== undefined) updates.is_active = is_active
    if (requires_review !== undefined) updates.requires_review = requires_review
    // Convenience flag from the modal's "標記已審核" button.
    if (mark_reviewed) updates.requires_review = false

    const { error: updateErr } = await supabase
      .from('staff')
      .update(updates)
      .eq('id', staff_id)
      .eq('store_id', storeId)

    if (updateErr) return apiError(updateErr.message, 500)

    // Recalculate labor_cost for all shifts of this staff member
    const { data: staffRecord } = await supabase
      .from('staff')
      .select('employment_type, hourly_rate, monthly_salary')
      .eq('id', staff_id)
      .single()

    if (staffRecord) {
      const { data: shifts } = await supabase
        .from('staff_shifts')
        .select('id, actual_hours, scheduled_hours, is_day_off')
        .eq('staff_id', staff_id)
        .eq('store_id', storeId)

      for (const shift of shifts || []) {
        let laborCost: number | null = null
        const actual = Number(shift.actual_hours) || 0

        if (actual > 0) {
          if (staffRecord.employment_type === 'part_time' && staffRecord.hourly_rate) {
            laborCost = staffRecord.hourly_rate * actual
          } else if (staffRecord.monthly_salary) {
            const dailySalary = staffRecord.monthly_salary / 30
            const overtime = Math.max(actual - (Number(shift.scheduled_hours) || 0), 0)
            const overtimePay = staffRecord.hourly_rate
              ? staffRecord.hourly_rate * overtime * 1.34
              : 0
            laborCost = dailySalary + overtimePay
          }
        } else if (shift.is_day_off) {
          if (staffRecord.employment_type !== 'part_time' && staffRecord.monthly_salary) {
            laborCost = staffRecord.monthly_salary / 30
          } else {
            laborCost = 0
          }
        }

        await supabase
          .from('staff_shifts')
          .update({ labor_cost: laborCost != null ? Math.round(laborCost * 100) / 100 : null })
          .eq('id', shift.id)
      }

      // Recalculate affected daily summaries
      const { data: affectedDates } = await supabase
        .from('staff_shifts')
        .select('date')
        .eq('staff_id', staff_id)
        .eq('store_id', storeId)

      const dates = Array.from(new Set((affectedDates || []).map(r => r.date)))

      for (const date of dates) {
        const { data: dayShifts } = await supabase
          .from('staff_shifts')
          .select('actual_hours, scheduled_hours, labor_cost, is_day_off')
          .eq('store_id', storeId)
          .eq('date', date)

        const { data: salesRow } = await supabase
          .from('daily_sales')
          .select('net_sales')
          .eq('store_id', storeId)
          .eq('date', date)
          .single()

        const revenue = Number(salesRow?.net_sales) || 0
        let staffCount = 0
        let totalScheduled = 0
        let totalActual = 0
        let totalCost = 0
        let hasCost = false

        for (const ds of dayShifts || []) {
          if (!ds.is_day_off) staffCount += 1
          totalScheduled += Number(ds.scheduled_hours) || 0
          totalActual += Number(ds.actual_hours) || 0
          if (ds.labor_cost != null) {
            totalCost += Number(ds.labor_cost)
            hasCost = true
          }
        }

        await supabase
          .from('labor_daily_summary')
          .upsert({
            store_id: storeId,
            date,
            staff_count: staffCount,
            total_scheduled_hours: totalScheduled,
            total_actual_hours: totalActual,
            total_overtime_hours: Math.max(totalActual - totalScheduled, 0),
            total_labor_cost: hasCost ? Math.round(totalCost * 100) / 100 : null,
            revenue,
            labor_cost_ratio: hasCost && revenue > 0
              ? Math.round((totalCost / revenue) * 10000) / 10000
              : null,
            revenue_per_hour: totalActual > 0
              ? Math.round((revenue / totalActual) * 100) / 100
              : null,
          }, { onConflict: 'store_id,date' })
      }
    }

    return apiSuccess({ updated: true })
  } catch {
    return apiError('Internal server error', 500)
  }
}
