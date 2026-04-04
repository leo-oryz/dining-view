import { KolPlatform } from './platformDetector'

/** Apify actor IDs per platform */
const ACTOR_MAP: Record<KolPlatform, string> = {
  instagram: 'apify/instagram-post-scraper',
  facebook: 'apify/facebook-posts-scraper',
  tiktok: 'clockworks/tiktok-scraper',
  threads: 'apify/threads-scraper',
  youtube: 'streamers/youtube-scraper',
  blogger: 'apify/blogger-scraper',
}

export interface ScrapedPostData {
  views: number | null
  likes: number | null
  comments: number | null
  shares: number | null
  saves: number | null
  reach: number | null
  post_date: string | null // YYYY-MM-DD
}

/**
 * Start an Apify actor run for the given platform and post URL.
 * Returns the run ID for polling.
 */
async function startActorRun(
  platform: KolPlatform,
  postUrl: string,
  apiToken: string
): Promise<string> {
  const actorId = ACTOR_MAP[platform]
  const runUrl = `https://api.apify.com/v2/acts/${actorId}/runs?token=${apiToken}`

  // Build platform-specific input
  let input: Record<string, unknown>

  switch (platform) {
    case 'instagram':
      input = { directUrls: [postUrl], resultsLimit: 1 }
      break
    case 'tiktok':
      input = { postURLs: [postUrl], resultsPerPage: 1 }
      break
    case 'facebook':
      input = { startUrls: [{ url: postUrl }], resultsLimit: 1 }
      break
    case 'threads':
      input = { startUrls: [{ url: postUrl }], resultsLimit: 1 }
      break
    case 'youtube':
      input = { startUrls: [{ url: postUrl }], maxResults: 1 }
      break
    case 'blogger':
      input = { startUrls: [{ url: postUrl }], resultsLimit: 1 }
      break
  }

  const res = await fetch(runUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  if (!res.ok) {
    throw new Error(`Apify run failed: ${res.status} ${await res.text()}`)
  }

  const data = await res.json()
  const runId = data.data?.id
  if (!runId) throw new Error('No run ID returned from Apify')

  return runId
}

/**
 * Poll an Apify run until it completes (max 60 seconds).
 */
async function pollRunCompletion(runId: string, apiToken: string): Promise<void> {
  const pollUrl = `https://api.apify.com/v2/actor-runs/${runId}?token=${apiToken}`
  const maxAttempts = 20 // 20 * 3s = 60s

  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 3000))
    const res = await fetch(pollUrl)
    const data = await res.json()
    const status = data.data?.status

    if (status === 'SUCCEEDED') return
    if (status === 'FAILED' || status === 'ABORTED') {
      throw new Error(`Apify run ${status}`)
    }
    // RUNNING or READY → keep polling
  }

  throw new Error('Apify run timed out after 60 seconds')
}

/**
 * Fetch results from a completed run's dataset.
 */
async function fetchRunResults(runId: string, apiToken: string): Promise<unknown[]> {
  const url = `https://api.apify.com/v2/actor-runs/${runId}/dataset/items?token=${apiToken}`
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Failed to fetch dataset: ${res.status}`)
  return res.json()
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toInt(val: any): number | null {
  if (val == null) return null
  const n = Number(val)
  return isNaN(n) ? null : Math.round(n)
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDateStr(val: any): string | null {
  if (!val) return null
  try {
    // Handle unix timestamp (TikTok createTime)
    if (typeof val === 'number' && val > 1_000_000_000) {
      return new Date(val * 1000).toISOString().split('T')[0]
    }
    return new Date(val).toISOString().split('T')[0]
  } catch {
    return null
  }
}

/**
 * Parse platform-specific raw results into our unified format.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseResult(platform: KolPlatform, raw: any): ScrapedPostData {
  switch (platform) {
    case 'instagram':
      return {
        likes: toInt(raw.likesCount),
        comments: toInt(raw.commentsCount),
        views: toInt(raw.videoViewCount),
        shares: null,
        saves: null,
        reach: null,
        post_date: toDateStr(raw.timestamp),
      }
    case 'tiktok':
      return {
        likes: toInt(raw.diggCount),
        comments: toInt(raw.commentCount),
        shares: toInt(raw.shareCount),
        views: toInt(raw.playCount),
        saves: null,
        reach: null,
        post_date: toDateStr(raw.createTime),
      }
    case 'facebook':
      return {
        likes: toInt(raw.likes),
        comments: toInt(raw.comments),
        shares: toInt(raw.shares),
        views: null,
        saves: null,
        reach: null,
        post_date: toDateStr(raw.time || raw.date),
      }
    case 'threads':
      return {
        likes: toInt(raw.likeCount),
        comments: null,
        shares: toInt(raw.repostCount),
        views: null,
        saves: null,
        reach: null,
        post_date: toDateStr(raw.publishedAt || raw.timestamp),
      }
    case 'youtube':
      return {
        likes: toInt(raw.likes),
        comments: toInt(raw.comments),
        views: toInt(raw.viewCount),
        shares: null,
        saves: null,
        reach: null,
        post_date: toDateStr(raw.date || raw.uploadDate),
      }
    case 'blogger':
      return {
        likes: toInt(raw.likes),
        comments: toInt(raw.comments),
        views: toInt(raw.views),
        shares: null,
        saves: null,
        reach: null,
        post_date: toDateStr(raw.date || raw.publishedAt),
      }
  }
}

export interface ScrapeResult {
  data: ScrapedPostData
  runId: string
  rawSample: unknown
}

/**
 * Scrape a single post URL via Apify.
 * Only Instagram and TikTok are fully tested — other platforms use best-effort mapping.
 */
export async function scrapePost(
  platform: KolPlatform,
  postUrl: string
): Promise<ScrapeResult> {
  const apiToken = process.env.APIFY_API_TOKEN
  if (!apiToken) throw new Error('APIFY_API_TOKEN not configured')

  const runId = await startActorRun(platform, postUrl, apiToken)
  await pollRunCompletion(runId, apiToken)
  const results = await fetchRunResults(runId, apiToken)

  if (results.length === 0) {
    throw new Error('Apify returned no results for this URL')
  }

  // Log raw result for field name confirmation
  console.log(`[apifyKolClient] ${platform} raw result:`)
  console.log(JSON.stringify(results[0], null, 2))

  const data = parseResult(platform, results[0])

  return { data, runId, rawSample: results[0] }
}
