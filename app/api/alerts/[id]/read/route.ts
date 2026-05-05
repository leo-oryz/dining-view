import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'

export async function PATCH(
  _request: NextRequest,
  { params }: { params: { id: string } },
) {
  const id = params.id
  if (!id) return apiError('Missing id', 400)

  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('alert_history')
    .update({ is_read: true })
    .eq('id', id)
    .select('id, is_read')
    .single()

  if (error) return apiError(error.message, 500)
  return apiSuccess(data)
}
