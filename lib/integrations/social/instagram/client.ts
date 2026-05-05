import type {
  IGUserProfile,
  IGInsightsResponse,
  IGMedia,
  IGMediaListResponse,
} from './types'

const GRAPH_BASE = process.env.FACEBOOK_GRAPH_BASE ?? 'https://graph.facebook.com/v19.0'

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

// ⚠️ verify endpoint shape — IG user-id can be discovered via FB page connection.
export async function fetchIGProfile(override?: IGConfig): Promise<IGUserProfile | null> {
  const cfg = getConfig(override)
  if (!isIGConfigured(cfg)) return null
  return igFetch<IGUserProfile>(
    `/${cfg.igUserId}`,
    { fields: 'id,username,followers_count,media_count' },
    cfg,
  )
}

// ⚠️ Available metrics depend on account type (creator/business). Verify list.
export async function fetchIGInsights(
  params: { sinceUnix: number; untilUnix: number },
  override?: IGConfig,
): Promise<IGInsightsResponse | null> {
  const cfg = getConfig(override)
  if (!isIGConfigured(cfg)) return null
  return igFetch<IGInsightsResponse>(
    `/${cfg.igUserId}/insights`,
    {
      metric: 'reach,impressions,profile_views,website_clicks',
      period: 'day',
      since: params.sinceUnix,
      until: params.untilUnix,
    },
    cfg,
  )
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
  // Enrich with per-post insights — Stories don't expose all fields.
  for (const item of items) {
    try {
      const ins = await igFetch<IGInsightsResponse>(
        `/${item.id}/insights`,
        {
          metric: 'reach,impressions,saved,shares,video_views',
        },
        cfg,
      )
      for (const dp of ins.data ?? []) {
        const v = dp.values?.[0]?.value
        if (typeof v !== 'number') continue
        if (dp.name === 'reach') item.reach = v
        else if (dp.name === 'impressions') item.impressions = v
        else if (dp.name === 'saved') item.saved = v
        else if (dp.name === 'shares') item.shares = v
        else if (dp.name === 'video_views') item.video_views = v
      }
    } catch (err) {
      // Insights may 400 for some media types (e.g. carousel children). Continue silently.
      console.warn(`[IG] insights for media ${item.id} skipped:`, err instanceof Error ? err.message : err)
    }
  }
  return items
}
