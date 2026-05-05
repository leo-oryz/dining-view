import { createServiceClient } from '@/lib/supabase/server'
import {
  fetchIGProfile,
  fetchIGInsights,
  fetchIGMedia,
  isIGConfigured,
  type IGConfig,
} from './instagram/client'
import { transformIGDaily, transformIGMedia } from './instagram/transformer'
import {
  fetchFBProfile,
  fetchFBInsights,
  fetchFBPosts,
  isFBConfigured,
  type FBConfig,
} from './facebook/client'
import { transformFBDaily, transformFBPosts } from './facebook/transformer'
import {
  fetchTTAccount,
  fetchTTVideos,
  isTTConfigured,
  type TTConfig,
} from './tiktok/client'
import { transformTTDaily, transformTTVideos } from './tiktok/transformer'
import { syncWindowDays } from './shared'

const KEYS = {
  IG_TOKEN: 'instagram_access_token',
  IG_USER_ID: 'instagram_user_id',
  FB_TOKEN: 'facebook_page_access_token',
  FB_PAGE_ID: 'facebook_page_id',
  TT_TOKEN: 'tiktok_access_token',
} as const

interface StoreCreds {
  ig: IGConfig
  fb: FBConfig
  tt: TTConfig
}

async function loadStoreCreds(
  supabase: ReturnType<typeof createServiceClient>,
  storeId: string,
): Promise<StoreCreds> {
  const { data } = await supabase
    .from('store_settings')
    .select('setting_key, setting_value')
    .eq('store_id', storeId)
    .in('setting_key', Object.values(KEYS))

  const map = new Map<string, string>()
  for (const row of data ?? []) {
    if (row.setting_value) map.set(row.setting_key as string, row.setting_value as string)
  }
  return {
    ig: { accessToken: map.get(KEYS.IG_TOKEN), igUserId: map.get(KEYS.IG_USER_ID) },
    fb: { accessToken: map.get(KEYS.FB_TOKEN), pageId: map.get(KEYS.FB_PAGE_ID) },
    tt: { accessToken: map.get(KEYS.TT_TOKEN) },
  }
}

async function getLastSyncedAt(
  supabase: ReturnType<typeof createServiceClient>,
  storeId: string,
  platform: string,
): Promise<string | null> {
  const { data } = await supabase
    .from('social_accounts')
    .select('last_synced_at')
    .eq('store_id', storeId)
    .eq('platform', platform)
    .maybeSingle()
  return (data?.last_synced_at as string | null) ?? null
}

async function markSynced(
  supabase: ReturnType<typeof createServiceClient>,
  storeId: string,
  platform: string,
) {
  await supabase
    .from('social_accounts')
    .upsert(
      {
        store_id: storeId,
        platform,
        is_active: true,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: 'store_id,platform' },
    )
}

export interface PlatformSyncResult {
  store: string
  store_id: string
  platform: 'instagram' | 'facebook' | 'tiktok'
  daily?: number
  posts?: number
  skipped?: boolean
  error?: string
}

export async function syncSocial(options?: {
  storeId?: string
}): Promise<PlatformSyncResult[]> {
  const supabase = createServiceClient()

  let storesQuery = supabase.from('stores').select('id, name')
  if (options?.storeId) storesQuery = storesQuery.eq('id', options.storeId)
  const { data: stores, error: storesErr } = await storesQuery
  if (storesErr) throw storesErr
  if (!stores?.length) return []

  const results: PlatformSyncResult[] = []

  for (const store of stores) {
    const storeId = store.id as string
    const storeName = store.name as string
    const creds = await loadStoreCreds(supabase, storeId)

    // Instagram
    {
      const result: PlatformSyncResult = { store: storeName, store_id: storeId, platform: 'instagram' }
      if (!isIGConfigured(creds.ig)) {
        result.skipped = true
      } else {
        try {
          const lastSynced = await getLastSyncedAt(supabase, storeId, 'instagram')
          const days = syncWindowDays(lastSynced)
          const untilUnix = Math.floor(Date.now() / 1000)
          const sinceUnix = untilUnix - days * 86400
          const [profile, insights, media] = await Promise.all([
            fetchIGProfile(creds.ig),
            fetchIGInsights({ sinceUnix, untilUnix }, creds.ig),
            fetchIGMedia({ limit: 50 }, creds.ig),
          ])
          const dailyRows = transformIGDaily(profile, insights, storeId)
          if (dailyRows.length) {
            const { error } = await supabase
              .from('social_daily_metrics')
              .upsert(dailyRows, { onConflict: 'store_id,platform,date' })
            if (error) throw error
          }
          const postRows = transformIGMedia(media, storeId)
          if (postRows.length) {
            const { error } = await supabase
              .from('social_post_metrics')
              .upsert(postRows, { onConflict: 'store_id,platform,post_id' })
            if (error) throw error
          }
          result.daily = dailyRows.length
          result.posts = postRows.length
          await markSynced(supabase, storeId, 'instagram')
        } catch (err) {
          result.error = err instanceof Error ? err.message : String(err)
        }
      }
      results.push(result)
    }

    // Facebook
    {
      const result: PlatformSyncResult = { store: storeName, store_id: storeId, platform: 'facebook' }
      if (!isFBConfigured(creds.fb)) {
        result.skipped = true
      } else {
        try {
          const lastSynced = await getLastSyncedAt(supabase, storeId, 'facebook')
          const days = syncWindowDays(lastSynced)
          const untilUnix = Math.floor(Date.now() / 1000)
          const sinceUnix = untilUnix - days * 86400
          const [profile, insights, posts] = await Promise.all([
            fetchFBProfile(creds.fb),
            fetchFBInsights({ sinceUnix, untilUnix }, creds.fb),
            fetchFBPosts({ limit: 50 }, creds.fb),
          ])
          const dailyRows = transformFBDaily(profile, insights, storeId)
          if (dailyRows.length) {
            const { error } = await supabase
              .from('social_daily_metrics')
              .upsert(dailyRows, { onConflict: 'store_id,platform,date' })
            if (error) throw error
          }
          const postRows = transformFBPosts(posts, storeId)
          if (postRows.length) {
            const { error } = await supabase
              .from('social_post_metrics')
              .upsert(postRows, { onConflict: 'store_id,platform,post_id' })
            if (error) throw error
          }
          result.daily = dailyRows.length
          result.posts = postRows.length
          await markSynced(supabase, storeId, 'facebook')
        } catch (err) {
          result.error = err instanceof Error ? err.message : String(err)
        }
      }
      results.push(result)
    }

    // TikTok
    {
      const result: PlatformSyncResult = { store: storeName, store_id: storeId, platform: 'tiktok' }
      if (!isTTConfigured(creds.tt)) {
        result.skipped = true
      } else {
        try {
          const [account, videos] = await Promise.all([
            fetchTTAccount(creds.tt),
            fetchTTVideos(creds.tt),
          ])
          const dailyRows = transformTTDaily(account, storeId)
          if (dailyRows.length) {
            const { error } = await supabase
              .from('social_daily_metrics')
              .upsert(dailyRows, { onConflict: 'store_id,platform,date' })
            if (error) throw error
          }
          const postRows = transformTTVideos(videos, storeId)
          if (postRows.length) {
            const { error } = await supabase
              .from('social_post_metrics')
              .upsert(postRows, { onConflict: 'store_id,platform,post_id' })
            if (error) throw error
          }
          result.daily = dailyRows.length
          result.posts = postRows.length
          await markSynced(supabase, storeId, 'tiktok')
        } catch (err) {
          result.error = err instanceof Error ? err.message : String(err)
        }
      }
      results.push(result)
    }
  }

  return results
}
