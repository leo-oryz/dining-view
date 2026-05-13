import { NextRequest } from 'next/server'
import { apiSuccess, apiError } from '@/lib/api-utils'
import { getSession } from '@/lib/auth/getSession'
import { createServiceClient } from '@/lib/supabase/server'
import { fetchCampaigns, resolveLocationId, type GHLConfig } from '@/lib/integrations/gohighlevel/client'

const KEY_API = 'ghl_api_key'
const KEY_LOCATION = 'ghl_location_id'

async function resolveConfig(body: {
  store_id?: string
  api_key?: string
  location_id?: string
}): Promise<GHLConfig> {
  const cfg: GHLConfig = {}
  const fromBodyKey = body.api_key?.trim() || undefined
  const fromBodyLoc = body.location_id?.trim() || undefined
  if (fromBodyKey) cfg.apiKey = fromBodyKey
  if (fromBodyLoc) cfg.locationId = fromBodyLoc

  if (!cfg.apiKey || !cfg.locationId) {
    const storeId = body.store_id?.trim()
    if (storeId) {
      const supabase = createServiceClient()
      const { data } = await supabase
        .from('store_settings')
        .select('setting_key, setting_value')
        .eq('store_id', storeId)
        .in('setting_key', [KEY_API, KEY_LOCATION])
      const byKey = new Map((data ?? []).map((r) => [r.setting_key as string, r.setting_value as string | null]))
      if (!cfg.apiKey) cfg.apiKey = byKey.get(KEY_API) ?? undefined
      if (!cfg.locationId) cfg.locationId = byKey.get(KEY_LOCATION) ?? undefined
    }
  }

  if (!cfg.locationId && cfg.apiKey) {
    cfg.locationId = resolveLocationId(cfg.apiKey)
  }
  return cfg
}

async function run(cfg: GHLConfig) {
  try {
    const campaigns = await fetchCampaigns(cfg)
    return {
      success: true,
      detail: `Connection OK — ${campaigns.length} campaigns visible (locationId: ${cfg.locationId ?? '—'})`,
      location_id: cfg.locationId ?? null,
    }
  } catch (err) {
    return {
      success: false,
      detail: err instanceof Error ? err.message : 'Test failed',
      location_id: cfg.locationId ?? null,
    }
  }
}

export async function GET() {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const result = await run({})
  return apiSuccess(result)
}

export async function POST(request: NextRequest) {
  const profile = await getSession()
  if (!profile) return apiError('Unauthorized', 401)
  if (profile.role !== 'owner') return apiError('Forbidden', 403)
  const body = await request.json().catch(() => ({}))
  const cfg = await resolveConfig(body)
  const result = await run(cfg)
  return apiSuccess(result)
}
