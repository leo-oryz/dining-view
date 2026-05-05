import type {
  IGUserProfile,
  IGInsightsResponse,
  IGMedia,
} from './types'
import { toHcmDateString } from '../shared'

export interface SocialDailyRow {
  store_id: string
  platform: string
  date: string
  followers: number | null
  reach: number | null
  impressions: number | null
  profile_visits: number | null
  website_clicks: number | null
  updated_at: string
}

export interface SocialPostRow {
  store_id: string
  platform: string
  post_id: string
  post_type: string | null
  posted_at: string | null
  caption_snippet: string | null
  likes: number
  comments: number
  shares: number
  saves: number
  reach: number
  impressions: number
  views: number
  updated_at: string
}

function captionSnippet(caption: string | null | undefined): string | null {
  if (!caption) return null
  const trimmed = caption.replace(/\s+/g, ' ').trim()
  return trimmed.length > 140 ? `${trimmed.slice(0, 137)}…` : trimmed
}

function pickPostType(media: IGMedia): string | null {
  const product = media.media_product_type?.toLowerCase()
  if (product === 'reels') return 'reel'
  if (product === 'story') return 'story'
  const type = media.media_type?.toLowerCase()
  if (type === 'video') return 'video'
  return 'post'
}

export function transformIGDaily(
  profile: IGUserProfile | null,
  insights: IGInsightsResponse | null,
  storeId: string,
): SocialDailyRow[] {
  const byDate = new Map<string, SocialDailyRow>()
  const followers = profile?.followers_count ?? null

  for (const dp of insights?.data ?? []) {
    for (const v of dp.values ?? []) {
      if (!v.end_time) continue
      const date = toHcmDateString(v.end_time)
      if (!date) continue
      const existing = byDate.get(date) ?? {
        store_id: storeId,
        platform: 'instagram',
        date,
        followers,
        reach: null,
        impressions: null,
        profile_visits: null,
        website_clicks: null,
        updated_at: new Date().toISOString(),
      }
      const value = typeof v.value === 'number' ? v.value : null
      if (dp.name === 'reach') existing.reach = value
      else if (dp.name === 'impressions') existing.impressions = value
      else if (dp.name === 'profile_views') existing.profile_visits = value
      else if (dp.name === 'website_clicks') existing.website_clicks = value
      byDate.set(date, existing)
    }
  }

  if (byDate.size === 0 && followers != null) {
    const today = toHcmDateString(Date.now())
    byDate.set(today, {
      store_id: storeId,
      platform: 'instagram',
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

export function transformIGMedia(media: IGMedia[], storeId: string): SocialPostRow[] {
  return media.map((m) => ({
    store_id: storeId,
    platform: 'instagram',
    post_id: String(m.id),
    post_type: pickPostType(m),
    posted_at: m.timestamp ?? null,
    caption_snippet: captionSnippet(m.caption),
    likes: m.like_count ?? 0,
    comments: m.comments_count ?? 0,
    shares: m.shares ?? 0,
    saves: m.saved ?? 0,
    reach: m.reach ?? 0,
    impressions: m.impressions ?? 0,
    views: m.video_views ?? 0,
    updated_at: new Date().toISOString(),
  }))
}
