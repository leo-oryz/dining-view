import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json()
    const { name, type, start_date, end_date, description, budget, status, recurrence_type, recurrence_days } = body

    if (!name) return apiError('Campaign name is required', 400)

    const validStatuses = ['planned', 'active', 'completed', 'cancelled']
    if (status && !validStatuses.includes(status)) {
      return apiError(`Invalid status. Must be one of: ${validStatuses.join(', ')}`, 400)
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('campaigns')
      .update({
        name,
        type: type || null,
        start_date: start_date || null,
        end_date: end_date || null,
        description: description || null,
        budget: budget || null,
        status: status || 'planned',
        recurrence_type: recurrence_type || 'once',
        recurrence_days: recurrence_type === 'weekly' ? recurrence_days : null,
      })
      .eq('id', id)
      .select()
      .single()

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    const { error } = await supabase
      .from('campaigns')
      .delete()
      .eq('id', id)

    if (error) return apiError(error.message, 500)

    return apiSuccess({ deleted: true })
  } catch {
    return apiError('Internal server error', 500)
  }
}
