import type {
  IGUserProfile,
  IGInsightsResponse,
  IGMedia,
  IGTotals,
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

function emptyRow(storeId: string, date: string, followers: number | null): SocialDailyRow {
  return {
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
}

export function transformIGDaily(
  profile: IGUserProfile | null,
  reachInsights: IGInsightsResponse | null,
  totals: IGTotals | null,
  storeId: string,
): SocialDailyRow[] {
  const byDate = new Map<string, SocialDailyRow>()
  const followers = profile?.followers_count ?? null

  // Build per-day rows from the reach time-series.
  for (const dp of reachInsights?.data ?? []) {
    if (dp.name !== 'reach') continue
    for (const v of dp.values ?? []) {
      if (!v.end_time) continue
      const date = toHcmDateString(v.end_time)
      if (!date) continue
      const row = byDate.get(date) ?? emptyRow(storeId, date, followers)
      row.reach = typeof v.value === 'number' ? v.value : null
      byDate.set(date, row)
    }
  }

  // Ensure today's row exists so we have somewhere to attach followers + period totals.
  const today = toHcmDateString(Date.now())
  if (!byDate.has(today) && (followers != null || (totals && Object.keys(totals).length > 0))) {
    byDate.set(today, emptyRow(storeId, today, followers))
  }

  // Stamp period-level totals onto the latest available row. Post-v22 these are
  // total_value across the requested window — not true daily numbers — so we only
  // attach them to one row to avoid double-counting in dashboard sums.
  if (totals && byDate.size > 0) {
    const latestDate = Array.from(byDate.keys()).sort().pop()!
    const row = byDate.get(latestDate)!
    if (totals.views != null) row.impressions = totals.views
    if (totals.profile_links_taps != null) row.profile_visits = totals.profile_links_taps
  }

  // Make sure every row has the current followers count (snapshot, not historical).
  for (const row of byDate.values()) {
    if (row.followers == null) row.followers = followers
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
    saves: m.saves ?? 0,
    reach: m.reach ?? 0,
    impressions: m.views ?? 0,
    views: m.views ?? 0,
    updated_at: new Date().toISOString(),
  }))
}
