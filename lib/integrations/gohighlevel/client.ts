import type { GHLCampaign, GHLCampaignStats, GHLListResponse } from './types'

// LeadConnector (GoHighLevel) v2 API.
// All campaign endpoints require `locationId` as a query parameter.
const GHL_BASE = process.env.GHL_BASE_URL ?? 'https://services.leadconnectorhq.com'
const GHL_VERSION = process.env.GHL_API_VERSION ?? '2021-07-28'

export interface GHLConfig {
  apiKey?: string
  locationId?: string
}

// Location API Keys are JWTs whose payload contains `location_id`.
// Decode without verifying — we only need the claim, not auth (server verifies the signature).
function decodeLocationIdFromJwt(key: string): string | undefined {
  const parts = key.split('.')
  if (parts.length !== 3) return undefined
  try {
    const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/')
    const padded = b64 + '='.repeat((4 - (b64.length % 4)) % 4)
    const payload = JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'))
    const loc = payload.location_id ?? payload.locationId
    return typeof loc === 'string' && loc.length > 0 ? loc : undefined
  } catch {
    return undefined
  }
}

function getConfig(override?: GHLConfig): GHLConfig {
  const apiKey = override?.apiKey ?? process.env.GHL_LOCATION_API_KEY
  const locationId =
    override?.locationId ??
    process.env.GHL_LOCATION_ID ??
    (apiKey ? decodeLocationIdFromJwt(apiKey) : undefined)
  return { apiKey, locationId }
}

function isConfigured(cfg: GHLConfig): boolean {
  return !!(cfg.apiKey && cfg.apiKey.trim())
}

async function ghlFetch<T>(
  path: string,
  params: Record<string, string | number | undefined>,
  cfg: GHLConfig,
): Promise<T> {
  if (!isConfigured(cfg)) {
    console.warn('[GHL] Location API key not set — returning empty result.')
    return {} as T
  }
  const url = new URL(`${GHL_BASE}${path}`)
  const merged: Record<string, string | number | undefined> = {
    ...(cfg.locationId ? { locationId: cfg.locationId } : {}),
    ...params,
  }
  for (const [k, v] of Object.entries(merged)) {
    if (v !== undefined && v !== null && v !== '') {
      url.searchParams.set(k, String(v))
    }
  }
  const res = await fetch(url.toString(), {
    headers: {
      Authorization: `Bearer ${cfg.apiKey}`,
      Version: GHL_VERSION,
      Accept: 'application/json',
    },
    next: { revalidate: 0 },
    signal: AbortSignal.timeout(30000),
  })
  if (!res.ok) {
    throw new Error(`GHL API error: ${res.status} ${await res.text()}`)
  }
  return (await res.json()) as T
}

function pickList<T>(resp: GHLListResponse<T>): T[] {
  return resp.campaigns ?? resp.data ?? resp.results ?? []
}

// GHL v2 /campaigns/ rejects unknown query params (422 "property X should not exist").
// Accepted: locationId (required, added in ghlFetch), limit, skip.
// Page through with limit/skip; stop when a page comes back shorter than limit.
export async function fetchCampaigns(override?: GHLConfig): Promise<GHLCampaign[]> {
  const cfg = getConfig(override)
  if (!isConfigured(cfg)) return []
  const out: GHLCampaign[] = []
  const limit = 100
  let skip = 0
  let safety = 0
  while (true) {
    const resp: GHLListResponse<GHLCampaign> = await ghlFetch<GHLListResponse<GHLCampaign>>(
      '/campaigns/',
      { limit, skip },
      cfg,
    )
    const list = pickList(resp)
    out.push(...list)
    if (list.length < limit) break
    skip += limit
    if (++safety > 50) break
  }
  return out
}

export async function fetchCampaignStats(
  campaignId: string,
  override?: GHLConfig,
): Promise<GHLCampaignStats | null> {
  const cfg = getConfig(override)
  if (!isConfigured(cfg)) return null
  try {
    const resp = await ghlFetch<GHLCampaignStats>(`/campaigns/${campaignId}/stats`, {}, cfg)
    return { ...resp, campaignId }
  } catch (err) {
    console.warn(`[GHL] stats fetch failed for ${campaignId}:`, err)
    return null
  }
}

export function isGHLConfigured(override?: GHLConfig): boolean {
  return isConfigured(getConfig(override))
}

export function resolveLocationId(apiKey?: string): string | undefined {
  if (!apiKey) return undefined
  return decodeLocationIdFromJwt(apiKey)
}
