import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { scrapePost } from '@/lib/kol/apifyKolClient'
import { KolPlatform } from '@/lib/kol/platformDetector'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const supabase = createServiceClient()

    // Get the post record
    const { data: post, error: fetchError } = await supabase
      .from('kol_posts')
      .select('*')
      .eq('id', id)
      .single()

    if (fetchError || !post) {
      return apiError('Post not found', 404)
    }

    // Mark as pending
    await supabase
      .from('kol_posts')
      .update({ sync_status: 'pending', sync_error: null })
      .eq('id', id)

    try {
      const result = await scrapePost(post.platform as KolPlatform, post.post_url)

      const { error: updateError } = await supabase
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
        .eq('id', id)

      if (updateError) return apiError(updateError.message, 500)

      const { data: updated } = await supabase
        .from('kol_posts')
        .select('*')
        .eq('id', id)
        .single()

      return apiSuccess(updated)
    } catch (err) {
      await supabase
        .from('kol_posts')
        .update({
          sync_status: 'failed',
          sync_error: err instanceof Error ? err.message : String(err),
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', id)

      return apiError(
        `Sync failed: ${err instanceof Error ? err.message : String(err)}`,
        500
      )
    }
  } catch {
    return apiError('Internal server error', 500)
  }
}
