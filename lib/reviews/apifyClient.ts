import { createServiceClient } from '@/lib/supabase/server'

interface ApifyReviewRaw {
  // Field names based on Apify Google Maps Reviews Scraper output
  // TODO: Confirm field names after first raw result log
  reviewId?: string
  name?: string
  stars?: number
  text?: string
  publishedAtDate?: string
  likesCount?: number
  reviewUrl?: string
  reviewerId?: string
  isLocalGuide?: boolean
  // Fallback field names (some Apify actors use different naming)
  review_id?: string
  reviewer_name?: string
  rating?: number
  review_text?: string
  published_at?: string
}

export interface ParsedReview {
  review_id: string
  reviewer_name: string | null
  rating: number | null
  review_text: string | null
  review_date: string // YYYY-MM-DD
  is_negative: boolean
}

/**
 * Fetch reviews from Apify Google Maps Reviews Scraper.
 * Incremental: only fetches reviews newer than the latest in DB.
 */
export async function fetchApifyReviews(
  storeId: string,
  placeId: string
): Promise<{ reviews: ParsedReview[]; rawSample: unknown }> {
  const apiToken = process.env.APIFY_API_TOKEN
  if (!apiToken) throw new Error('APIFY_API_TOKEN not configured')

  const supabase = createServiceClient()

  // Get the latest review date in DB for incremental fetch
  const { data: latestReview } = await supabase
    .from('google_reviews')
    .select('review_date')
    .eq('store_id', storeId)
    .order('review_date', { ascending: false })
    .limit(1)
    .single()

  const sinceDate = latestReview?.review_date || null

  // Run the Apify actor
  const actorId = process.env.APIFY_ACTOR_ID || 'Xb8osYTtOjlsgI6k9' // default: Google Maps Reviews Scraper
  const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiToken}`

  const input: Record<string, unknown> = {
    startUrls: [{ url: `https://www.google.com/maps/place/?q=place_id:${placeId}` }],
    maxReviews: 200,
    reviewsSort: 'newest',
    language: 'zh-TW',
  }

  // Start actor run
  const runRes = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!runRes.ok) {
    throw new Error(`Apify run failed: ${runRes.status} ${await runRes.text()}`)
  }

  const runData = await runRes.json()
  const runId = runData.data?.id

  if (!runId) throw new Error('No run ID returned from Apify')

  // Poll for completion (max 5 minutes)
  const pollUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`
  let status = runData.data?.status || 'RUNNING'
  const maxAttempts = 30
  for (let i = 0; i < maxAttempts && (status === 'RUNNING' || status === 'READY'); i++) {
    await new Promise(r => setTimeout(r, 10_000)) // 10s intervals
    const pollRes = await fetch(pollUrl)
    const pollData = await pollRes.json()
    status = pollData.data?.status
  }

  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run did not succeed: status=${status}`)
  }

  // Fetch results from dataset
  const datasetUrl = `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiToken}`
  const dataRes = await fetch(datasetUrl)
  if (!dataRes.ok) {
    throw new Error(`Failed to fetch dataset: ${dataRes.status}`)
  }

  const rawResults: ApifyReviewRaw[] = await dataRes.json()

  // Log first raw result for field name confirmation
  if (rawResults.length > 0) {
    console.log('[apifyClient] First raw review result:')
    console.log(JSON.stringify(rawResults[0], null, 2))
  }

  // Parse reviews
  const reviews: ParsedReview[] = []
  for (const raw of rawResults) {
    const reviewId = raw.reviewId || raw.review_id || raw.reviewerId
    const reviewDate = raw.publishedAtDate || raw.published_at
    if (!reviewId || !reviewDate) continue

    const dateStr = new Date(reviewDate).toISOString().split('T')[0]

    // Incremental: skip reviews older than what we already have
    if (sinceDate && dateStr <= sinceDate) continue

    const rating = raw.stars ?? raw.rating ?? null
    const isNegative = rating != null && rating <= 3

    reviews.push({
      review_id: String(reviewId),
      reviewer_name: raw.name || raw.reviewer_name || null,
      rating,
      review_text: raw.text || raw.review_text || null,
      review_date: dateStr,
      is_negative: isNegative,
    })
  }

  return { reviews, rawSample: rawResults[0] || null }
}

/**
 * Save parsed reviews to DB via upsert.
 */
export async function saveReviews(
  storeId: string,
  reviews: ParsedReview[]
): Promise<number> {
  if (reviews.length === 0) return 0

  const supabase = createServiceClient()

  const rows = reviews.map(r => ({
    store_id: storeId,
    review_id: r.review_id,
    reviewer_name: r.reviewer_name,
    rating: r.rating,
    review_text: r.review_text,
    review_date: r.review_date,
    is_negative: r.is_negative,
    source: 'apify',
  }))

  const { error } = await supabase
    .from('google_reviews')
    .upsert(rows, { onConflict: 'store_id,review_id' })

  if (error) throw new Error(`Failed to save reviews: ${error.message}`)

  return reviews.length
}
