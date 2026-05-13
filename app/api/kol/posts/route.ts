import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { detectPlatform, isDetectionError, KolPlatform } from '@/lib/kol/platformDetector'
import { scrapePost } from '@/lib/kol/apifyKolClient'

const SCRAPABLE_PLATFORMS: KolPlatform[] = ['instagram', 'facebook', 'tiktok', 'threads', 'youtube']

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { collaboration_id, post_url, store_id, platform: manualPlatform, views, likes, comments } = body

    if (!collaboration_id || !post_url) {
      return apiError('collaboration_id and post_url are required', 400)
    }

    // Detect platform from URL
    const detection = detectPlatform(post_url)
    if (isDetectionError(detection)) {
      return apiError(detection.error, 400)
    }

    // Use manual platform if provided, otherwise use auto-detected
    const platform: KolPlatform = manualPlatform || detection.platform
    if (!platform) {
      return apiError('無法辨識平台，請手動選擇平台類型', 400)
    }

    const supabase = createServiceClient()
    const canScrape = SCRAPABLE_PLATFORMS.includes(platform)

    // Insert post record
    const { data: post, error: insertError } = await supabase
      .from('kol_posts')
      .upsert(
        {
          collaboration_id,
          store_id: store_id || '00000000-0000-0000-0000-000000000001',
          platform,
          post_url: detection.url,
          sync_status: canScrape ? 'pending' : 'synced',
          // For non-scrapable platforms, save manually provided data
          ...(!canScrape && {
            views: views ?? null,
            likes: likes ?? null,
            comments: comments ?? null,
            last_synced_at: new Date().toISOString(),
          }),
        },
        { onConflict: 'collaboration_id,post_url' }
      )
      .select()
      .single()

    if (insertError) return apiError(insertError.message, 500)

    // Only trigger Apify scrape for supported platforms
    if (canScrape) {
      scrapePost(platform, detection.url)
        .then(async (result) => {
          await supabase
            .from('kol_posts')
            .update({
              likes: result.data.likes,
              comments: result.data.comments,
              shares: result.data.shares,
              views: result.data.views,
              saves: result.data.saves,
              reach: result.data.reach,
              post_date: result.data.post_date,
              apify_run_id: result.runId,
              sync_status: 'synced',
              last_synced_at: new Date().toISOString(),
              sync_error: null,
            })
            .eq('id', post.id)
        })
        .catch(async (err) => {
          await supabase
            .from('kol_posts')
            .update({
              sync_status: 'failed',
              sync_error: err instanceof Error ? err.message : String(err),
              last_synced_at: new Date().toISOString(),
            })
            .eq('id', post.id)
        })
    }

    return apiSuccess(post)
  } catch {
    return apiError('Internal server error', 500)
  }
}
