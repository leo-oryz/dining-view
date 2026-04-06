import { NextRequest } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { apiSuccess, apiError, DEFAULT_STORE_ID } from '@/lib/api-utils'
import { parseKolCsv, KolCsvRow } from '@/lib/parsers/kolCsvParser'
import { scrapePost } from '@/lib/kol/apifyKolClient'
import { KolPlatform } from '@/lib/kol/platformDetector'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const storeId = (formData.get('store_id') as string) || DEFAULT_STORE_ID

    if (!file) {
      return apiError('No file uploaded', 400)
    }

    const text = await file.text()
    const { data: rows, errors: parseErrors } = parseKolCsv(text)

    if (rows.length === 0) {
      return apiError(
        parseErrors.length > 0
          ? `解析失敗: ${parseErrors[0].message}`
          : '檔案中沒有有效的資料列',
        400
      )
    }

    const supabase = createServiceClient()
    let inserted = 0
    const rowErrors: { row: number; message: string }[] = []

    for (const row of rows) {
      try {
        // Upsert collaboration record
        const collabData = buildCollabRecord(row, storeId)

        const { data: collab, error: collabError } = await supabase
          .from('kol_collaborations')
          .upsert(collabData, {
            onConflict: 'store_id,kol_name,collaboration_date',
          })
          .select('id')
          .single()

        if (collabError) {
          rowErrors.push({ row: row.no || 0, message: collabError.message })
          continue
        }

        // Create kol_posts when there's a real URL (even without engagement data)
        const realUrl = isRealUrl(row.content_url)
        if (collab && realUrl) {
          // Detect platform from the actual URL, fallback to CSV platform column
          const postPlatform = detectPlatformFromUrl(row.content_url!) || mapToPostPlatform(row.platform)
          if (postPlatform) {
            await supabase
              .from('kol_posts')
              .upsert(
                {
                  collaboration_id: collab.id,
                  store_id: storeId,
                  platform: postPlatform,
                  post_url: row.content_url!,
                  post_date: row.collaboration_date,
                  sync_status: 'pending',
                },
                { onConflict: 'collaboration_id,post_url' }
              )
          }
        }

        // Determine if this was insert or update (rough heuristic)
        inserted++
      } catch (err) {
        rowErrors.push({
          row: row.no || 0,
          message: err instanceof Error ? err.message : String(err),
        })
      }
    }

    // Clean up any placeholder posts from previous uploads
    const { count: cleaned } = await supabase
      .from('kol_posts')
      .delete({ count: 'exact' })
      .eq('store_id', storeId)
      .like('post_url', 'https://placeholder.local/%')

    // Trigger Apify sync for all pending posts in the background
    const { data: pendingPosts } = await supabase
      .from('kol_posts')
      .select('id, platform, post_url')
      .eq('store_id', storeId)
      .eq('sync_status', 'pending')

    const scrapablePlatforms = ['instagram', 'facebook', 'tiktok']

    if (pendingPosts && pendingPosts.length > 0) {
      // Fire and forget — don't block the response
      syncPendingPosts(supabase, pendingPosts, scrapablePlatforms)
    }

    return apiSuccess({
      total: rows.length,
      processed: inserted,
      syncing: pendingPosts?.filter(p => scrapablePlatforms.includes(p.platform)).length || 0,
      errors: rowErrors,
      parseErrors,
      cleaned_placeholder_posts: cleaned || 0,
    })
  } catch {
    return apiError('Internal server error', 500)
  }
}

function buildCollabRecord(row: KolCsvRow, storeId: string) {
  return {
    store_id: storeId,
    kol_name: row.kol_name,
    kol_handle: row.kol_name, // Use name as handle since CSV doesn't have @handle
    collaboration_date: row.collaboration_date,
    collaboration_fee: row.collaboration_fee,
    fee_type: row.collaboration_fee ? 'cash' : null,
    status: row.payment_status === '完成' ? 'completed' : 'active',
    contract_number: row.contract_number,
    real_name: row.real_name,
    platform: row.platform,
    party_size: row.party_size,
    visit_time: row.visit_time,
    contact_info: row.contact_info,
    confirmation_status: row.confirmation_status,
    contract_sent: row.contract_sent,
    visit_status: row.visit_status,
    content_status: row.content_status,
    content_type: row.content_type,
    invoice_status_1: row.invoice_status_1,
    invoice_status_2: row.invoice_status_2,
    payment_status: row.payment_status,
    content_url: row.content_url,
    engagement_rate: row.engagement_rate,
    notes: row.contact_info, // Store contact as notes too for visibility
  }
}

/**
 * Detect platform from the actual URL (more accurate than CSV column)
 */
function detectPlatformFromUrl(url: string): string | null {
  if (/instagram\.com/i.test(url)) return 'instagram'
  if (/facebook\.com/i.test(url)) return 'facebook'
  if (/tiktok\.com/i.test(url)) return 'tiktok'
  if (/threads\.net/i.test(url)) return 'threads'
  if (/youtube\.com|youtu\.be/i.test(url)) return 'youtube'
  return null // Unknown URL → fall back to CSV platform column
}

/**
 * Check if a content_url is a real URL (not a label like "Link" or "圖文連結")
 */
function isRealUrl(url: string | null): boolean {
  if (!url) return false
  const trimmed = url.trim()
  return trimmed.startsWith('http://') || trimmed.startsWith('https://')
}

/**
 * Map CSV platform names to kol_posts platform enum
 */
function mapToPostPlatform(platform: string | null): string | null {
  if (!platform) return null
  switch (platform) {
    case 'instagram': return 'instagram'
    case 'facebook': return 'facebook'
    case 'tiktok': return 'tiktok'
    case 'threads': return 'threads'
    case 'youtube': return 'youtube'
    case 'blogger': return 'blogger'
    default: return null
  }
}

/**
 * Sync pending posts via Apify in the background (sequentially to avoid rate limits)
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function syncPendingPosts(supabase: any, posts: { id: string; platform: string; post_url: string }[], scrapablePlatforms: string[]) {
  for (const post of posts) {
    if (!scrapablePlatforms.includes(post.platform)) {
      // Non-scrapable (blogger etc.) — mark synced with no data
      await supabase
        .from('kol_posts')
        .update({ sync_status: 'synced', last_synced_at: new Date().toISOString() })
        .eq('id', post.id)
      continue
    }

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
      console.log(`[kol-upload] Synced post ${post.id} (${post.platform})`)
    } catch (err) {
      await supabase
        .from('kol_posts')
        .update({
          sync_status: 'failed',
          sync_error: err instanceof Error ? err.message : String(err),
          last_synced_at: new Date().toISOString(),
        })
        .eq('id', post.id)
      console.error(`[kol-upload] Failed to sync post ${post.id}:`, err)
    }
  }
}
