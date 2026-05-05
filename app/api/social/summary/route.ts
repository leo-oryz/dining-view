import { NextRequest } from 'next/server'
import { apiSuccess, apiError, getStoreId } from '@/lib/api-utils'
import { createServerSupabase } from '@/lib/supabase/server'

const PLATFORMS = ['instagram', 'facebook', 'tiktok', 'xiaohongshu'] as const
type Platform = (typeof PLATFORMS)[number]

function isPlatform(s: string | null | undefined): s is Platform {
  return !!s && (PLATFORMS as readonly string[]).includes(s)
}

function daysAgo(d: number): string {
  const dt = new Date(Date.now() - d * 86400000 + 7 * 3600000)
  return dt.toISOString().slice(0, 10)
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const storeId = getStoreId(searchParams)
  const platformParam = searchParams.get('platform')
  const days = Math.max(7, Math.min(180, Number(searchParams.get('days') ?? 30)))
  if (!isPlatform(platformParam)) return apiError('Invalid platform', 400)

  const supabase = await createServerSupabase()
  const since = daysAgo(days)
  const sincePrev = daysAgo(days * 2)

  if (platformParam === 'xiaohongshu') {
    const { data: entries, error } = await supabase
      .from('xhs_manual_metrics')
      .select('*')
      .eq('store_id', storeId)
      .order('date', { ascending: false })
      .limit(60)
    if (error) return apiError(error.message, 500)
    return apiSuccess({
      platform: 'xiaohongshu',
      manual_entries: entries ?? [],
    })
  }

  const [{ data: dailyRows, error: dailyErr }, { data: postRows, error: postErr }] = await Promise.all([
    supabase
      .from('social_daily_metrics')
      .select('date, followers, reach, impressions, profile_visits, website_clicks')
      .eq('store_id', storeId)
      .eq('platform', platformParam)
      .gte('date', sincePrev)
      .order('date', { ascending: true }),
    supabase
      .from('social_post_metrics')
      .select('post_id, post_type, posted_at, caption_snippet, likes, comments, shares, saves, reach, impressions, views')
      .eq('store_id', storeId)
      .eq('platform', platformParam)
      .order('reach', { ascending: false })
      .limit(30),
  ])
  if (dailyErr) return apiError(dailyErr.message, 500)
  if (postErr) return apiError(postErr.message, 500)

  const daily = (dailyRows ?? []) as {
    date: string
    followers: number | null
    reach: number | null
    impressions: number | null
    profile_visits: number | null
    website_clicks: number | null
  }[]
  const recent = daily.filter((d) => d.date >= since)
  const previous = daily.filter((d) => d.date < since)

  const sumKey = (rows: typeof daily, key: keyof (typeof daily)[number]) =>
    rows.reduce((acc, r) => acc + (Number(r[key] ?? 0) || 0), 0)

  const latestFollowers = recent.length ? recent[recent.length - 1].followers : daily.length ? daily[daily.length - 1].followers : null
  const wowFollowers = previous.length ? previous[previous.length - 1].followers : null

  const totalReach = sumKey(recent, 'reach')
  const totalImpressions = sumKey(recent, 'impressions')

  const posts = (postRows ?? []) as {
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
  }[]
  const engagementSum = posts.reduce(
    (acc, p) => acc + (p.likes ?? 0) + (p.comments ?? 0) + (p.shares ?? 0) + (p.saves ?? 0),
    0,
  )
  const reachSum = posts.reduce((acc, p) => acc + (p.reach ?? 0), 0)
  const avgEngagementRate = reachSum > 0 ? (engagementSum / reachSum) * 100 : null

  return apiSuccess({
    platform: platformParam,
    days,
    kpis: {
      followers: latestFollowers,
      followers_prev: wowFollowers,
      total_reach: totalReach,
      total_impressions: totalImpressions,
      avg_engagement_rate: avgEngagementRate,
    },
    daily: recent,
    top_posts: posts,
  })
}
