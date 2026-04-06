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

    const allowedFields = [
      'post_url', 'platform', 'post_date',
      'views', 'likes', 'comments', 'shares', 'saves', 'reach',
    ]

    const updateFields: Record<string, unknown> = {}
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field]
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return apiError('No fields to update', 400)
    }

    const { data, error } = await supabase
      .from('kol_posts')
      .update(updateFields)
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
      .from('kol_posts')
      .delete()
      .eq('id', id)

    if (error) return apiError(error.message, 500)
    return apiSuccess({ deleted: id })
  } catch {
    return apiError('Internal server error', 500)
  }
}
