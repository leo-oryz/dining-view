import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('campaigns')
      .select('*')
      .eq('store_id', storeId)
      .order('start_date', { ascending: false })
      .limit(50)

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { name, type, start_date, end_date, description, budget, store_id, recurrence_type, recurrence_days } = body

    if (!name) return apiError('Campaign name is required', 400)

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('campaigns')
      .insert({
        store_id: store_id || DEFAULT_STORE_ID,
        name,
        type: type || null,
        start_date: start_date || null,
        end_date: end_date || null,
        description: description || null,
        budget: budget || null,
        status: 'planned',
        recurrence_type: recurrence_type || 'once',
        recurrence_days: recurrence_type === 'weekly' ? recurrence_days : null,
      })
      .select()
      .single()

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
