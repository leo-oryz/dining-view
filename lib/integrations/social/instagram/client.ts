import type {
  IGUserProfile,
  IGInsightsResponse,
  IGMedia,
  IGMediaListResponse,
  IGTotals,
} from './types'

const GRAPH_BASE = process.env.FACEBOOK_GRAPH_BASE ?? 'https://graph.facebook.com/v22.0'

export interface IGConfig {
  accessToken?: string
  igUserId?: string
}

function getConfig(override?: IGConfig): IGConfig {
  return {
    accessToken: override?.accessToken ?? process.env.INSTAGRAM_ACCESS_TOKEN,
    igUserId: override?.igUserId ?? process.env.INSTAGRAM_USER_ID,
  }
}

export function isIGConfigured(override?: IGConfig): boolean {
  const cfg = getConfig(override)
  return !!(cfg.accessToken && cfg.accessToken.trim() && cfg.igUserId && cfg.igUserId.trim())
}

async function igFetch<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  cfg: IGConfig,
): Promise<T> {
  if (!cfg.accessToken || !cfg.accessToken.trim()) {
    console.warn('[IG] access token not set — returning empty.')
    return {} as T
  }
  const url = new URL(`${GRAPH_BASE}${path}`)
  url.searchParams.set('access_token', cfg.accessToken)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), {
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    throw new Error(`IG Graph error: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as T
}

export async function fetchIGProfile(override?: IGConfig): Promise<IGUserProfile | null> {
  const cfg = getConfig(override)
  if (!isIGConfigured(cfg)) return null
  return igFetch<IGUserProfile>(
    `/${cfg.igUserId}`,
    { fields: 'id,username,followers_count,media_count' },
    cfg,
  )
}

// Daily reach is the only user-level metric that still supports period=day time-series
// post-v22. Everything else is total_value only — fetched separately via fetchIGTotals.
export async function fetchIGDailyReach(
  params: { sinceUnix: number; untilUnix: number },
  override?: IGConfig,
): Promise<IGInsightsResponse | null> {
  const cfg = getConfig(override)
  if (!isIGConfigured(cfg)) return null
  return igFetch<IGInsightsResponse>(
    `/${cfg.igUserId}/insights`,
    {
      metric: 'reach',
      period: 'day',
      since: params.sinceUnix,
      until: params.untilUnix,
    },
    cfg,
  )
}

// Period totals replacing the deprecated daily impressions/profile_views/website_clicks.
// Each metric is fetched in its own call because Meta returns 400 if the requested
// metric list mixes metric_types or includes a metric the account is not eligible for.
export async function fetchIGTotals(
  params: { sinceUnix: number; untilUnix: number },
  override?: IGConfig,
): Promise<IGTotals> {
  const cfg = getConfig(override)
  if (!isIGConfigured(cfg)) return {}
  const METRICS = ['views', 'profile_links_taps', 'total_interactions', 'accounts_engaged'] as const
  const out: IGTotals = {}
  for (const metric of METRICS) {
    try {
      const resp = await igFetch<IGInsightsResponse>(
        `/${cfg.igUserId}/insights`,
        {
          metric,
          metric_type: 'total_value',
          period: 'day',
          since: params.sinceUnix,
          until: params.untilUnix,
        },
        cfg,
      )
      const dp = resp.data?.[0]
      const value = dp?.total_value?.value
      if (typeof value === 'number') {
        out[metric as keyof IGTotals] = value
      }
    } catch (err) {
      // Some metrics require Business (not Creator) accounts or have other constraints.
      console.warn(`[IG] totals fetch for ${metric} skipped:`, err instanceof Error ? err.message : err)
    }
  }
  return out
}

export async function fetchIGMedia(
  params: { limit?: number } = {},
  override?: IGConfig,
): Promise<IGMedia[]> {
  const cfg = getConfig(override)
  if (!isIGConfigured(cfg)) return []
  const resp = await igFetch<IGMediaListResponse>(
    `/${cfg.igUserId}/media`,
    {
      fields: 'id,media_type,media_product_type,caption,timestamp,like_count,comments_count',
      limit: params.limit ?? 50,
    },
    cfg,
  )
  const items = resp.data ?? []
  // Enrich with per-post insights — Stories don't expose all fields, carousels skip videos.
  for (const item of items) {
    try {
      const ins = await igFetch<IGInsightsResponse>(
        `/${item.id}/insights`,
        {
          metric: 'reach,views,saves,shares,total_interactions',
        },
        cfg,
      )
      for (const dp of ins.data ?? []) {
        const v = dp.values?.[0]?.value ?? dp.total_value?.value
        if (typeof v !== 'number') continue
        if (dp.name === 'reach') item.reach = v
        else if (dp.name === 'views') item.views = v
        else if (dp.name === 'saves') item.saves = v
        else if (dp.name === 'shares') item.shares = v
        else if (dp.name === 'total_interactions') item.total_interactions = v
      }
    } catch (err) {
      // Per-media insights can 400 for some media types (carousel children, old stories).
      console.warn(`[IG] insights for media ${item.id} skipped:`, err instanceof Error ? err.message : err)
    }
  }
  return items
}
