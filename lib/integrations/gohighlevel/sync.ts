import { createServiceClient } from '@/lib/supabase/server'
import {
  fetchCampaigns,
  fetchCampaignStats,
  isGHLConfigured,
  type GHLConfig,
} from './client'
import { transformCampaign } from './transformer'
import { runAttribution } from './attribution'

const SETTING_KEY_API = 'ghl_api_key'
const SETTING_KEY_LOCATION = 'ghl_location_id'

async function loadStoreConfig(
  supabase: ReturnType<typeof createServiceClient>,
  storeId: string,
): Promise<GHLConfig> {
  const { data } = await supabase
    .from('store_settings')
    .select('setting_key, setting_value')
    .eq('store_id', storeId)
    .in('setting_key', [SETTING_KEY_API, SETTING_KEY_LOCATION])
  const byKey = new Map((data ?? []).map((r) => [r.setting_key as string, r.setting_value as string | null]))
  const apiKey = byKey.get(SETTING_KEY_API) ?? undefined
  const locationId = byKey.get(SETTING_KEY_LOCATION) ?? undefined
  const cfg: GHLConfig = {}
  if (apiKey) cfg.apiKey = apiKey
  if (locationId) cfg.locationId = locationId
  return cfg
}

export interface GHLSyncResult {
  store: string
  store_id: string
  campaigns?: number
  attribution_matches?: number
  skipped?: boolean
  error?: string
}

function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message
  if (typeof err === 'string') return err
  if (typeof err === 'object' && err !== null) {
    const obj = err as Record<string, unknown>
    if (typeof obj.message === 'string') {
      const extra = [obj.code, obj.details, obj.hint].filter(Boolean).join(' · ')
      return extra ? `${obj.message} (${extra})` : obj.message
    }
    try { return JSON.stringify(err) } catch { /* fall through */ }
  }
  return String(err)
}

export async function syncGHL(options?: {
  storeId?: string
  config?: GHLConfig
}): Promise<GHLSyncResult[]> {
  const supabase = createServiceClient()

  let storesQuery = supabase.from('stores').select('id, name')
  if (options?.storeId) storesQuery = storesQuery.eq('id', options.storeId)
  const { data: stores, error: storesErr } = await storesQuery
  if (storesErr) throw storesErr
  if (!stores?.length) return []

  const results: GHLSyncResult[] = []

  for (const store of stores) {
    const storeId = store.id as string
    const result: GHLSyncResult = { store: store.name, store_id: storeId }

    const cfg = options?.config ?? (await loadStoreConfig(supabase, storeId))
    if (!isGHLConfigured(cfg)) {
      result.skipped = true
      results.push(result)
      continue
    }

    try {
      const campaigns = await fetchCampaigns(cfg)
      const rows = []
      for (const campaign of campaigns) {
        const stats = await fetchCampaignStats(String(campaign.id), cfg)
        rows.push(transformCampaign(campaign, stats, storeId))
      }
      if (rows.length) {
        const { error } = await supabase
          .from('email_campaigns')
          .upsert(rows, { onConflict: 'store_id,ghl_campaign_id', ignoreDuplicates: false })
        if (error) throw error
      }
      result.campaigns = rows.length

      const attribution = await runAttribution(supabase, storeId)
      result.attribution_matches = attribution.matched
    } catch (err) {
      result.error = errorMessage(err)
    }

    results.push(result)
  }

  return results
}
