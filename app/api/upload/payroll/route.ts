import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { parsePayrollXls } from '@/lib/parsers/payrollXls'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return apiError('No file provided', 400)

    const storeId = (formData.get('store_id') as string) || DEFAULT_STORE_ID
    const buffer = await file.arrayBuffer()
    const parsed = parsePayrollXls(buffer, file.name)
    const { year, month, records, errors } = parsed

    if (!year || !month) {
      return apiError(`Could not determine period from filename "${file.name}". Expected YYYY-MM format.`, 400)
    }
    if (records.length === 0) {
      return apiError('No valid payroll rows found', 400)
    }

    const supabase = createServiceClient()

    // 1. Upsert staff for every employee_id in this payroll.
    //    Payroll is authoritative for employment_type / department / job_title —
    //    those change slowly and this is ground truth.
    const staffRows = records.map(r => ({
      store_id: storeId,
      employee_id: r.employee_id,
      name: r.name,
      employment_type: r.employment_type,
      department: r.department,
      job_title: r.job_title,
    }))

    // Upsert one-by-one so we only overwrite columns payroll owns, not touching
    // name_en / hourly_rate / monthly_salary / is_active / requires_review that
    // may have been set by schedule upload or owner review.
    for (const s of staffRows) {
      const { data: existing } = await supabase
        .from('staff')
        .select('id')
        .eq('store_id', s.store_id)
        .eq('employee_id', s.employee_id)
        .maybeSingle()

      if (existing) {
        await supabase
          .from('staff')
          .update({
            employment_type: s.employment_type,
            department: s.department,
            job_title: s.job_title,
          })
          .eq('id', existing.id)
      } else {
        await supabase.from('staff').insert({
          ...s,
          is_active: true,
          requires_review: true,
        })
      }
    }

    // 2. Fetch staff UUID map
    const { data: staffList } = await supabase
      .from('staff')
      .select('id, employee_id')
      .eq('store_id', storeId)
    const staffMap = new Map((staffList || []).map(s => [s.employee_id, s.id]))

    // 3. Upsert payroll_records for this (year, month)
    type PayrollRow = {
      store_id: string
      staff_id: string
      year: number
      month: number
      department: string | null
      job_title: string | null
      total_payable: number
      actual_hours: number
      overtime_hours: number | null
    }
    const payrollRows: PayrollRow[] = records.flatMap(r => {
      const staffId = staffMap.get(r.employee_id)
      if (!staffId) return []
      return [{
        store_id: storeId,
        staff_id: staffId,
        year,
        month,
        department: r.department,
        job_title: r.job_title,
        total_payable: r.total_payable,
        actual_hours: r.actual_hours,
        overtime_hours: r.overtime_hours,
      }]
    })

    if (payrollRows.length > 0) {
      const { error } = await supabase
        .from('payroll_records')
        .upsert(payrollRows, { onConflict: 'store_id,staff_id,year,month' })
      if (error) return apiError(`Payroll upsert error: ${error.message}`, 500)
    }

    // 4. Record upload history
    await supabase.from('upload_history').insert({
      store_id: storeId,
      file_name: file.name,
      file_type: 'payroll',
      record_count: payrollRows.length,
      status: errors.length > 0 ? 'partial' : 'success',
      error_details: errors.length > 0 ? errors : null,
    })

    return apiSuccess({
      year,
      month,
      imported: payrollRows.length,
      staff_touched: staffRows.length,
      errors,
    })
  } catch (err) {
    console.error('[upload/payroll] error:', err)
    return apiError('Internal server error', 500)
  }
}
