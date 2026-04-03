import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'

export async function PUT(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profile = await getSession()
  if (!profile) return apiError('Not authenticated', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)

  const { id } = await params

  try {
    const supabase = createServiceClient()

    // Get current state
    const { data: store } = await supabase
      .from('stores')
      .select('is_active')
      .eq('id', id)
      .single()

    if (!store) return apiError('Store not found', 404)

    const newStatus = !store.is_active

    const { data, error } = await supabase
      .from('stores')
      .update({ is_active: newStatus })
      .eq('id', id)
      .select('id, name, is_active')
      .single()

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
