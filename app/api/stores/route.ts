import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'

export async function GET() {
  try {
    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('stores')
      .select('id, name, location, timezone, is_active, created_at')
      .order('name')

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (!body.name) {
      return apiError('Store name is required', 400)
    }

    const supabase = createServiceClient()

    const row = {
      name: body.name,
      location: body.location || null,
      timezone: body.timezone || 'Asia/Taipei',
      is_active: true,
      credentials: body.credentials || {},
    }

    const { data, error } = await supabase
      .from('stores')
      .insert(row)
      .select('id, name, location, timezone, is_active, created_at')
      .single()

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
