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

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('ad_campaigns')
      .update(body)
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
      .from('ad_campaigns')
      .delete()
      .eq('id', id)

    if (error) return apiError(error.message, 500)

    return apiSuccess({ deleted: true })
  } catch {
    return apiError('Internal server error', 500)
  }
}
