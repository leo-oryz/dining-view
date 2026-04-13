import { fetchApifyReviews, saveReviews } from '@/lib/reviews/apifyClient'
import { createReviewSnapshot } from '@/lib/reviews/reviewAnalyzer'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { createServiceClient } from '@/lib/supabase/server'

export const maxDuration = 300

export async function POST(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const storeId = getStoreId(searchParams)

    // Get place ID from store record
    const supabase = createServiceClient()
    const { data: store } = await supabase
      .from('stores')
      .select('google_place_id')
      .eq('id', storeId)
      .single()

    const placeId = store?.google_place_id || process.env.GOOGLE_PLACE_ID
    if (!placeId) {
      return apiError('GOOGLE_PLACE_ID not configured for this store', 400)
    }

    // Fetch reviews from Apify
    const { reviews, rawSample } = await fetchApifyReviews(storeId, placeId)

    // Save to DB
    const saved = await saveReviews(storeId, reviews)

    // Create weekly snapshot
    const today = new Date().toISOString().split('T')[0]
    await createReviewSnapshot(storeId, today)

    return apiSuccess({
      new_reviews: saved,
      raw_sample: rawSample, // For field confirmation on first run
      snapshot_date: today,
    })
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Internal server error'
    return apiError(msg, 500)
  }
}
