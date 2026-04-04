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

    const updateFields: Record<string, unknown> = {}
    const allowedFields = [
      'kol_name', 'kol_handle', 'collaboration_date', 'featured_products',
      'collaboration_fee', 'fee_type', 'responsible_staff', 'notes', 'status',
    ]

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateFields[field] = body[field]
      }
    }

    if (Object.keys(updateFields).length === 0) {
      return apiError('No fields to update', 400)
    }

    const { data, error } = await supabase
      .from('kol_collaborations')
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
