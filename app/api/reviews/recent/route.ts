import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)
    const limit = Math.min(Number(searchParams.get('limit')) || 50, 200)
    const cursor = searchParams.get('cursor')

    const supabase = createServiceClient()

    let query = supabase
      .from('google_reviews')
      .select('id, review_id, reviewer_name, rating, review_text, review_date, is_negative, created_at')
      .eq('store_id', storeId)
      .order('review_date', { ascending: false })
      .limit(limit)

    if (cursor) {
      query = query.lt('id', cursor)
    }

    const { data, error } = await query

    if (error) return apiError(error.message, 500)

    return apiSuccess(data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    return apiError(msg, 500)
  }
}
