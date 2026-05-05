import type { TTBusinessAccount, TTVideoListItem } from './types'
import { toHcmDateString, unixToHcmDate } from '../shared'
import type { SocialDailyRow, SocialPostRow } from '../instagram/transformer'

function captionSnippet(caption: string | null | undefined): string | null {
  if (!caption) return null
  const trimmed = caption.replace(/\s+/g, ' ').trim()
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed
}

export function transformTTDaily(
  account: TTBusinessAccount | null,
  storeId: string,
): SocialDailyRow[] {
  if (!account) return []
  const today = toHcmDateString(Date.now())
  return [
    {
      store_id: storeId,
      platform: 'tiktok',
      date: today,
      followers: account.followers_count ?? null,
      reach: null,
      impressions: null,
      profile_visits: account.profile_views ?? null,
      website_clicks: null,
      updated_at: new Date().toISOString(),
    },
  ]
}

export function transformTTVideos(videos: TTVideoListItem[], storeId: string): SocialPostRow[] {
  return videos.map((v) => ({
    store_id: storeId,
    platform: 'tiktok',
    post_id: String(v.item_id),
    post_type: 'video',
    posted_at: v.create_time ? `${unixToHcmDate(v.create_time)}T00:00:00+07:00` : null,
    caption_snippet: captionSnippet(v.caption),
    likes: v.likes ?? 0,
    comments: v.comments ?? 0,
    shares: v.shares ?? 0,
    saves: 0,
    reach: v.reach ?? 0,
    impressions: v.impressions ?? 0,
    views: v.video_views ?? 0,
    updated_at: new Date().toISOString(),
  }))
}
