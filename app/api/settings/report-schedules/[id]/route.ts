import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'
import { computeNextRunAt } from '@/lib/digest/scheduling'
import { validateAndCoerce } from '@/lib/digest/scheduleValidation'

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session || session.role !== 'owner') return apiError('Forbidden', 403)

  let body: Record<string, unknown>
  try {
    body = await request.json()
  } catch {
    return apiError('Invalid JSON', 400)
  }

  const v = validateAndCoerce(body)
  if ('error' in v) return apiError(v.error, 400)

  const nextRunAt = computeNextRunAt(v.schedule).toISOString()

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('report_schedules')
    .update({
      ...v.schedule,
      next_run_at: nextRunAt,
      updated_by: session.id,
      updated_at: new Date().toISOString(),
    })
    .eq('id', params.id)
    .select()
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}

export async function DELETE(_request: NextRequest, { params }: { params: { id: string } }) {
  const session = await getSession()
  if (!session || session.role !== 'owner') return apiError('Forbidden', 403)

  const supabase = createServiceClient()
  const { error } = await supabase
    .from('report_schedules')
    .delete()
    .eq('id', params.id)

  if (error) return apiError(error.message, 500)
  return apiSuccess({ id: params.id })
}
