import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAiReport, type ReportType, type ReportDepth, type PeriodType } from '@/lib/digest/aiReport'

export const maxDuration = 300

export async function POST(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session || session.role !== 'owner') return apiError('Forbidden', 403)

  const supabase = createServiceClient()
  const { data: row, error } = await supabase
    .from('report_schedules')
    .select('*')
    .eq('id', params.id)
    .maybeSingle()

  if (error) return apiError(error.message, 500)
  if (!row) return apiError('Schedule not found', 404)

  const result = await sendAiReport({
    id: row.id,
    name: row.name,
    period_type: row.period_type as PeriodType,
    report_types: row.report_types as ReportType[],
    depth: row.depth as ReportDepth,
    recipient_roles: row.recipient_roles as string[],
    extra_emails: row.extra_emails as string[],
  })

  // Record the manual run so the owner can see it succeeded — but DO NOT
  // update next_run_at; the regular schedule should keep its cadence.
  await supabase
    .from('report_schedules')
    .update({
      last_run_at: new Date().toISOString(),
      last_run_status: result.error ? 'error' : 'success',
      last_run_error: result.error ?? null,
    })
    .eq('id', row.id)

  return apiSuccess(result)
}
