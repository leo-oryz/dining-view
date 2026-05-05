import type {
  TTApiEnvelope,
  TTBusinessAccount,
  TTVideoListData,
  TTVideoListItem,
} from './types'

const TT_BASE = process.env.TIKTOK_API_BASE ?? 'https://business-api.tiktok.com/open_api/v1.3'

export interface TTConfig {
  accessToken?: string
}

function getConfig(override?: TTConfig): TTConfig {
  return {
    accessToken: override?.accessToken ?? process.env.TIKTOK_ACCESS_TOKEN,
  }
}

export function isTTConfigured(override?: TTConfig): boolean {
  const cfg = getConfig(override)
  return !!(cfg.accessToken && cfg.accessToken.trim())
}

async function ttFetch<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  cfg: TTConfig,
  init?: RequestInit,
): Promise<TTApiEnvelope<T>> {
  if (!isTTConfigured(cfg)) {
    console.warn('[TikTok] access token not set — returning empty.')
    return { data: undefined }
  }
  const url = new URL(`${TT_BASE}${path}`)
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v))
  }
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      'Access-Token': cfg.accessToken!,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...(init?.headers ?? {}),
    },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    throw new Error(`TikTok API error: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as TTApiEnvelope<T>
}

// ⚠️ verify path once approved — TikTok for Business has both
//   /business/get/ (Display API) and /advertiser/info/ (Ads API) variants.
export async function fetchTTAccount(override?: TTConfig): Promise<TTBusinessAccount | null> {
  const cfg = getConfig(override)
  if (!isTTConfigured(cfg)) return null
  const resp = await ttFetch<TTBusinessAccount>('/business/get/', {}, cfg)
  return resp.data ?? null
}

// ⚠️ verify endpoint — alternate path: /research/video/query/ for the Research API.
export async function fetchTTVideos(override?: TTConfig): Promise<TTVideoListItem[]> {
  const cfg = getConfig(override)
  if (!isTTConfigured(cfg)) return []
  const out: TTVideoListItem[] = []
  let cursor: string | null = null
  let safety = 0
  while (true) {
    const resp: TTApiEnvelope<TTVideoListData> = await ttFetch<TTVideoListData>(
      '/video/list/',
      { cursor: cursor ?? undefined, max_count: 50 },
      cfg,
    )
    out.push(...(resp.data?.videos ?? []))
    if (!resp.data?.has_more || !resp.data?.cursor) break
    cursor = resp.data.cursor
    if (++safety > 20) break
  }
  return out
}
