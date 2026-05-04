import { apiSuccess, apiError } from '@/lib/api-utils'
import { createServiceClient } from '@/lib/supabase/server'
import { sendAiReport, type ReportType, type ReportDepth, type PeriodType } from '@/lib/digest/aiReport'
import { computeNextRunAt } from '@/lib/digest/scheduling'

export const maxDuration = 300

type ScheduleRow = {
  id: string
  name: string
  is_active: boolean
  frequency: 'weekly' | 'monthly'
  day_of_week: number | null
  day_of_month: number | null
  send_hour: number
  send_minute: number
  timezone: string
  period_type: PeriodType
  report_types: ReportType[]
  depth: ReportDepth
  recipient_roles: string[]
  extra_emails: string[]
  next_run_at: string | null
}

export async function POST(request: Request) {
  const secret = request.headers.get('x-cron-secret')
    || new URL(request.url).searchParams.get('secret')
  if (secret !== process.env.CRON_SECRET) return apiError('Unauthorized', 401)

  const supabase = createServiceClient()
  const nowIso = new Date().toISOString()

  // Pick schedules that are due. We treat missing next_run_at as "not yet
  // scheduled" — the API normally backfills it on save, but as a safety net
  // here we also catch + reset NULLs without firing them.
  const { data: rows, error } = await supabase
    .from('report_schedules')
    .select('*')
    .eq('is_active', true)

  if (error) return apiError(error.message, 500)
  const schedules = (rows || []) as ScheduleRow[]

  const fired: { id: string; name: string; reportsGenerated: number; recipientCount: number; error?: string }[] = []
  const skipped: { id: string; name: string; reason: string }[] = []
  const repaired: string[] = []

  for (const s of schedules) {
    if (!s.next_run_at) {
      const next = computeNextRunAt(s).toISOString()
      await supabase.from('report_schedules').update({ next_run_at: next }).eq('id', s.id)
      repaired.push(s.id)
      skipped.push({ id: s.id, name: s.name, reason: 'next_run_at was null, backfilled' })
      continue
    }
    if (new Date(s.next_run_at).getTime() > Date.now()) {
      skipped.push({ id: s.id, name: s.name, reason: `next at ${s.next_run_at}` })
      continue
    }

    let result
    try {
      result = await sendAiReport({
        id: s.id,
        name: s.name,
        period_type: s.period_type,
        report_types: s.report_types,
        depth: s.depth,
        recipient_roles: s.recipient_roles,
        extra_emails: s.extra_emails,
      })
    } catch (err) {
      result = {
        recipientCount: 0,
        reportsGenerated: 0,
        periodLabel: '',
        error: err instanceof Error ? err.message : 'unknown error',
      }
    }

    const nextAt = computeNextRunAt(s, new Date()).toISOString()
    await supabase
      .from('report_schedules')
      .update({
        last_run_at: nowIso,
        last_run_status: result.error ? 'error' : 'success',
        last_run_error: result.error ?? null,
        next_run_at: nextAt,
      })
      .eq('id', s.id)

    fired.push({
      id: s.id,
      name: s.name,
      reportsGenerated: result.reportsGenerated,
      recipientCount: result.recipientCount,
      error: result.error,
    })
  }

  return apiSuccess({
    now: nowIso,
    total_active: schedules.length,
    fired,
    skipped,
    repaired,
  })
}
