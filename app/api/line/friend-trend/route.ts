import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('line_broadcasts')
      .select('broadcast_date, friend_count_after')
      .eq('store_id', storeId)
      .not('friend_count_after', 'is', null)
      .order('broadcast_date')

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch {
    return apiError('Internal server error', 500)
  }
}
