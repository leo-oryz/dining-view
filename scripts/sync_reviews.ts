// Google Reviews sync — self-contained: Apify Google Maps Reviews → Supabase.
// Mirrors scripts/sync_weather.ts: works locally (.env.local) and in GitHub
// Actions (env vars from secrets). Idempotent: upserts on (store_id, review_id)
// so re-runs are safe. Incremental: skips reviews older than what's in DB.
//
// Why this exists: the in-process node-cron in scripts/scheduler.ts only fires
// while the Zeabur Next.js process is alive (same reliability issue that
// pushed weather sync to CI). Drive review sync from CI so it's not gated on
// the Zeabur deploy being awake at 04:00.
import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { createClient } from '@supabase/supabase-js'

const envPath = resolve(__dirname, '../.env.local')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf-8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i === -1) continue
    const k = t.slice(0, i)
    let v = t.slice(i + 1)
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1)
    if (!process.env[k]) process.env[k] = v
  }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const APIFY_TOKEN = process.env.APIFY_API_TOKEN
const APIFY_ACTOR_ID = process.env.APIFY_ACTOR_ID || 'Xb8osYTtOjlsgI6k9'

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
  process.exit(1)
}
if (!APIFY_TOKEN) {
  console.error('Missing APIFY_API_TOKEN')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY)

interface ApifyReviewRaw {
  reviewId?: string
  review_id?: string
  reviewerId?: string
  name?: string
  reviewer_name?: string
  stars?: number
  rating?: number
  text?: string
  review_text?: string
  publishedAtDate?: string
  published_at?: string
}

interface ParsedReview {
  review_id: string
  reviewer_name: string | null
  rating: number | null
  review_text: string | null
  review_date: string
  is_negative: boolean
}

async function syncStore(storeId: string, placeId: string, storeName: string) {
  const { data: latest } = await supabase
    .from('google_reviews')
    .select('review_date')
    .eq('store_id', storeId)
    .order('review_date', { ascending: false })
    .limit(1)
    .single()

  const sinceDate = latest?.review_date || null

  const runRes = await fetch(
    `https://api.apify.com/v2/acts/${APIFY_ACTOR_ID}/runs?token=${APIFY_TOKEN}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        startUrls: [{ url: `https://www.google.com/maps/place/?q=place_id:${placeId}` }],
        maxReviews: 200,
        reviewsSort: 'newest',
        language: 'zh-TW',
      }),
    }
  )
  if (!runRes.ok) {
    throw new Error(`Apify run start failed: ${runRes.status} ${await runRes.text()}`)
  }
  const runData = await runRes.json()
  const runId = runData.data?.id
  if (!runId) throw new Error('No run ID from Apify')

  let status = runData.data?.status || 'RUNNING'
  for (let i = 0; i < 30 && (status === 'RUNNING' || status === 'READY'); i++) {
    await new Promise((r) => setTimeout(r, 10_000))
    const pollRes = await fetch(
      `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_TOKEN}`
    )
    status = (await pollRes.json()).data?.status
  }
  if (status !== 'SUCCEEDED') {
    throw new Error(`Apify run did not succeed: status=${status}`)
  }

  const dataRes = await fetch(
    `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${APIFY_TOKEN}`
  )
  if (!dataRes.ok) throw new Error(`Apify dataset fetch failed: ${dataRes.status}`)
  const raws: ApifyReviewRaw[] = await dataRes.json()

  const reviews: ParsedReview[] = []
  for (const raw of raws) {
    const reviewId = raw.reviewId || raw.review_id || raw.reviewerId
    const reviewDate = raw.publishedAtDate || raw.published_at
    if (!reviewId || !reviewDate) continue
    const dateStr = new Date(reviewDate).toISOString().split('T')[0]
    if (sinceDate && dateStr <= sinceDate) continue
    const rating = raw.stars ?? raw.rating ?? null
    reviews.push({
      review_id: String(reviewId),
      reviewer_name: raw.name || raw.reviewer_name || null,
      rating,
      review_text: raw.text || raw.review_text || null,
      review_date: dateStr,
      is_negative: rating != null && rating <= 3,
    })
  }

  if (reviews.length === 0) {
    console.log(`[reviews-sync] ${storeName}: 0 new (since ${sinceDate ?? 'beginning'})`)
    return 0
  }

  const rows = reviews.map((r) => ({
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
  if (error) throw new Error(`Upsert failed: ${error.message}`)

  console.log(`[reviews-sync] ${storeName}: +${reviews.length} new`)
  return reviews.length
}

async function main() {
  const { data: stores, error: storesErr } = await supabase
    .from('stores')
    .select('id, name, google_place_id')
    .eq('is_active', true)

  if (storesErr) throw storesErr
  if (!stores?.length) {
    console.log('[reviews-sync] no active stores')
    return
  }

  let totalNew = 0
  let failures = 0
  for (const store of stores) {
    const placeId = store.google_place_id
    if (!placeId) {
      console.log(`[reviews-sync] ${store.name}: skip (no google_place_id)`)
      continue
    }
    try {
      totalNew += await syncStore(store.id, placeId, store.name)
    } catch (err) {
      failures++
      console.error(`[reviews-sync] ${store.name}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log(`[reviews-sync] done — ${totalNew} new across ${stores.length} stores (${failures} failures)`)
  if (failures > 0) process.exit(1)
}

main().catch((e) => {
  console.error('[reviews-sync]', e)
  process.exit(1)
})
