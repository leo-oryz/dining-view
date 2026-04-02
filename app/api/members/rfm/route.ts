import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams
    const storeId = getStoreId(params)

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('ocard_rfm_snapshots')
      .select('*')
      .eq('store_id', storeId)
      .order('snapshot_date', { ascending: true })

    if (error) return apiError(error.message, 500)

    return apiSuccess(data || [])
  } catch {
    return apiError('Internal server error', 500)
  }
}
