import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId, DEFAULT_STORE_ID } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('line_broadcasts')
      .select('*')
      .eq('store_id', storeId)
      .order('broadcast_date', { ascending: false })
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
    const {
      broadcast_date, title, message, target_audience,
      friend_count_before, friend_count_after,
      delivered, opened, clicked, store_id,
    } = body

    if (!broadcast_date || !title) {
      return apiError('broadcast_date and title are required', 400)
    }

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('line_broadcasts')
      .upsert(
        {
          store_id: store_id || DEFAULT_STORE_ID,
          broadcast_date,
          title,
          message: message || null,
          target_audience: target_audience || null,
          friend_count_before: friend_count_before ?? null,
          friend_count_after: friend_count_after ?? null,
          delivered: delivered ?? null,
          opened: opened ?? null,
          clicked: clicked ?? null,
        },
        { onConflict: 'store_id,broadcast_date,title' }
      )
      .select()
      .single()

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
