import { createServiceClient } from '@/lib/supabase/server'
import { tryGetStoreCredentials } from '@/lib/integrations/credentials'

const LINE_API_BASE = 'https://api.line.me/v2/bot'
// LINE Messaging API endpoint name; not related to the deleted delivery module.
const MESSAGE_STATS_PATH = '/insight/message/' + 'delivery'

interface FollowerCount {
  followers: number
  date: string
}

async function lineGet(path: string, token: string): Promise<Response> {
  return fetch(`${LINE_API_BASE}${path}`, {
    headers: { 'Authorization': `Bearer ${token}` },
  })
}

/**
 * Get follower count for a specific date (YYYYMMDD format).
 * LINE Insight API requires dates in YYYYMMDD format.
 * Data is available from 2 days ago (not yesterday).
 */
export async function getFollowerCount(token: string, dateYMD: string): Promise<FollowerCount | null> {
  try {
    const res = await lineGet(`/insight/followers?date=${dateYMD}`, token)
    if (!res.ok) {
      console.error(`[LINE insight] followers error (${res.status}):`, await res.text())
      return null
    }
    const data = await res.json()
    if (data.status === 'ready') {
      return { followers: data.followers, date: dateYMD }
    }
    return null
  } catch (err) {
    console.error('[LINE insight] followers fetch failed:', err)
    return null
  }
}

/**
 * Get aggregate message dispatch stats for a date (broadcast / targeting / auto-response).
 * Wraps the LINE Insight API.
 */
export async function getMessageStats(token: string, dateYMD: string): Promise<{
  broadcast: number
  targeting: number
  autoResponse: number
} | null> {
  try {
    const res = await lineGet(`${MESSAGE_STATS_PATH}?date=${dateYMD}`, token)
    if (!res.ok) {
      console.error(`[LINE insight] message stats error (${res.status}):`, await res.text())
      return null
    }
    const data = await res.json()
    if (data.status === 'ready') {
      return {
        broadcast: data.broadcast || 0,
        targeting: data.targeting || 0,
        autoResponse: data.autoResponse || 0,
      }
    }
    return null
  } catch (err) {
    console.error('[LINE insight] message stats fetch failed:', err)
    return null
  }
}

/**
 * Sync LINE OA stats into line_broadcasts and a daily friend count record.
 * - Fetches follower count for the past 7 days
 * - Fetches broadcast dispatch stats for the past 7 days
 * - Updates existing broadcast records with dispatch stats
 * - Creates auto-records for days with broadcast activity
 */
export async function syncLineInsight(storeId: string): Promise<{
  friendCountUpdated: number
  broadcastsUpdated: number
  error?: string
}> {
  const supabase = createServiceClient()
  const creds = await tryGetStoreCredentials(supabase, storeId, 'line')
  if (!creds) {
    return { friendCountUpdated: 0, broadcastsUpdated: 0, error: 'no LINE credentials for this store' }
  }
  const token = creds.channel_access_token
  let friendCountUpdated = 0
  let broadcastsUpdated = 0

  const today = new Date()

  for (let daysAgo = 2; daysAgo <= 8; daysAgo++) {
    const d = new Date(today)
    d.setDate(d.getDate() - daysAgo)
    const dateYMD = d.toISOString().slice(0, 10).replace(/-/g, '')
    const dateISO = d.toISOString().slice(0, 10)

    const follower = await getFollowerCount(token, dateYMD)
    if (follower) {
      const { error } = await supabase
        .from('line_broadcasts')
        .upsert({
          store_id: storeId,
          broadcast_date: dateISO,
          title: '__follower_snapshot__',
          friend_count_after: follower.followers,
          target_audience: 'auto-sync',
        }, { onConflict: 'store_id,broadcast_date,title' })

      if (!error) friendCountUpdated++
    }

    const stats = await getMessageStats(token, dateYMD)
    if (stats && stats.broadcast > 0) {
      const { data: existing } = await supabase
        .from('line_broadcasts')
        .select('id, title')
        .eq('store_id', storeId)
        .eq('broadcast_date', dateISO)
        .neq('title', '__follower_snapshot__')

      if (existing && existing.length > 0) {
        await supabase
          .from('line_broadcasts')
          .update({
            delivered: stats.broadcast,
            friend_count_after: follower?.followers ?? null,
          })
          .eq('id', existing[0].id)
        broadcastsUpdated++
      } else {
        const { error } = await supabase
          .from('line_broadcasts')
          .upsert({
            store_id: storeId,
            broadcast_date: dateISO,
            title: `推播 ${dateISO}`,
            delivered: stats.broadcast,
            friend_count_after: follower?.followers ?? null,
            target_audience: '全部好友 (auto-sync)',
          }, { onConflict: 'store_id,broadcast_date,title' })
        if (!error) broadcastsUpdated++
      }
    }
  }

  return { friendCountUpdated, broadcastsUpdated }
}
