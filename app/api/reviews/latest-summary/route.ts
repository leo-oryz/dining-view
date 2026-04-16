import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)

    const supabase = createServiceClient()

    const { data, error } = await supabase
      .from('google_review_snapshots')
      .select('*')
      .eq('store_id', storeId)
      .order('snapshot_date', { ascending: false })
      .limit(2)

    if (error) {
      return apiError(error.message, 500)
    }

    const latest = data?.[0] || null
    const previous = data?.[1] || null

    return apiSuccess({ latest, previous })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    return apiError(msg, 500)
  }
}
