import type {
  FBPageProfile,
  FBInsightsResponse,
  FBPost,
  FBPostListResponse,
} from './types'

const GRAPH_BASE = process.env.FACEBOOK_GRAPH_BASE ?? 'https://graph.facebook.com/v19.0'

export interface FBConfig {
  accessToken?: string
  pageId?: string
}

function getConfig(override?: FBConfig): FBConfig {
  return {
    accessToken: override?.accessToken ?? process.env.FACEBOOK_PAGE_ACCESS_TOKEN,
    pageId: override?.pageId ?? process.env.FACEBOOK_PAGE_ID,
  }
}

export function isFBConfigured(override?: FBConfig): boolean {
  const cfg = getConfig(override)
  return !!(cfg.accessToken && cfg.accessToken.trim() && cfg.pageId && cfg.pageId.trim())
}

async function fbFetch<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  cfg: FBConfig,
): Promise<T> {
  if (!cfg.accessToken || !cfg.accessToken.trim()) {
    console.warn('[FB] page access token not set — returning empty.')
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
    throw new Error(`FB Graph error: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as T
}

export async function fetchFBProfile(override?: FBConfig): Promise<FBPageProfile | null> {
  const cfg = getConfig(override)
  if (!isFBConfigured(cfg)) return null
  return fbFetch<FBPageProfile>(
    `/${cfg.pageId}`,
    { fields: 'id,name,fan_count,followers_count' },
    cfg,
  )
}

// ⚠️ Facebook Graph metric names change frequently — verify the active list
// against https://developers.facebook.com/docs/graph-api/reference/v19.0/insights
export async function fetchFBInsights(
  params: { sinceUnix: number; untilUnix: number },
  override?: FBConfig,
): Promise<FBInsightsResponse | null> {
  const cfg = getConfig(override)
  if (!isFBConfigured(cfg)) return null
  return fbFetch<FBInsightsResponse>(
    `/${cfg.pageId}/insights`,
    {
      metric: 'page_impressions,page_impressions_unique,page_views_total',
      period: 'day',
      since: params.sinceUnix,
      until: params.untilUnix,
    },
    cfg,
  )
}

export async function fetchFBPosts(
  params: { limit?: number } = {},
  override?: FBConfig,
): Promise<FBPost[]> {
  const cfg = getConfig(override)
  if (!isFBConfigured(cfg)) return []
  const resp = await fbFetch<FBPostListResponse>(
    `/${cfg.pageId}/posts`,
    {
      fields:
        'id,created_time,message,likes.summary(true).limit(0),comments.summary(true).limit(0),shares,reactions.summary(true).limit(0)',
      limit: params.limit ?? 50,
    },
    cfg,
  )
  return resp.data ?? []
}
