import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { scrapePost } from '@/lib/kol/apifyKolClient'
import { KolPlatform } from '@/lib/kol/platformDetector'

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export async function POST(_request: NextRequest) {
  try {
    const supabase = createServiceClient()

    // Get all posts from active collaborations
    const { data: posts, error } = await supabase
      .from('kol_posts')
      .select('id, platform, post_url, collaboration_id, kol_collaborations!inner(status)')
      .eq('kol_collaborations.status', 'active')

    if (error) return apiError(error.message, 500)
    if (!posts || posts.length === 0) {
      return apiSuccess({ synced: 0, failed: 0, message: 'No active posts to sync' })
    }

    let synced = 0
    let failed = 0

    // Process sequentially to avoid Apify rate limits
    for (const post of posts) {
      try {
        const result = await scrapePost(post.platform as KolPlatform, post.post_url)
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
        synced++
      } catch (err) {
        await supabase
          .from('kol_posts')
          .update({
            sync_status: 'failed',
            sync_error: err instanceof Error ? err.message : String(err),
            last_synced_at: new Date().toISOString(),
          })
          .eq('id', post.id)
        failed++
      }
    }

    return apiSuccess({ synced, failed, total: posts.length })
  } catch {
    return apiError('Internal server error', 500)
  }
}
