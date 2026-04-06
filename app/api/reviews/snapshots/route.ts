import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const limit = Math.min(Number(searchParams.get('limit')) || 52, 200)
    const startDate = searchParams.get('start_date')
    const endDate = searchParams.get('end_date')

    const supabase = createServiceClient()

    let query = supabase
      .from('google_review_snapshots')
      .select('*')
      .eq('store_id', storeId)

    if (startDate) query = query.gte('snapshot_date', startDate)
    if (endDate) query = query.lte('snapshot_date', endDate)

    query = query.order('snapshot_date', { ascending: false }).limit(limit)

    const { data, error } = await query

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    return apiError(msg, 500)
  }
}
