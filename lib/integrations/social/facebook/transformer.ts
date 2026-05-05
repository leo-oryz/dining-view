import type { FBPageProfile, FBInsightsResponse, FBPost } from './types'
import { toHcmDateString } from '../shared'
import type { SocialDailyRow, SocialPostRow } from '../instagram/transformer'

function captionSnippet(message: string | null | undefined): string | null {
  if (!message) return null
  const trimmed = message.replace(/\s+/g, ' ').trim()
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed
}

export function transformFBDaily(
  profile: FBPageProfile | null,
  insights: FBInsightsResponse | null,
  storeId: string,
): SocialDailyRow[] {
  const followers = profile?.followers_count ?? profile?.fan_count ?? null
  const byDate = new Map<string, SocialDailyRow>()

  for (const dp of insights?.data ?? []) {
    for (const v of dp.values ?? []) {
      if (!v.end_time) continue
      const date = toHcmDateString(v.end_time)
      if (!date) continue
      const existing = byDate.get(date) ?? {
        store_id: storeId,
        platform: 'facebook',
        date,
        followers,
        reach: null,
        impressions: null,
        profile_visits: null,
        website_clicks: null,
        updated_at: new Date().toISOString(),
      }
      const value = typeof v.value === 'number' ? v.value : null
      if (dp.name === 'page_impressions') existing.impressions = value
      else if (dp.name === 'page_impressions_unique' || dp.name === 'page_reach') existing.reach = value
      else if (dp.name === 'page_views_total') existing.profile_visits = value
      byDate.set(date, existing)
    }
  }

  if (byDate.size === 0 && followers != null) {
    const today = toHcmDateString(Date.now())
    byDate.set(today, {
      store_id: storeId,
      platform: 'facebook',
      date: today,
      followers,
      reach: null,
      impressions: null,
      profile_visits: null,
      website_clicks: null,
      updated_at: new Date().toISOString(),
    })
  }

  return Array.from(byDate.values())
}

export function transformFBPosts(posts: FBPost[], storeId: string): SocialPostRow[] {
  return posts.map((p) => ({
    store_id: storeId,
    platform: 'facebook',
    post_id: String(p.id),
    post_type: 'post',
    posted_at: p.created_time ?? null,
    caption_snippet: captionSnippet(p.message),
    likes: p.reactions?.summary?.total_count ?? p.likes?.summary?.total_count ?? 0,
    comments: p.comments?.summary?.total_count ?? 0,
    shares: p.shares?.count ?? 0,
    saves: 0,
    reach: 0,
    impressions: 0,
    views: 0,
    updated_at: new Date().toISOString(),
  }))
}
